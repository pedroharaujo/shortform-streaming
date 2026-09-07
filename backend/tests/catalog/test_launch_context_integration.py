from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import EpisodeTranslation, SeriesTranslation
from apps.entitlements.models import EntitlementSource, EpisodeEntitlement
from tests.catalog.builders import make_published_licensed_title, make_published_title

LAUNCH = {
    "enabled": True,
    "country": "FR",
    "platform": "android",
    "storefront": "google_play",
    "language": "en",
    "audience_segment": None,
}


@pytest.mark.django_db
def test_inactive_context_hides_catalog_and_denies_playback_before_provider(
    client: Client, settings: Any
) -> None:
    series, episode = make_published_title(title="Synthetic inactive title")
    settings.CATALOG_LAUNCH_CONTEXT = {**LAUNCH, "enabled": False}

    assert client.get("/v1/catalog/home").json()["rails"][0]["series"] == []
    assert client.get(f"/v1/series/{series.public_id}").status_code == 404
    assert client.get(f"/v1/episodes/{episode.public_id}").status_code == 404
    with patch("apps.playback.views.get_video_provider") as provider:
        response = client.post(f"/v1/playback/{episode.public_id}/authorize")
    assert response.status_code == 404
    provider.assert_not_called()


@pytest.mark.django_db
def test_request_targeting_cannot_select_translation_or_broaden_server_scope(
    client: Client, settings: Any
) -> None:
    settings.CATALOG_LAUNCH_CONTEXT = LAUNCH.copy()
    series, episode = make_published_title(title="Current English title")
    SeriesTranslation.objects.create(
        series=series, language="en", title="Stale English title", synopsis="Stale text"
    )
    SeriesTranslation.objects.create(
        series=series, language="de", title="Synthetic German title", synopsis="German text"
    )

    spoofed = client.get(
        f"/v1/series/{series.public_id}",
        {"country": "DE", "language": "de", "platform": "ios", "storefront": "app_store"},
        HTTP_ACCEPT_LANGUAGE="de",
        HTTP_X_COUNTRY="DE",
        HTTP_X_CATALOG_TERRITORY="DE",
        HTTP_X_STOREFRONT="app_store",
    )

    assert spoofed.status_code == 200
    assert spoofed.json()["title"] == "Current English title"
    assert spoofed.json()["id"] == series.public_id
    assert spoofed.json()["seasons"][0]["episodes"][0]["id"] == episode.public_id


@pytest.mark.django_db
def test_synthetic_alternate_language_preserves_api_shape_and_content_identity(
    client: Client, settings: Any
) -> None:
    settings.CATALOG_LAUNCH_CONTEXT = LAUNCH.copy()
    series, episode = make_published_licensed_title(title="Synthetic translated title")
    original = client.get(f"/v1/series/{series.public_id}").json()
    series.distribution_territories = ["FR", "DE"]
    series.distribution_languages = ["en", "de"]
    series.save(update_fields=["distribution_territories", "distribution_languages"])
    right = series.rights.get()
    right.territory_allowlist = ["FR", "DE"]
    right.languages = ["en", "de"]
    right.subtitle_languages = ["en", "de"]
    right.save(update_fields=["territory_allowlist", "languages", "subtitle_languages"])
    SeriesTranslation.objects.create(
        series=series, language="de", title="Synthetic German title", synopsis="German text"
    )
    EpisodeTranslation.objects.create(
        episode=episode, language="de", title="Synthetic German episode", synopsis="Episode text"
    )
    episode.media_assets.update(captions_language="de", has_captions=True)
    settings.CATALOG_LAUNCH_CONTEXT = {**LAUNCH, "country": "DE", "language": "de"}

    response = client.get(f"/v1/series/{series.public_id}")
    detail = client.get(f"/v1/episodes/{episode.public_id}")

    assert response.status_code == detail.status_code == 200
    payload = response.json()
    assert payload.keys() == original.keys()
    assert payload["id"] == original["id"] == series.public_id
    assert payload["title"] == "Synthetic German title"
    assert payload["seasons"][0]["episodes"][0]["id"] == episode.public_id
    assert detail.json()["title"] == "Synthetic German episode"
    assert detail.json()["series_id"] == series.public_id


@pytest.mark.django_db
def test_revoked_coin_right_blocks_existing_entitlement_without_provider_call(
    client: Client, settings: Any
) -> None:
    settings.CATALOG_LAUNCH_CONTEXT = LAUNCH.copy()
    series, episode = make_published_licensed_title(title="Synthetic revocable license")
    profile = get_or_create_profile("synthetic-context-entitlement-user")
    EpisodeEntitlement.objects.create(
        user_profile=profile, episode=episode, source=EntitlementSource.REWARDED_AD
    )
    series.rights.update(coin_access_permission=False)

    with patch("apps.playback.views.get_video_provider") as provider:
        response = client.post(
            f"/v1/playback/{episode.public_id}/authorize",
            HTTP_AUTHORIZATION=f"Bearer {MOCK_TOKEN_PREFIX}{profile.firebase_uid}",
        )

    assert response.status_code == 404
    provider.assert_not_called()
    assert EpisodeEntitlement.objects.filter(user_profile=profile, episode=episode).exists()
