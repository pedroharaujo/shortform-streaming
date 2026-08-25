from __future__ import annotations

from django.db import IntegrityError, transaction

from apps.accounts.models import UserProfile

_UID_MAX_LENGTH = 128


def get_or_create_profile(firebase_uid: str) -> UserProfile:
    """Return the unique profile for a verified Firebase UID.

    Concurrent first inserts for the same UID converge on one row via the unique
    constraint and IntegrityError retry. The UID must already be verified.
    """
    uid = firebase_uid.strip()
    if not uid or len(uid) > _UID_MAX_LENGTH:
        raise ValueError("firebase_uid is invalid")

    existing = UserProfile.objects.filter(firebase_uid=uid).first()
    if existing is not None:
        return existing
    try:
        with transaction.atomic():
            return UserProfile.objects.create(firebase_uid=uid)
    except IntegrityError:
        return UserProfile.objects.get(firebase_uid=uid)
