from __future__ import annotations

import pytest
from django.core.management import call_command

from apps.catalog.models import Episode, PublicationStatus, Series


@pytest.mark.django_db
def test_seed_creates_exactly_one_idempotent_self_owned_series() -> None:
    call_command("seed_catalog")
    call_command("seed_catalog")

    series = Series.objects.get()
    assert series.title == "Harbor Lights"
    assert series.self_owned is True
    assert series.promotional_use_approved is True
    assert series.publication_status == PublicationStatus.PUBLISHED
    assert Episode.objects.count() == 6
