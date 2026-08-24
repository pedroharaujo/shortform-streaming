from __future__ import annotations

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.catalog.eligibility import CatalogRequestContext, eligible_series_queryset
from apps.catalog.models import PublicationStatus, Series


@pytest.mark.django_db
def test_seed_catalog_is_idempotent_and_hides_draft() -> None:
    call_command("seed_catalog")
    call_command("seed_catalog")
    assert Series.objects.filter(publication_status=PublicationStatus.PUBLISHED).count() == 2
    assert Series.objects.filter(publication_status=PublicationStatus.DRAFT).count() == 1
    now = timezone.now()
    fr_ids = list(
        eligible_series_queryset(
            CatalogRequestContext(territory="FR", platform="ios", language="en"),
            now=now,
        ).values_list("public_id", flat=True)
    )
    de_ids = list(
        eligible_series_queryset(
            CatalogRequestContext(territory="DE", platform="android", language="en"),
            now=now,
        ).values_list("public_id", flat=True)
    )
    assert len(fr_ids) == 1
    assert len(de_ids) == 1
    assert set(fr_ids).isdisjoint(de_ids)
    draft = Series.objects.get(publication_status=PublicationStatus.DRAFT)
    assert draft.public_id not in fr_ids
    assert draft.public_id not in de_ids
