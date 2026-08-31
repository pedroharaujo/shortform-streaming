from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Q


class EntitlementSource(models.TextChoices):
    STAFF = "staff", "Staff"
    REWARDED_AD = "rewarded_ad", "Rewarded ad"


class EpisodeEntitlement(models.Model):
    """One entitlement row per (user profile, episode). No playback URL, no expiry.

    Staff and tests grant with source=staff. The P3-T07 verified provider callback
    grants rewarded_ad. A client completion callback never writes this model.
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


class AccessPolicy(models.Model):
    """Series-level free/ad config with optional episode override.

    No row → D-006 defaults in policy.resolve_access_policy (order 1–5 free,
    rewarded ads on). Coin/subscription columns exist for P7 and must stay False.
    """

    series = models.ForeignKey(
        "catalog.Series",
        on_delete=models.CASCADE,
        related_name="access_policies",
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
    _revision_actor: Any = None

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

    def __str__(self) -> str:
        if self.episode_id:
            return f"{self.series_id} · episode {self.episode_id}"
        return f"{self.series_id} · series"

    def save(self, *args: Any, **kwargs: Any) -> None:
        episode = self.episode
        if episode is not None and not self.series_id:
            self.series_id = episode.series_id
        actor = getattr(self, "_revision_actor", None)
        with transaction.atomic():
            super().save(*args, **kwargs)
            AccessPolicyRevision.objects.create(
                policy=self,
                series=self.series,
                episode=self.episode,
                free_episode_order_max=self.free_episode_order_max,
                rewarded_ad_enabled=self.rewarded_ad_enabled,
                force_free=self.force_free,
                force_lock=self.force_lock,
                coin_unlock_enabled=self.coin_unlock_enabled,
                subscription_unlock_enabled=self.subscription_unlock_enabled,
                changed_by=actor if getattr(actor, "pk", None) else None,
            )

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.episode_id:
            episode = self.episode
            if episode is not None and episode.series_id != self.series_id:
                errors["episode"] = "Episode override must belong to the same series."
        else:
            if self.force_free or self.force_lock:
                errors["force_free"] = "force_free and force_lock are episode overrides only."
        if self.coin_unlock_enabled:
            errors["coin_unlock_enabled"] = "Coin unlock is not an MVP offer type (D-008 / P7)."
        if self.subscription_unlock_enabled:
            errors["subscription_unlock_enabled"] = (
                "Subscription unlock is not an MVP offer type (D-009 / P7)."
            )
        if self.force_free and self.force_lock:
            errors["force_lock"] = "Cannot set force_free and force_lock together."
        if errors:
            raise ValidationError(errors)


class AccessPolicyRevision(models.Model):
    """Append-only snapshot of a published (live) AccessPolicy save. No secrets."""

    policy = models.ForeignKey(
        AccessPolicy,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    series = models.ForeignKey("catalog.Series", on_delete=models.CASCADE)
    episode = models.ForeignKey(
        "catalog.Episode",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
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

    def __str__(self) -> str:
        return f"policy {self.policy_id} @ {self.changed_at}"
