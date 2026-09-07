from __future__ import annotations

import pytest
from django.test import override_settings

from apps.catalog.eligibility import eligible_series_queryset
from tests.catalog.builders import make_published_title


@pytest.mark.django_db
@pytest.mark.parametrize(
    "context",
    [
        None,
        {},
        {"enabled": False},
        {
            "enabled": True,
            "country": "FR",
            "platform": "ios",
            "storefront": "google_play",
            "language": "en",
        },
    ],
)
def test_inactive_or_invalid_server_context_hides_owned_catalog(context: object) -> None:
    make_published_title(title="Synthetic context fixture")
    with override_settings(CATALOG_LAUNCH_CONTEXT=context):
        assert not eligible_series_queryset().exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "permission",
    [
        "free_access_permission",
        "rewarded_ad_permission",
        "coin_access_permission",
        "paid_promotion_permission",
    ],
)
def test_missing_explicit_permission_denies_licensed_catalog(permission: str) -> None:
    from tests.catalog.builders import make_published_licensed_title

    series, _ = make_published_licensed_title(title="Synthetic permission fixture")
    right = series.rights.get()
    setattr(right, permission, False)
    right.save()
    assert not eligible_series_queryset().filter(pk=series.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "scope"),
    [
        ("distribution_territories", ["DE"]),
        ("distribution_platforms", ["ios"]),
        ("distribution_storefronts", ["app_store"]),
        ("distribution_languages", ["fr"]),
    ],
)
def test_series_scope_constrains_self_owned_catalog(field: str, scope: list[str]) -> None:
    series, _ = make_published_title(title="Synthetic narrow distribution")
    setattr(series, field, scope)
    series.save()
    assert not eligible_series_queryset().filter(pk=series.pk).exists()


@pytest.mark.django_db
def test_publication_requires_current_admission() -> None:
    from datetime import timedelta

    from django.core.exceptions import ValidationError
    from django.utils import timezone

    from apps.catalog.models import PublicationStatus
    from tests.catalog.builders import make_right, make_series

    series = make_series(self_owned=False)
    make_right(series, starts_at=timezone.now() + timedelta(days=1))
    series.publication_status = PublicationStatus.PUBLISHED
    assert not series.is_publishable()
    with pytest.raises(ValidationError):
        series.full_clean()


@pytest.mark.django_db
def test_supplemental_metadata_does_not_override_direct_english() -> None:
    from apps.catalog.models import SeriesTranslation
    from apps.catalog.serializers import serialize_series_card

    series, _ = make_published_title(title="Current English")
    SeriesTranslation.objects.create(
        series=series, language="en", title="Stale English", synopsis="Stale"
    )
    SeriesTranslation.objects.create(
        series=series, language="fr", title="Titre synthetique", synopsis="Synopsis synthetique"
    )
    assert serialize_series_card(series)["title"] == "Current English"
    with override_settings(
        CATALOG_LAUNCH_CONTEXT={
            "enabled": True,
            "country": "FR",
            "platform": "android",
            "storefront": "google_play",
            "language": "fr",
        }
    ):
        assert serialize_series_card(series)["title"] == "Titre synthetique"


@pytest.mark.django_db
def test_episode_publication_rechecks_actual_caption_rights() -> None:
    from django.core.exceptions import ValidationError

    from apps.catalog.models import PublicationStatus
    from tests.catalog.builders import make_episode, make_ready_media_asset, make_right, make_series

    series = make_series(self_owned=False)
    make_right(series)
    episode = make_episode(series)
    asset = make_ready_media_asset(episode)
    asset.captions_language = "fr"
    asset.save(update_fields=["captions_language"])
    episode.publication_status = PublicationStatus.PUBLISHED
    with pytest.raises(ValidationError):
        episode.full_clean()


@pytest.mark.django_db
def test_grant_validation_rejects_non_string_array_items() -> None:
    from django.core.exceptions import ValidationError

    from tests.catalog.builders import make_right, make_series

    right = make_right(make_series(self_owned=False))
    right.territory_allowlist = [None]  # type: ignore[list-item]
    with pytest.raises(ValidationError):
        right.clean()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("enabled", "true"),
        ("country", "France"),
        ("country", 1),
        ("country", "12"),
        ("country", "ZZ"),
        ("platform", "web"),
        ("storefront", "unknown"),
        ("language", "english"),
        ("language", "zz"),
        ("language", None),
        ("audience_segment", ""),
        ("audience_segment", ["synthetic"]),
    ],
)
def test_malformed_context_is_unavailable(field: str, value: object) -> None:
    from apps.catalog.context import resolve_launch_context

    context = dict(
        enabled=True, country="FR", platform="android", storefront="google_play", language="en"
    )
    context[field] = value
    with override_settings(CATALOG_LAUNCH_CONTEXT=context):
        assert resolve_launch_context() is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("storefronts", []),
        ("storefronts", ["app_store"]),
        ("storefronts", ["google_play", "invalid"]),
        ("original_languages", []),
        ("original_languages", ["fr"]),
        ("original_languages", ["en", "12"]),
        ("subtitle_languages", ["en", "12"]),
        ("dub_languages", ["12"]),
        ("revenue_share_rule_reference", " "),
        ("territory_denylist", ["12"]),
    ],
)
def test_new_license_scope_denies_malformed_or_missing_grants(field: str, value: object) -> None:
    from apps.catalog.eligibility import series_is_admitted
    from tests.catalog.builders import make_published_licensed_title

    series, _ = make_published_licensed_title(title="Synthetic grant scope")
    series.rights.update(**{field: value})
    assert not series_is_admitted(series)
    assert not eligible_series_queryset().filter(pk=series.pk).exists()


