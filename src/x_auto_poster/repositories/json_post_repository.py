"""Validated JSON repository with atomic state replacement."""
import json
import os
from pathlib import Path
import tempfile
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Any
from x_auto_poster.domain.post import Post, PostConfig
from x_auto_poster.repositories.post_repository import PostRepository


class JsonPostRepository(PostRepository):
    """Load the complete post configuration and persist state as JSON."""
    def __init__(self, posts_path: Path, state_path: Path) -> None:
        self.posts_path = Path(posts_path)
        self.state_path = Path(state_path)
        self._config, self._posts = self._load_posts()

    def _load_posts(self) -> tuple[PostConfig, list[Post]]:
        try:
            raw = json.loads(self.posts_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Unable to load posts configuration: {exc}") from exc
        if not isinstance(raw, dict):
            raise ValueError("posts.json must contain a JSON object")
        timezone_name = raw.get("timezone")
        if not isinstance(timezone_name, str) or not timezone_name:
            raise ValueError("timezone must be a valid IANA timezone name")
        try:
            timezone = ZoneInfo(timezone_name)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(f"Invalid IANA timezone: {timezone_name}") from exc
        lateness = raw.get("max_lateness_minutes")
        if isinstance(lateness, bool) or not isinstance(lateness, int) or lateness <= 0:
            raise ValueError("max_lateness_minutes must be a positive integer")
        rows = raw.get("posts")
        if not isinstance(rows, list):
            raise ValueError("posts must be an array")
        posts: list[Post] = []
        ids: set[str] = set()
        for index, row in enumerate(rows):
            label = f"posts[{index}]"
            if not isinstance(row, dict):
                raise ValueError(f"{label} must be an object")
            post_id = row.get("id")
            if not isinstance(post_id, str) or not post_id.strip():
                raise ValueError(f"{label}.id must be a non-empty string")
            if post_id in ids:
                raise ValueError(f"Duplicate post id: {post_id}")
            ids.add(post_id)
            scheduled_text = row.get("scheduled_at")
            if not isinstance(scheduled_text, str):
                raise ValueError(f"{label}.scheduled_at is required and must be a local ISO 8601 datetime")
            if len(scheduled_text) <= 10 or scheduled_text[10] not in "Tt ":
                raise ValueError(f"Invalid scheduled_at for post {post_id}: expected a local date and time")
            try:
                scheduled = datetime.fromisoformat(scheduled_text)
            except ValueError as exc:
                raise ValueError(f"Invalid scheduled_at for post {post_id}") from exc
            if scheduled.tzinfo is not None:
                raise ValueError(f"scheduled_at for post {post_id} must not contain a timezone")
            content = row.get("content")
            if not isinstance(content, str) or not content.strip():
                raise ValueError(f"{label}.content must be a non-empty string")
            enabled = row.get("enabled")
            if not isinstance(enabled, bool):
                raise ValueError(f"{label}.enabled must be a boolean")
            posts.append(Post(post_id, scheduled.replace(tzinfo=timezone), content, enabled))
        return PostConfig(timezone, lateness), posts

    def get_config(self) -> PostConfig:
        return self._config

    def list_posts(self) -> list[Post]:
        return list(self._posts)

    def get_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {"posts": {}}
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Unable to load state file: {exc}") from exc
        if not isinstance(state, dict) or not isinstance(state.get("posts"), dict):
            raise ValueError("state.json must contain an object named 'posts'")
        return state

    def get_post_state(self, post_id: str) -> dict[str, Any] | None:
        value = self.get_state()["posts"].get(post_id)
        return value if isinstance(value, dict) else None

    def set_post_state(self, state: dict[str, Any], post_id: str, value: dict[str, Any]) -> None:
        state["posts"][post_id] = value

    def save_state(self, state: dict[str, Any]) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=self.state_path.parent,
                                             prefix=f".{self.state_path.name}.", suffix=".tmp",
                                             delete=False) as handle:
                temp_path = handle.name
                json.dump(state, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, self.state_path)
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
