"""Application configuration loaded at the process boundary."""
from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class AppConfig:
    """Runtime configuration and data file locations."""
    buffer_api_key: str
    buffer_channel_id: str
    posts_path: Path
    state_path: Path

    @classmethod
    def from_env(cls, root: Path | None = None) -> "AppConfig":
        """Load required credentials and build paths relative to project root."""
        missing = [key for key in ("BUFFER_API_KEY", "BUFFER_CHANNEL_ID") if not os.environ.get(key)]
        if missing:
            raise ValueError("Missing required environment variables: " + ", ".join(missing))
        base = Path(root) if root else Path(__file__).resolve().parents[2]
        posts_path = Path(os.environ.get("POSTS_FILE_PATH") or base / "data" / "posts.json")
        return cls(os.environ["BUFFER_API_KEY"], os.environ["BUFFER_CHANNEL_ID"],
                   posts_path, base / "data" / "state.json")
