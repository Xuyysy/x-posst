"""Encrypt the local posts document without deleting the editable plaintext."""

from pathlib import Path
import sys

from posts_crypto import encrypt, key_from_environment


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "posts.json"
TARGET = ROOT / "data" / "posts.enc.json"


def main() -> int:
    try:
        key = key_from_environment()
        if not SOURCE.is_file():
            raise ValueError("data/posts.json does not exist.")
        encrypted = encrypt(SOURCE.read_bytes(), key)
        temporary = TARGET.with_suffix(".enc.json.tmp")
        try:
            temporary.write_bytes(encrypted)
            temporary.replace(TARGET)
        finally:
            temporary.unlink(missing_ok=True)
    except (OSError, ValueError) as exc:
        print(f"Encryption failed: {exc}", file=sys.stderr)
        return 1
    print("Encrypted posts written to data/posts.enc.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
