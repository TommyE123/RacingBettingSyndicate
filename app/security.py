"""Password hashing and session tokens, using only the standard library."""

import base64
import hashlib
import hmac
import secrets

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_KEY_LENGTH = 32
_FIELD_COUNT = 6


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_KEY_LENGTH
    )
    encoded = (base64.b64encode(part).decode() for part in (salt, key))
    return "$".join(["scrypt", str(_SCRYPT_N), str(_SCRYPT_R), str(_SCRYPT_P), *encoded])


def verify_password(password: str, stored: str) -> bool:
    try:
        fields = stored.split("$")
        if len(fields) != _FIELD_COUNT or fields[0] != "scrypt":
            return False
        n, r, p = (int(value) for value in fields[1:4])
        salt = base64.b64decode(fields[4])
        expected = base64.b64decode(fields[5])
        key = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=len(expected))
    except ValueError:
        return False
    return hmac.compare_digest(key, expected)


# Verified against when the username is unknown, so both failures cost the same time.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
