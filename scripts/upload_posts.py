"""Validate, encrypt, and push the local posts document in one command."""

import argparse
import base64
import binascii
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from posts_crypto import decrypt, encrypt  # noqa: E402
from x_auto_poster.repositories.json_post_repository import JsonPostRepository  # noqa: E402


def git(*args: str, capture: bool = False) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=True,
        text=True, capture_output=capture,
    )
    return result.stdout.strip() if capture else ""


def load_key() -> bytes:
    key_file = ROOT / ".env"
    if not key_file.is_file():
        raise ValueError("Missing local .env file with POSTS_ENCRYPTION_KEY.")
    entries = [line.split("=", 1)[1].strip() for line in key_file.read_text().splitlines()
               if line.startswith("POSTS_ENCRYPTION_KEY=")]
    if len(entries) != 1:
        raise ValueError(".env must contain exactly one POSTS_ENCRYPTION_KEY entry.")
    try:
        key = base64.b64decode(entries[0], validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("POSTS_ENCRYPTION_KEY is not valid Base64.") from exc
    if len(key) != 32:
        raise ValueError("POSTS_ENCRYPTION_KEY must decode to 32 bytes.")
    return key


def validate_posts() -> bytes:
    source = ROOT / "data" / "posts.json"
    if not source.is_file():
        raise ValueError("Missing local data/posts.json.")
    repository = JsonPostRepository(source, ROOT / "data" / "state.json")
    posts = repository.list_posts()
    print(f"Posts format valid: {len(posts)} posts")
    return source.read_bytes()


def check_encrypted(plaintext: bytes, key: bytes) -> bool:
    target = ROOT / "data" / "posts.enc.json"
    if not target.exists():
        return False
    try:
        return decrypt(target.read_bytes(), key) == plaintext
    except ValueError as exc:
        raise ValueError(
            "Existing encrypted posts cannot be opened with the local key. "
            "Check that .env matches the GitHub Secret before uploading."
        ) from exc


def upload() -> None:
    if git("branch", "--show-current", capture=True) != "main":
        raise ValueError("Switch to the main branch before uploading posts.")
    if git("status", "--porcelain", "--untracked-files=no", capture=True):
        raise ValueError("Other tracked changes exist. Commit or resolve them first.")
    git("pull", "--rebase", "origin", "main")

    key = load_key()
    plaintext = validate_posts()
    if check_encrypted(plaintext, key):
        print("Posts already encrypted and uploaded; nothing to do.")
        return

    target = ROOT / "data" / "posts.enc.json"
    temporary = target.with_suffix(".enc.json.tmp")
    try:
        temporary.write_bytes(encrypt(plaintext, key))
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    git("add", "--", "data/posts.enc.json")
    git("commit", "-m", "Update encrypted posts")

    for attempt in range(3):
        try:
            git("push", "origin", "main")
            print("Encrypted posts uploaded to GitHub.")
            return
        except subprocess.CalledProcessError:
            if attempt == 2:
                raise
            print("GitHub changed during upload; syncing and retrying...")
            git("pull", "--rebase", "origin", "main")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate local posts and key without uploading")
    args = parser.parse_args()
    try:
        if args.check:
            key = load_key()
            plaintext = validate_posts()
            if not check_encrypted(plaintext, key):
                print("Local posts differ from the encrypted file; run ./upload-posts to upload.")
                return 1
            else:
                print("Local posts match the encrypted file.")
        else:
            upload()
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"Upload stopped: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
