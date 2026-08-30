from __future__ import annotations

from argparse import ArgumentParser
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.lifecycle import process_account_deletion
from apps.accounts.models import AccountDeletion


class Command(BaseCommand):
    help = "Retry pending account deletions without printing identity or provider data."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args: Any, **options: Any) -> None:
        limit = int(options["limit"])
        if not 1 <= limit <= 1000:
            raise CommandError("Limit must be between 1 and 1000.")
        ids = list(
            AccountDeletion.objects.filter(status="pending")
            .order_by("requested_at")
            .values_list("public_id", flat=True)[:limit]
        )
        completed = sum(
            process_account_deletion(public_id).status == "completed" for public_id in ids
        )
        pending = AccountDeletion.objects.filter(status="pending").count()
        self.stdout.write(f"Processed: {len(ids)}; completed: {completed}; pending: {pending}.")
        if pending:
            raise CommandError(
                "Pending account deletions require retry and operator investigation."
            )
