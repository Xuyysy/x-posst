"""Provider-neutral scheduling and submission workflow."""
from datetime import datetime, timedelta
import logging
import time
from typing import Callable
from x_auto_poster.clients.social_client import SocialClient
from x_auto_poster.domain.post import Post
from x_auto_poster.exceptions import (ProviderAuthenticationError, ProviderMutationError,
                                      ProviderRateLimitError, ProviderRequestError,
                                      ProviderResultUnknownError)
from x_auto_poster.repositories.post_repository import PostRepository

PUBLISH_INTERVAL_SECONDS = 2


class PublishService:
    """Find due posts and persist each provider submission outcome."""
    def __init__(self, repository: PostRepository, social_client: SocialClient,
                 logger: logging.Logger | None = None, sleep_fn: Callable[[float], None] = time.sleep) -> None:
        self.repository = repository
        self.social_client = social_client
        self.logger = logger or logging.getLogger(__name__)
        self.sleep_fn = sleep_fn

    def run(self, now: datetime | None = None) -> None:
        config = self.repository.get_config()
        current = now or datetime.now(config.timezone)
        if current.tzinfo is None:
            current = current.replace(tzinfo=config.timezone)
        posts = self.repository.list_posts()
        state = self.repository.get_state()
        records = state["posts"]
        self.logger.info("Loaded %d posts", len(posts))
        due: list[Post] = []
        changed = False
        for post in posts:
            if not post.enabled:
                continue
            record = records.get(post.id, {})
            if not isinstance(record, dict):
                raise ValueError(f"Invalid state record for post {post.id}")
            status = record.get("status")
            if status is not None and not isinstance(status, str):
                raise ValueError(f"Invalid status for post {post.id}")
            if status in {"submitted", "failed", "unknown", "expired"}:
                if status == "unknown":
                    self.logger.warning("Post %s has unknown outcome; manual review required", post.id)
                continue
            if post.scheduled_at > current:
                continue
            age_seconds = (current - post.scheduled_at).total_seconds()
            if age_seconds > config.max_lateness_minutes * 60:
                self.repository.set_post_state(state, post.id, {"status": "expired"})
                self.logger.warning("Post %s expired and will not be submitted", post.id)
                changed = True
                continue
            if status == "rate_limited":
                retry_at = self._parse_retry_at(record.get("retry_after_at"))
                if retry_at is None or current < retry_at:
                    continue
            due.append(post)
        due.sort(key=lambda item: item.scheduled_at)
        if not due:
            self.logger.info("No posts due.")
            if changed:
                self.repository.save_state(state)
                self.logger.info("State saved")
            return
        self.logger.info("Found %d due posts", len(due))
        submitted_count = 0
        for post in due:
            if submitted_count:
                self.sleep_fn(PUBLISH_INTERVAL_SECONDS)
            self.logger.info("Submitting post %s", post.id)
            occurred_at = datetime.now(config.timezone).isoformat()
            try:
                provider_id = self.social_client.publish(post.content)
            except ProviderRateLimitError as exc:
                retry_at = datetime.now(config.timezone) + timedelta(seconds=exc.retry_after_seconds)
                self.repository.set_post_state(state, post.id, {
                    "status": "rate_limited", "error": str(exc),
                    "retry_after_at": retry_at.isoformat(), "occurred_at": occurred_at,
                })
                self.logger.warning("Provider rate limited post %s; retry after %s", post.id, retry_at.isoformat())
                changed = True
                break
            except ProviderAuthenticationError:
                self.logger.exception("Provider authentication failed; stopping this run")
                if changed:
                    self.repository.save_state(state)
                    self.logger.info("State saved")
                raise
            except ProviderResultUnknownError as exc:
                self.repository.set_post_state(state, post.id, {
                    "status": "unknown", "error": str(exc), "occurred_at": occurred_at,
                })
                self.logger.error("UNKNOWN provider outcome for post %s; manual review required: %s", post.id, exc)
            except (ProviderMutationError, ProviderRequestError) as exc:
                self.repository.set_post_state(state, post.id, {
                    "status": "failed", "error": str(exc), "failed_at": occurred_at,
                })
                self.logger.error("Post %s failed: %s", post.id, exc)
            except Exception as exc:
                # Unclassified client failures are treated conservatively to avoid duplicates.
                self.repository.set_post_state(state, post.id, {
                    "status": "unknown", "error": f"Unexpected provider error ({type(exc).__name__})",
                    "occurred_at": occurred_at,
                })
                self.logger.exception("UNKNOWN provider outcome for post %s; manual review required", post.id)
            else:
                self.repository.set_post_state(state, post.id, {
                    "status": "submitted", "provider": self.social_client.provider_name, "provider_post_id": provider_id,
                    "submitted_at": datetime.now(config.timezone).isoformat(),
                })
                self.logger.info("Provider accepted post %s -> %s", post.id, provider_id)
            changed = True
            submitted_count += 1
        if changed:
            self.repository.save_state(state)
            self.logger.info("State saved")

    @staticmethod
    def _parse_retry_at(value: object) -> datetime | None:
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        return parsed if parsed.tzinfo is not None else None
