from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q


class EntitlementSource(models.TextChoices):
    STAFF = "staff", "Staff"
    REWARDED_AD = "rewarded_ad", "Rewarded ad"


class EpisodeEntitlement(models.Model):
    """Permanent, server-authoritative account unlock for one episode."""

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


class AccessPolicy(models.Model):  # noqa: DJ008
    """Dormant legacy rows retained only for safe cascaded deletion."""

    series = models.ForeignKey(
        "catalog.Series", on_delete=models.CASCADE, related_name="access_policies"
    )
    episode = models.ForeignKey(
        "catalog.Episode",
        on_delete=models.CASCADE,
        related_name="access_policies",
        null=True,
        blank=True,
        help_text="Empty = series-wide policy. Set = episode override.",
    )
    free_episode_order_max = models.PositiveIntegerField(
        default=5,
        help_text=(
            "Series-wide: 1-based max Episode.order treated as free per season. "
            "Ignored on episode override rows; the series-level value (or D-006 default) applies."
        ),
    )
    rewarded_ad_enabled = models.BooleanField(
        default=True,
        help_text=(
            "Series-wide: whether rewarded-ad offers may appear. "
            "Ignored on episode override rows; the series-level value (or D-006 default) applies."
        ),
    )
    force_free = models.BooleanField(
        default=False,
        help_text="Episode override only: treat as free regardless of order.",
    )
    force_lock = models.BooleanField(
        default=False,
        help_text="Episode override only: skip the free window (entitlement still grants).",
    )
    coin_unlock_enabled = models.BooleanField(default=False)
    subscription_unlock_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("series",),
                condition=Q(episode__isnull=True),
                name="entitlements_accesspolicy_unique_series_level",
            ),
            models.UniqueConstraint(
                fields=("episode",),
                condition=Q(episode__isnull=False),
                name="entitlements_accesspolicy_unique_episode",
            ),
            models.CheckConstraint(
                condition=Q(coin_unlock_enabled=False),
                name="entitlements_accesspolicy_coins_disabled_mvp",
            ),
            models.CheckConstraint(
                condition=Q(subscription_unlock_enabled=False),
                name="entitlements_accesspolicy_subscription_disabled_mvp",
            ),
            models.CheckConstraint(
                condition=~(Q(force_free=True) & Q(force_lock=True)),
                name="entitlements_accesspolicy_not_force_free_and_lock",
            ),
            models.CheckConstraint(
                condition=Q(episode__isnull=False) | (Q(force_free=False) & Q(force_lock=False)),
                name="entitlements_accesspolicy_series_level_no_force_flags",
            ),
        ]
        ordering = ("series_id", "episode_id", "id")


class AccessPolicyRevision(models.Model):  # noqa: DJ008
    """Dormant legacy audit rows retained only for safe cascaded deletion."""

    policy = models.ForeignKey(AccessPolicy, on_delete=models.CASCADE, related_name="revisions")
    series = models.ForeignKey("catalog.Series", on_delete=models.CASCADE)
    episode = models.ForeignKey("catalog.Episode", on_delete=models.CASCADE, null=True, blank=True)
    free_episode_order_max = models.PositiveIntegerField()
    rewarded_ad_enabled = models.BooleanField()
    force_free = models.BooleanField()
    force_lock = models.BooleanField()
    coin_unlock_enabled = models.BooleanField()
    subscription_unlock_enabled = models.BooleanField()
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="access_policy_revisions",
    )

    class Meta:
        ordering = ("-changed_at", "-id")
