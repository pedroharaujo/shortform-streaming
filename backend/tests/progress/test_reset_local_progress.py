from __future__ import annotations

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.progress.models import WatchProgress
from tests.catalog.builders import make_published_title

DEVICE_A = "11111111-2222-4333-8444-555555555555"


@pytest.mark.django_db
def test_reset_local_progress_refuses_when_debug_is_false() -> None:
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    WatchProgress.objects.create(device_id=DEVICE_A, episode=episode, position_seconds=12)
    with override_settings(DEBUG=False):
        with pytest.raises(CommandError, match="DEBUG"):
            call_command("reset_local_progress")
    assert WatchProgress.objects.count() == 1


@pytest.mark.django_db
def test_reset_local_progress_deletes_rows_when_debug() -> None:
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    WatchProgress.objects.create(device_id=DEVICE_A, episode=episode, position_seconds=12)
    with override_settings(DEBUG=True):
        call_command("reset_local_progress")
    assert WatchProgress.objects.count() == 0
