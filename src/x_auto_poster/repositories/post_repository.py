"""Repository abstraction for post definitions and publishing state."""
from abc import ABC, abstractmethod
from typing import Any
from x_auto_poster.domain.post import Post, PostConfig


class PostRepository(ABC):
    """Storage boundary used by PublishService."""
    @abstractmethod
    def get_config(self) -> PostConfig: ...

    @abstractmethod
    def list_posts(self) -> list[Post]: ...

    @abstractmethod
    def get_state(self) -> dict[str, Any]: ...

    @abstractmethod
    def get_post_state(self, post_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    def set_post_state(self, state: dict[str, Any], post_id: str, value: dict[str, Any]) -> None: ...

    @abstractmethod
    def save_state(self, state: dict[str, Any]) -> None: ...
