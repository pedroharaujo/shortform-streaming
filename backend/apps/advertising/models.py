from __future__ import annotations

import secrets
import uuid

from django.db import models


def opaque_binding() -> str:
    return secrets.token_urlsafe(32)


class RewardIntent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_profile = models.ForeignKey("accounts.UserProfile", on_delete=models.CASCADE)
    episode = models.ForeignKey("catalog.Episode", on_delete=models.CASCADE)
    request_id = models.UUIDField()
    custom_data = models.CharField(max_length=64, default=opaque_binding, unique=True)
    ssv_user_id = models.CharField(max_length=64, default=opaque_binding)
    # Kept only until the later destructive schema contraction. These fixed
    # defaults satisfy the original NOT NULL columns without accepting market
    # context from the Android client.
    territory = models.CharField(max_length=2, default="FR", editable=False)
    platform = models.CharField(max_length=7, default="android", editable=False)
    language = models.CharField(max_length=2, default="en", editable=False)
    ad_unit_id = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    granted_at = models.DateTimeField(null=True, blank=True)
    # Only verified minimal facts; no raw callback, signature or reward payload.
    provider_transaction_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    provider_timestamp = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user_profile", "request_id"], name="reward_request_unique"
            )
        ]

    def __str__(self) -> str:
        return str(self.id)
