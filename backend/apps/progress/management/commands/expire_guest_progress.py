from __future__ import annotations

from argparse import ArgumentParser
from calendar import monthrange
from datetime import UTC
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.progress.models import WatchProgress


class Command(BaseCommand):
    help = (
        "Preview one bounded batch of guest progress last saved at least 12 calendar "
        "months ago. --apply deletes that batch; signed-in and financial data are excluded."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args: Any, **options: Any) -> None:
        limit = int(options["limit"])
        if not 1 <= limit <= 1000:
            raise CommandError("Limit must be between 1 and 1000.")

        now = timezone.now().astimezone(UTC)
        cutoff = now.replace(
            year=now.year - 1,
            day=min(now.day, monthrange(now.year - 1, now.month)[1]),
        )
        eligible = WatchProgress.objects.filter(
            user_profile__isnull=True,
            device_id__isnull=False,
            updated_at__lte=cutoff,
        ).order_by("updated_at", "pk")

        if not options["apply"]:
            count = len(list(eligible.values_list("pk", flat=True)[:limit]))
            self.stdout.write(
                f"Preview: {count} guest progress row(s) in this batch; "
                f"cutoff: {cutoff.isoformat()}. No rows deleted."
            )
            return

        # Coordinate with progress writers and other cleanup workers. Never
        # read identifiers into logs or block a user's active progress write.
        with transaction.atomic():
            ids = list(
                eligible.select_for_update(skip_locked=True).values_list("pk", flat=True)[:limit]
            )
            deleted, _ = eligible.filter(pk__in=ids).delete()
        self.stdout.write(
            f"Deleted: {deleted} guest progress row(s) in this batch; "
            f"cutoff: {cutoff.isoformat()}. Locked rows skipped."
        )
