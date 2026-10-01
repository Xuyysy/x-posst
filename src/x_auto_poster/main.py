"""Application dependency wiring and command-line entry point."""
import logging
from x_auto_poster.clients.buffer_client import BufferClient
from x_auto_poster.config import AppConfig
from x_auto_poster.repositories.json_post_repository import JsonPostRepository
from x_auto_poster.services.publish_service import PublishService
from x_auto_poster.exceptions import ProviderAuthenticationError, ProviderRequestError


def main() -> int:
    """Load configuration and run one scheduling cycle."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")
    logger = logging.getLogger(__name__)
    try:
        config = AppConfig.from_env()
        repository = JsonPostRepository(config.posts_path, config.state_path)
        client = BufferClient(config.buffer_api_key, config.buffer_channel_id)
        PublishService(repository, client).run()
    except (ValueError, OSError) as exc:
        logger.error("Application stopped: %s", exc)
        return 1
    except (ProviderAuthenticationError, ProviderRequestError) as exc:
        logger.error("Application stopped: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
