"""Provider-neutral social publishing interface."""
from abc import ABC, abstractmethod


class SocialClient(ABC):
    """Boundary for submitting content to a social publishing provider."""
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Stable identifier saved with submitted state."""

    @abstractmethod
    def publish(self, text: str) -> str:
        """Submit text and return the provider's post ID."""
