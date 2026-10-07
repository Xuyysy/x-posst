"""Decrypt an encrypted posts document to a caller-selected temporary path."""

import argparse
import os
from pathlib import Path
import sys
import tempfile

from posts_crypto import decrypt, key_from_environment


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("data/posts.enc.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    temporary = None
    try:
        key = key_from_environment()
        plaintext = decrypt(args.input.read_bytes(), key)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        if args.output.exists():
            raise ValueError("Output file already exists.")
        with tempfile.NamedTemporaryFile("wb", dir=args.output.parent, prefix=".posts-", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(plaintext)
        os.replace(temporary, args.output)
    except (OSError, ValueError) as exc:
        print(f"Decryption failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print("Posts configuration decrypted successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
