import base64
import json
import os

import pytest

from posts_crypto import decrypt, encrypt, key_from_environment


DOCUMENT = b'{"timezone":"Asia/Shanghai","posts":[{"content":"hello"}]}'


def test_roundtrip_preserves_original_bytes_and_hides_metadata():
    key = os.urandom(32)
    encrypted = encrypt(DOCUMENT, key)
    envelope = json.loads(encrypted)
    assert set(envelope) == {"version", "algorithm", "nonce", "ciphertext"}
    assert DOCUMENT not in encrypted
    assert decrypt(encrypted, key) == DOCUMENT
    assert json.loads(encrypt(DOCUMENT, key))["nonce"] != envelope["nonce"]


def test_wrong_key_fails_authentication():
    encrypted = encrypt(DOCUMENT, os.urandom(32))
    with pytest.raises(ValueError, match="authentication failed"):
        decrypt(encrypted, os.urandom(32))


@pytest.mark.parametrize("field", ["ciphertext", "nonce"])
def test_modified_encrypted_data_fails_authentication(field):
    key = os.urandom(32)
    envelope = json.loads(encrypt(DOCUMENT, key))
    value = bytearray(base64.b64decode(envelope[field]))
    value[0] ^= 1
    envelope[field] = base64.b64encode(value).decode()
    with pytest.raises(ValueError, match="authentication failed"):
        decrypt(json.dumps(envelope).encode(), key)


@pytest.mark.parametrize("data", [b"not JSON", b"{}", b'[]'])
def test_malformed_envelope_fails(data):
    with pytest.raises(ValueError):
        decrypt(data, os.urandom(32))


def test_invalid_base64_fails():
    key = os.urandom(32)
    envelope = json.loads(encrypt(DOCUMENT, key))
    envelope["ciphertext"] = "@@@"
    with pytest.raises(ValueError, match="encoding"):
        decrypt(json.dumps(envelope).encode(), key)


def test_missing_or_invalid_environment_key_fails(monkeypatch):
    monkeypatch.delenv("POSTS_ENCRYPTION_KEY", raising=False)
    with pytest.raises(ValueError, match="environment variable is not set"):
        key_from_environment()
    monkeypatch.setenv("POSTS_ENCRYPTION_KEY", "@@@")
    with pytest.raises(ValueError, match="encoding"):
        key_from_environment()
    monkeypatch.setenv("POSTS_ENCRYPTION_KEY", base64.b64encode(b"short").decode())
    with pytest.raises(ValueError, match="32 bytes"):
        key_from_environment()


def test_invalid_decrypted_json_fails():
    with pytest.raises(ValueError, match="valid JSON"):
        encrypt(b"not JSON", os.urandom(32))
