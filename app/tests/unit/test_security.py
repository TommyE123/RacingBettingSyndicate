import pytest

from app.security import (
    hash_password,
    hash_session_token,
    new_session_token,
    verify_password,
)


def test_password_round_trip():
    stored = hash_password("correct horse")
    assert verify_password("correct horse", stored)
    assert not verify_password("wrong horse", stored)


def test_same_password_hashes_differently_each_time():
    assert hash_password("same") != hash_password("same")


def test_hash_does_not_contain_the_password():
    assert "hunter2hunter2" not in hash_password("hunter2hunter2")


@pytest.mark.parametrize(
    "stored",
    [
        "",
        "plaintext",
        "bcrypt$1$2$3$YQ==$YQ==",
        "scrypt$x$8$1$YQ==$YQ==",
        "scrypt$16384$8$1$not-base64!$YQ==",
        "scrypt$3$8$1$YQ==$YQ==",
    ],
)
def test_malformed_stored_hash_never_verifies(stored):
    assert not verify_password("anything", stored)


def test_session_tokens_are_unique_and_hashed_deterministically():
    first, second = new_session_token(), new_session_token()
    assert first != second
    assert hash_session_token(first) == hash_session_token(first)
    assert hash_session_token(first) != hash_session_token(second)
    assert first not in hash_session_token(first)
