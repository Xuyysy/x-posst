"""Print a new 256-bit key for copying to GitHub Actions Secrets."""

import base64
import os


if __name__ == "__main__":
    print("POSTS_ENCRYPTION_KEY=" + base64.b64encode(os.urandom(32)).decode("ascii"))
