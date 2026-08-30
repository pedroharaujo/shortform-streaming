from __future__ import annotations

from django.db import connection, transaction

from apps.accounts.exceptions import TokenFailure, TokenVerificationError
from apps.accounts.models import AccountDeletion, UserProfile, deletion_fingerprint

_UID_MAX_LENGTH = 128


def lock_account_identity(firebase_uid: str) -> None:
    """Serialize creation/deletion even when no profile row exists yet.

    Caller must hold an atomic transaction. PostgreSQL releases the lock at
    commit/rollback. Hash collisions only serialize unrelated users briefly.
    """
    key = int.from_bytes(bytes.fromhex(deletion_fingerprint(firebase_uid))[:8], signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])


def get_or_create_profile(firebase_uid: str) -> UserProfile:
    """Return the unique profile for a verified Firebase UID.

    A transaction lock serializes first inserts with deletion, including when no
    profile exists. The UID must already be verified.
    """
    uid = firebase_uid.strip()
    if not uid or len(uid) > _UID_MAX_LENGTH:
        raise ValueError("firebase_uid is invalid")

    fingerprint = deletion_fingerprint(uid)
    with transaction.atomic():
        lock_account_identity(uid)
        if AccountDeletion.objects.filter(uid_fingerprint=fingerprint).exists():
            raise TokenVerificationError(TokenFailure.REVOKED)
        profile, _ = UserProfile.objects.select_for_update().get_or_create(firebase_uid=uid)
        return profile
