from __future__ import annotations

import hashlib
from typing import Any

from django.db import models

from apps.catalog.public_ids import generate_public_id

USER_PROFILE_PUBLIC_ID_PREFIX = "usr"


class UserProfile(models.Model):
    """Local profile keyed by a verified Firebase UID.

    `firebase_uid` is never serialized on the public API. Clients receive only
    `public_id` and timestamps. Identity is taken from a verified ID token, not
    from client-supplied user or profile identifiers.
    """

    public_id = models.CharField(max_length=40, unique=True, editable=False)
    firebase_uid = models.CharField(
        max_length=128,
        unique=True,
        editable=False,
        help_text="Firebase Authentication UID. Never exposed on the public API.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    locale = models.CharField(max_length=2, default="en", db_default="en")
    country = models.CharField(max_length=2, blank=True, default="", db_default="")
    analytics_consent = models.BooleanField(default=False, db_default=False)
    ads_consent = models.BooleanField(default=False, db_default=False)
    consent_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "user profile"
        verbose_name_plural = "user profiles"

    def __str__(self) -> str:
        return self.public_id

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.public_id:
            self.public_id = generate_public_id(USER_PROFILE_PUBLIC_ID_PREFIX)
        super().save(*args, **kwargs)

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


def deletion_fingerprint(firebase_uid: str) -> str:
    """Stable pseudonym for replay prevention, independent of rotating Django keys."""
    return hashlib.sha256(f"account-deletion:v1:{firebase_uid}".encode()).hexdigest()


class AccountDeletion(models.Model):
    """Durable deletion receipt; raw UID is erased after Firebase cleanup.

    The fingerprint is pseudonymous security data, not anonymous data. Production
    retention remains subject to D-020. Never log this row or provider errors.
    """

    public_id = models.CharField(max_length=40, unique=True, editable=False)
    uid_fingerprint = models.CharField(max_length=64, unique=True, editable=False)
    firebase_uid = models.CharField(max_length=128, blank=True, editable=False)
    status = models.CharField(
        max_length=10,
        choices=[("pending", "Pending"), ("completed", "Completed")],
        default="pending",
        db_index=True,
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return self.public_id

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.public_id:
            self.public_id = generate_public_id("del")
        super().save(*args, **kwargs)
