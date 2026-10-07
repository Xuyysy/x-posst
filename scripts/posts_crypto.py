"""Versioned AES-GCM envelope for the complete posts JSON document."""

import base64
import binascii
import json
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _decode_base64(value: object, field: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError(f"Invalid {field} encoding.")
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"Invalid {field} encoding.") from exc


def key_from_environment() -> bytes:
    value = os.environ.get("POSTS_ENCRYPTION_KEY")
    if not value:
        raise ValueError("POSTS_ENCRYPTION_KEY environment variable is not set.")
    key = _decode_base64(value, "POSTS_ENCRYPTION_KEY")
    if len(key) != 32:
        raise ValueError("POSTS_ENCRYPTION_KEY must decode to 32 bytes.")
    return key


def _validate_json(data: bytes) -> None:
    try:
        document = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Posts configuration is not valid JSON.") from exc
    if not isinstance(document, dict):
        raise ValueError("Posts configuration must be a JSON object.")


def encrypt(data: bytes, key: bytes) -> bytes:
    if len(key) != 32:
        raise ValueError("Encryption key must be 32 bytes.")
    _validate_json(data)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, data, None)
    envelope = {
        "version": 1,
        "algorithm": "AES-256-GCM",
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }
    return (json.dumps(envelope, indent=2) + "\n").encode("utf-8")


def decrypt(data: bytes, key: bytes) -> bytes:
    if len(key) != 32:
        raise ValueError("Encryption key must be 32 bytes.")
    try:
        envelope = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Encrypted posts file is not valid JSON.") from exc
    if not isinstance(envelope, dict) or set(envelope) != {"version", "algorithm", "nonce", "ciphertext"}:
        raise ValueError("Invalid encrypted posts file format.")
    if type(envelope["version"]) is not int or envelope["version"] != 1 or envelope["algorithm"] != "AES-256-GCM":
        raise ValueError("Unsupported encrypted posts file version or algorithm.")
    nonce = _decode_base64(envelope["nonce"], "nonce")
    ciphertext = _decode_base64(envelope["ciphertext"], "ciphertext")
    if len(nonce) != 12 or len(ciphertext) < 16:
        raise ValueError("Invalid encrypted posts file format.")
    try:
        plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    except InvalidTag as exc:
        raise ValueError("Posts decryption authentication failed.") from exc
    _validate_json(plaintext)
    return plaintext
