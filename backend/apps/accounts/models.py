from __future__ import annotations

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
