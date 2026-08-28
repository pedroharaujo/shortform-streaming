from __future__ import annotations

from django.db import IntegrityError, models, transaction
from django.db.models import Q

from apps.accounts.models import UserProfile
from apps.catalog.models import Episode

COMPLETION_RATIO = 0.95


class WatchProgress(models.Model):
    """Resume position and completion for one subject (profile or device) per episode.

    Exactly one of user_profile or device_id is set. Anonymous device ids are
    client-generated UUIDs, never a user id or Firebase UID. No Admin. Django
    never stores or returns a playback URL here.
    """

    user_profile = models.ForeignKey(
        "accounts.UserProfile",
        on_delete=models.CASCADE,
        related_name="watch_progress",
        null=True,
        blank=True,
    )
    device_id = models.CharField(max_length=36, null=True, blank=True)  # noqa: DJ001
    episode = models.ForeignKey(
        "catalog.Episode",
        on_delete=models.CASCADE,
        related_name="watch_progress",
    )
    position_seconds = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user_profile", "episode"),
                condition=Q(user_profile__isnull=False),
                name="progress_watchprogress_unique_user_episode",
            ),
            models.UniqueConstraint(
                fields=("device_id", "episode"),
                condition=Q(device_id__isnull=False),
                name="progress_watchprogress_unique_device_episode",
            ),
            models.CheckConstraint(
                condition=(
                    Q(user_profile__isnull=False, device_id__isnull=True)
                    | Q(user_profile__isnull=True, device_id__isnull=False)
                ),
                name="progress_watchprogress_subject_xor",
            ),
        ]
        ordering = ("-updated_at", "id")

    def __str__(self) -> str:
        subject = self.user_profile_id or self.device_id
        return f"{subject} · {self.episode_id}"


def clamp_position_seconds(position_seconds: int, duration_seconds: int) -> int:
    if duration_seconds < 0:
        duration_seconds = 0
    if position_seconds < 0:
        return 0
    if position_seconds > duration_seconds:
        return duration_seconds
    return position_seconds


def resolve_completed(
    *,
    position_seconds: int,
    duration_seconds: int,
    client_completed: bool,
    already_completed: bool,
) -> bool:
    if already_completed or client_completed:
        return True
    if duration_seconds <= 0:
        return False
    return position_seconds >= duration_seconds * COMPLETION_RATIO


def upsert_watch_progress(
    *,
    episode: Episode,
    user_profile: UserProfile | None,
    device_id: str | None,
    position_seconds: int,
    completed: bool,
) -> WatchProgress:
    """Natural-key upsert. Last write wins for position; completed is sticky.

    Concurrent inserts of the same subject+episode keep one row.
    """
    if (user_profile is None) == (device_id is None):
        raise ValueError("Exactly one of user_profile or device_id is required.")

    clamped = clamp_position_seconds(position_seconds, episode.duration_seconds)
    lookup: dict[str, object] = {"episode": episode}
    create_defaults: dict[str, object] = {
        "position_seconds": clamped,
        "completed": resolve_completed(
            position_seconds=clamped,
            duration_seconds=episode.duration_seconds,
            client_completed=completed,
            already_completed=False,
        ),
    }
    if user_profile is not None:
        lookup["user_profile"] = user_profile
        create_defaults["device_id"] = None
    else:
        lookup["device_id"] = device_id
        create_defaults["user_profile"] = None

    existing = WatchProgress.objects.filter(**lookup).first()
    if existing is not None:
        existing.position_seconds = clamped
        existing.completed = resolve_completed(
            position_seconds=clamped,
            duration_seconds=episode.duration_seconds,
            client_completed=completed,
            already_completed=existing.completed,
        )
        existing.save(update_fields=["position_seconds", "completed", "updated_at"])
        return existing

    try:
        with transaction.atomic():
            return WatchProgress.objects.create(**lookup, **create_defaults)
    except IntegrityError:
        pass

    row = WatchProgress.objects.get(**lookup)
    row.position_seconds = clamped
    row.completed = resolve_completed(
        position_seconds=clamped,
        duration_seconds=episode.duration_seconds,
        client_completed=completed,
        already_completed=row.completed,
    )
    row.save(update_fields=["position_seconds", "completed", "updated_at"])
    return row
