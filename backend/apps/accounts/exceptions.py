from __future__ import annotations

from enum import StrEnum


class TokenFailure(StrEnum):
    MALFORMED = "malformed"
    EXPIRED = "expired"
    REVOKED = "revoked"
    UNVERIFIABLE = "unverifiable"


class TokenVerificationError(Exception):
    """Failed Firebase ID-token verification. Messages must never include the token."""

    def __init__(self, failure: TokenFailure) -> None:
        self.failure = failure
        super().__init__(failure.value)
