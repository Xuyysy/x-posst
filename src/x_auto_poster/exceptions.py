"""Provider exception hierarchy for safe, explicit failure handling."""


class SocialClientError(Exception):
    """Base error raised by a social publishing provider."""


class ProviderAuthenticationError(SocialClientError):
    """Credentials or account authorization were rejected."""


class ProviderRequestError(SocialClientError):
    """The provider explicitly rejected a request."""


class ProviderMutationError(ProviderRequestError):
    """The GraphQL mutation returned a business error."""


class ProviderRateLimitError(SocialClientError):
    """The provider explicitly rate-limited a request."""

    def __init__(self, message: str, retry_after_seconds: int) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class ProviderResultUnknownError(SocialClientError):
    """The provider may have accepted the request, but no result was received."""
