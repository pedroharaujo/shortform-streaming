from __future__ import annotations

from django.db import models


class EntitlementSource(models.TextChoices):
    STAFF = "staff", "Staff"
    REWARDED_AD = "rewarded_ad", "Rewarded ad"


class EpisodeEntitlement(models.Model):
    """One entitlement row per (user profile, episode). No playback URL, no expiry.

    Staff and tests grant with source=staff. rewarded_ad is stored for P3 and is
    never written by a public API in this slice.
    """

    user_profile = models.ForeignKey(
        "accounts.UserProfile",
        on_delete=models.CASCADE,
        related_name="episode_entitlements",
    )
    episode = models.ForeignKey(
        "catalog.Episode",
        on_delete=models.CASCADE,
        related_name="entitlements",
    )
    source = models.CharField(
        max_length=32,
        choices=EntitlementSource.choices,
        default=EntitlementSource.STAFF,
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user_profile", "episode"),
                name="entitlements_episodeentitlement_unique_profile_episode",
            ),
        ]
        ordering = ("-granted_at", "id")

    def __str__(self) -> str:
        return f"{self.user_profile_id} · {self.episode_id} · {self.source}"
