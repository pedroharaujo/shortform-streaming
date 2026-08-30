from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.progress.models import WatchProgress


class Command(BaseCommand):
    help = (
        "Delete all WatchProgress rows. Local/DEBUG only. Use to re-run player "
        "observation from a clean resume state. Does not delete device ids on the phone."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        del args, options
        if not settings.DEBUG:
            raise CommandError("Refusing to delete watch progress when DEBUG is false.")
        deleted, _details = WatchProgress.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} watch progress row(s)."))
