from __future__ import annotations

from typing import Any

import pytest
from django.apps import apps
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import RequestFactory

from apps.catalog.models import Episode
from tests.catalog.builders import make_episode, make_series


@pytest.mark.django_db
@pytest.mark.parametrize(
    "mode,price", [("coin", None), ("both", 0), ("free", 1), ("inherit", 1), ("unknown", None)]
)
def test_invalid_access_configuration_is_rejected_by_model_and_database(
    mode: str, price: int | None
) -> None:
    episode = make_episode(make_series())
    episode.access_mode = mode
    episode.coin_price = price
    with pytest.raises(ValidationError):
        episode.full_clean()
    with pytest.raises(IntegrityError), transaction.atomic():
        Episode.objects.filter(pk=episode.pk).update(access_mode=mode, coin_price=price)


@pytest.mark.django_db
def test_episode_admin_records_bounded_policy_revision(admin_user: Any) -> None:
    episode = make_episode(make_series())
    assert getattr(episode, "access_mode", None) == "inherit"
    episode.access_mode = "both"
    episode.coin_price = 7
    request = RequestFactory().post("/")
    request.user = admin_user
    with transaction.atomic():
        admin.site._registry[Episode].save_model(request, episode, None, True)
    revision_model = apps.get_model("catalog", "EditorialAccessRevision")
    revision = revision_model.objects.get()
    assert revision.before == {"access_mode": "inherit", "coin_price": None, "order": 1}
    assert revision.after == {"access_mode": "both", "coin_price": 7, "order": 1}
    assert revision.actor == admin_user
    assert revision.episode == episode
    assert len(revision.policy_version) == 64
    revision_admin = admin.site._registry[revision_model]
    assert not revision_admin.has_add_permission(request)
    assert not revision_admin.has_change_permission(request, revision)
    assert not revision_admin.has_delete_permission(request, revision)


@pytest.mark.django_db(transaction=True)
def test_catalog_lock_requires_atomic_and_refreshes_parent() -> None:
    from django.db.transaction import TransactionManagementError

    from apps.catalog import locking
    from apps.catalog.models import Series

    series = make_series()
    episode = make_episode(series)
    with pytest.raises(TransactionManagementError):
        locking.lock_episode_for_access(episode.pk)
    Series.objects.filter(pk=series.pk).update(rewarded_ads_enabled=False)
    with transaction.atomic():
        locked = locking.lock_episode_for_access(episode.pk)
        assert locked is not None
        assert locked.series.rewarded_ads_enabled is False
        assert locked.season.series_id == series.pk
        assert locking.lock_episode_for_access(999999) is None


@pytest.mark.django_db
def test_admin_rejects_ownership_changes_and_audits_series_defaults(admin_user: Any) -> None:
    from apps.catalog.models import Series
    from tests.catalog.builders import make_right, make_season

    series = make_series()
    other = make_series()
    request = RequestFactory().post("/")
    request.user = admin_user
    for obj in (make_episode(series), make_season(series), make_right(series)):
        obj.series = other
        with pytest.raises(ValidationError), transaction.atomic():
            admin.site._registry[type(obj)].save_model(request, obj, None, True)
    series.free_episode_count = 3
    with transaction.atomic():
        admin.site._registry[Series].save_model(request, series, None, True)
    revision = apps.get_model("catalog", "EditorialAccessRevision").objects.get()
    assert revision.before == {"free_episode_count": 5, "rewarded_ads_enabled": True}
    assert revision.after == {"free_episode_count": 3, "rewarded_ads_enabled": True}
    assert revision.episode_id is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("operation", ["save_episode", "save_right", "delete_right", "bulk_right"])
def test_admin_holds_series_lock_through_transaction(operation: str, admin_user: Any) -> None:
    from concurrent.futures import ThreadPoolExecutor

    from django.db import DatabaseError, connections

    from apps.catalog.models import Series
    from tests.catalog.builders import make_right

    series = make_series()
    episode = make_episode(series)
    right = make_right(series)
    request = RequestFactory().post("/")
    request.user = admin_user

    def competing_parent_lock() -> bool:
        try:
            with transaction.atomic():
                Series.objects.select_for_update(nowait=True).get(pk=series.pk)
            return False
        except DatabaseError as exc:
            return getattr(exc.__cause__, "sqlstate", None) == "55P03"
        finally:
            connections["default"].close()

    with transaction.atomic():
        if operation == "save_episode":
            episode.access_mode = "free"
            admin.site._registry[Episode].save_model(request, episode, None, True)
        elif operation == "save_right":
            right.takedown = True
            admin.site._registry[type(right)].save_model(request, right, None, True)
        elif operation == "delete_right":
            admin.site._registry[type(right)].delete_model(request, right)
        else:
            admin.site._registry[type(right)].delete_queryset(
                request, type(right).objects.filter(pk=right.pk)
            )
        with ThreadPoolExecutor(max_workers=1) as pool:
            assert pool.submit(competing_parent_lock).result(timeout=5)


@pytest.mark.django_db
@pytest.mark.parametrize("parent_type", ["series", "season"])
def test_episode_inline_updates_policy_and_audit(parent_type: str, admin_user: Any) -> None:
    from django.forms import modelform_factory

    from apps.catalog.models import Season, Series

    series = make_series()
    episode = make_episode(series)
    parent = series if parent_type == "series" else episode.season
    parent_model = Series if parent_type == "series" else Season
    request = RequestFactory().post("/")
    request.user = admin_user
    model_admin = admin.site._registry[parent_model]
    inline = next(
        item for item in model_admin.get_inline_instances(request, parent) if item.model is Episode
    )
    formset_class = inline.get_formset(request, parent)
    formset = formset_class(
        instance=parent,
        prefix="episodes",
        data={
            "episodes-TOTAL_FORMS": "1",
            "episodes-INITIAL_FORMS": "1",
            "episodes-0-id": str(episode.pk),
            "episodes-0-season": str(episode.season_id),
            "episodes-0-order": "2",
            "episodes-0-title": episode.title,
            "episodes-0-duration_seconds": "90",
            "episodes-0-publication_status": "draft",
            "episodes-0-access_mode": "both",
            "episodes-0-coin_price": "7",
        },
    )
    assert formset.is_valid(), formset.errors
    form = modelform_factory(parent_model, fields=())(instance=parent)
    with transaction.atomic():
        model_admin.save_formset(request, form, formset, True)
    episode.refresh_from_db()
    assert episode.order == 2
    assert episode.access_mode == "both"
    revision = apps.get_model("catalog", "EditorialAccessRevision").objects.get()
    assert revision.after == {"access_mode": "both", "coin_price": 7, "order": 2}
