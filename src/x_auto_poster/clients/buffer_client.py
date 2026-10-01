"""Buffer GraphQL client with safe error classification and rate diagnostics."""
from datetime import datetime, timedelta, timezone
import logging
import re
import requests
from typing import Any
from x_auto_poster.clients.social_client import SocialClient
from x_auto_poster.exceptions import (ProviderAuthenticationError, ProviderMutationError,
                                      ProviderRateLimitError, ProviderRequestError,
                                      ProviderResultUnknownError)

RATE_LIMIT_WARNING_PERCENT = 0.10
DEFAULT_RETRY_AFTER_SECONDS = 900
CREATE_POST_MUTATION = """mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { __typename post { id text status } }
    ... on MutationError { __typename message }
  }
}"""


class BufferClient(SocialClient):
    """Submit immediate text posts through Buffer's official GraphQL API."""
    ENDPOINT = "https://api.buffer.com"
    provider_name = "buffer"

    def __init__(self, api_key: str, channel_id: str, session: requests.Session | None = None,
                 logger: logging.Logger | None = None) -> None:
        self._api_key = api_key
        self._channel_id = channel_id
        self._session = session or requests.Session()
        self._logger = logger or logging.getLogger(__name__)

    def publish(self, text: str) -> str:
        try:
            response = self._session.post(
                self.ENDPOINT,
                headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                json={"query": CREATE_POST_MUTATION,
                      "variables": {"input": {"text": text, "channelId": self._channel_id,
                                                "schedulingType": "automatic", "mode": "shareNow"}}},
                timeout=(5, 15),
            )
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            raise ProviderResultUnknownError(f"Buffer request outcome unknown ({type(exc).__name__})") from exc
        except requests.exceptions.RequestException as exc:
            raise ProviderResultUnknownError(f"Buffer request outcome unknown ({type(exc).__name__})") from exc

        self._log_rate_limits(response.headers)
        if response.status_code == 429:
            retry_seconds = self._parse_retry_after(response.headers.get("Retry-After"))
            raise ProviderRateLimitError("Buffer rate limit exceeded", retry_seconds)
        if response.status_code in (401, 403):
            raise ProviderAuthenticationError(f"Buffer authentication/authorization failed (HTTP {response.status_code})")
        if not 200 <= response.status_code < 300:
            if response.status_code >= 500:
                raise ProviderResultUnknownError(f"Buffer returned HTTP {response.status_code}; outcome unknown")
            raise ProviderRequestError(f"Buffer rejected request (HTTP {response.status_code})")
        try:
            body = response.json()
        except (ValueError, requests.exceptions.JSONDecodeError) as exc:
            raise ProviderResultUnknownError("Buffer returned invalid JSON after request") from exc
        if not isinstance(body, dict):
            raise ProviderResultUnknownError("Buffer returned an unexpected response")
        if body.get("errors"):
            codes = {str(item.get("extensions", {}).get("code", "")).upper()
                     for item in body["errors"] if isinstance(item, dict)} if isinstance(body["errors"], list) else set()
            messages = self._redact(self._graphql_error_text(body["errors"]))
            if codes & {"UNAUTHORIZED", "FORBIDDEN"}:
                raise ProviderAuthenticationError("Buffer authentication/authorization failed")
            raise ProviderRequestError(f"Buffer GraphQL request failed: {messages}")
        data = body.get("data")
        action = data.get("createPost") if isinstance(data, dict) else None
        if not isinstance(action, dict):
            raise ProviderResultUnknownError("Buffer response did not contain data.createPost")
        if action.get("__typename") == "MutationError" or "message" in action and "post" not in action:
            message = self._redact(str(action.get("message", "Mutation failed")))
            raise ProviderMutationError(f"Buffer could not accept post: {message}")
        post = action.get("post")
        post_id = post.get("id") if isinstance(post, dict) else None
        if action.get("__typename") != "PostActionSuccess" or not isinstance(post_id, str) or not post_id:
            raise ProviderResultUnknownError("Buffer response did not confirm a created post ID")
        return post_id

    def _redact(self, text: str) -> str:
        return text.replace(self._api_key, "[redacted]") if self._api_key else text

    @staticmethod
    def _graphql_error_text(errors: Any) -> str:
        if not isinstance(errors, list):
            return "provider returned GraphQL errors"
        messages = [str(item.get("message", "GraphQL error")) for item in errors if isinstance(item, dict)]
        return "; ".join(messages)[:300] or "provider returned GraphQL errors"

    @staticmethod
    def _parse_retry_after(value: str | None) -> int:
        if value:
            try:
                parsed = int(value.strip())
                if parsed > 0:
                    return parsed
            except ValueError:
                try:
                    when = datetime.strptime(value, "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)
                    return max(1, int((when - datetime.now(timezone.utc)).total_seconds()))
                except ValueError:
                    pass
        return DEFAULT_RETRY_AFTER_SECONDS

    def _log_rate_limits(self, headers: Any) -> None:
        rate_values = self._header_values(headers, "RateLimit")
        policy_values = self._header_values(headers, "RateLimit-Policy")
        policies: dict[int, int] = {}
        for value in policy_values:
            match = re.search(r"(?:^|;)\s*q=(\d+).*?(?:^|;)\s*w=(\d+)", value)
            if match:
                policies[int(match.group(2))] = int(match.group(1))
        for value in rate_values:
            remaining_match = re.search(r"(?:^|;)\s*r=(\d+)", value)
            reset_match = re.search(r"(?:^|;)\s*t=(\d+)", value)
            window_match = re.search(r"-in-(\d+)(min|minutes?|day|days?)", value)
            remaining = int(remaining_match.group(1)) if remaining_match else None
            reset = int(reset_match.group(1)) if reset_match else None
            window = None
            if window_match:
                amount = int(window_match.group(1))
                unit = window_match.group(2)
                window = amount * (60 if unit.startswith("min") else 86400)
            quota = policies.get(window) if window is not None else None
            if remaining is None:
                continue
            msg = f"Buffer rate limit: {remaining} request(s) remaining"
            if reset is not None:
                msg += f", reset in {reset}s"
            if quota and remaining / quota <= RATE_LIMIT_WARNING_PERCENT:
                self._logger.warning(msg)
            else:
                self._logger.info(msg)

    @staticmethod
    def _header_values(headers: Any, name: str) -> list[str]:
        value = headers.get(name)
        if not value:
            return []
        if isinstance(value, (list, tuple)):
            return [str(item) for item in value]
        # requests may coalesce repeated headers with commas; separate at policy starts.
        return re.split(r",\s*(?=(?:\"?[^,\"]+\"?;))", str(value))
