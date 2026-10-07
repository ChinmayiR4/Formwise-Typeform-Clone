import secrets
import string

_ALPHABET = string.ascii_letters + string.digits


def new_id(length: int = 12) -> str:
    """Short random id for questions / choices / logic rules."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def new_slug() -> str:
    """Public form id used in the share link (like typeform's /to/AbCd1234)."""
    return new_id(8)


def new_token() -> str:
    return secrets.token_urlsafe(24)
