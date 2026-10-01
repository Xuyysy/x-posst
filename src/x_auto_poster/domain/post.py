"""Scheduled post and scheduling configuration domain models."""
from dataclasses import dataclass
from datetime import datetime, tzinfo


@dataclass(frozen=True)
class Post:
    """A validated, timezone-aware scheduled text post."""
    id: str
    scheduled_at: datetime
    content: str
    enabled: bool


@dataclass(frozen=True)
class PostConfig:
    """Timezone and stale-post window from posts.json."""
    timezone: tzinfo
    max_lateness_minutes: int
