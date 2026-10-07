from pathlib import Path

from x_auto_poster.config import AppConfig


def test_posts_file_path_override(tmp_path, monkeypatch):
    monkeypatch.setenv("BUFFER_API_KEY", "fake")
    monkeypatch.setenv("BUFFER_CHANNEL_ID", "fake")
    custom = tmp_path / "posts.json"
    monkeypatch.setenv("POSTS_FILE_PATH", str(custom))
    assert AppConfig.from_env(tmp_path).posts_path == custom
    monkeypatch.delenv("POSTS_FILE_PATH")
    assert AppConfig.from_env(tmp_path).posts_path == tmp_path / "data" / "posts.json"