@pytest.mark.django_db
def test_partial_permissions_and_captions_cannot_be_combined_across_grants() -> None:
    from apps.catalog.eligibility import series_is_admitted
    from tests.catalog.builders import make_right, make_series

    series = make_series(self_owned=False)
    first = make_right(series)
    second = make_right(series, contract_reference="synthetic-second-grant")
    first.coin_access_permission = False
    first.save()
    second.free_access_permission = False
    second.save()
    assert not series_is_admitted(series)
    first.coin_access_permission = True
    first.save()
    second.subtitle_languages = ["en", "fr"]
    second.languages = ["en", "fr"]
    second.save()
    assert series_is_admitted(series)
    assert not series_is_admitted(series, captions_language="fr")


@pytest.mark.django_db
def test_optional_segment_requires_an_explicit_association_when_selected() -> None:
    from apps.catalog.eligibility import series_is_admitted
    from apps.catalog.models import ContentSegment
    from tests.catalog.builders import make_series

    series = make_series()
    context = dict(
        enabled=True,
        country="FR",
        platform="android",
        storefront="google_play",
        language="en",
        audience_segment="synthetic-segment",
    )
    assert series_is_admitted(series)
    with override_settings(CATALOG_LAUNCH_CONTEXT=context):
        assert not series_is_admitted(series)
        segment = ContentSegment.objects.create(slug="synthetic-segment", name="Synthetic segment")
        series.content_segments.add(segment)
        assert series_is_admitted(series)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("territory_allowlist", ["FR", "ZZ"]),
        ("territory_denylist", ["ZZ"]),
        ("languages", ["en", "zz"]),
        ("original_languages", ["en", "zz"]),
        ("subtitle_languages", ["en", "zz"]),
        ("dub_languages", ["zz"]),
    ],
)
def test_unassigned_license_codes_deny_validation_and_admission(
    field: str, value: list[str]
) -> None:
    from django.core.exceptions import ValidationError

    from apps.catalog.eligibility import series_is_admitted
    from tests.catalog.builders import make_published_licensed_title

    series, _ = make_published_licensed_title(title="Synthetic invalid ISO grant")
    series.rights.update(**{field: value})
    with pytest.raises(ValidationError):
        series.rights.get().clean()
    assert not series_is_admitted(series)
    assert not eligible_series_queryset().filter(pk=series.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("distribution_territories", ["FR", "ZZ"]),
        ("distribution_languages", ["en", "zz"]),
        ("original_language", "zz"),
    ],
)
def test_unassigned_series_codes_deny_validation_and_admission(field: str, value: object) -> None:
    from django.core.exceptions import ValidationError

    from apps.catalog.eligibility import series_is_admitted

    series, _ = make_published_title(title="Synthetic invalid ISO series")
    type(series).objects.filter(pk=series.pk).update(**{field: value})
    series.refresh_from_db()
    with pytest.raises(ValidationError):
        series.clean()
    assert not series_is_admitted(series)
    assert not eligible_series_queryset().filter(pk=series.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(("country", "language"), [("JP", "ja"), ("TW", "zh"), ("AX", "sv")])
def test_assigned_future_scope_can_be_admitted_without_changing_launch_defaults(
    country: str,
    language: str,
) -> None:
    from apps.catalog.eligibility import series_is_admitted
    from apps.catalog.models import SeriesTranslation
    from tests.catalog.builders import make_published_licensed_title

    series, _ = make_published_licensed_title(title="Synthetic future ISO scope")
    series.distribution_territories = [country]
    series.distribution_languages = [language]
    series.original_language = language
    series.save()
    series.rights.update(
        territory_allowlist=[country], languages=[language], original_languages=[language]
    )
    SeriesTranslation.objects.create(
        series=series,
        language=language,
        title="Synthetic translation",
        synopsis="Synthetic synopsis",
    )
    with override_settings(
        CATALOG_LAUNCH_CONTEXT=dict(
            enabled=True,
            country=country,
            platform="android",
            storefront="google_play",
            language=language,
        )
    ):
        series.clean()
        series.rights.get().clean()
        assert series_is_admitted(series)
        assert eligible_series_queryset().filter(pk=series.pk).exists()
        assert not series_is_admitted(series, captions_language="zz")
    assert not series_is_admitted(series)
