from __future__ import annotations

import json
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Any
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
from django.test import Client

from apps.accounts.models import UserProfile
from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.catalog.models import PublicationStatus
from apps.entitlements.models import AccessPolicy, EntitlementSource, EpisodeEntitlement
from apps.playback.models import MediaAssetState
from apps.playback.providers.factory import reset_provider_cache
from apps.playback.providers.fake import FakeVideoProvider
from tests.catalog.builders import (
    DEFAULT_NOW,
    make_episode,
    make_published_title,
    make_right,
    make_season,
    make_series,
)
from tests.entitlements.builders import (
    grant_staff_entitlement,
    make_episode_access_policy,
    make_series_access_policy,
)

AUTHORIZE = "/v1/playback/{episode_id}/authorize"
HMAC_KEY = "synthetic-hmac-for-tests"
VALID_UID = "firebase-user-1"
OTHER_UID = "firebase-user-2"
VALID_CREDENTIAL = f"{MOCK_TOKEN_PREFIX}{VALID_UID}"
OTHER_CREDENTIAL = f"{MOCK_TOKEN_PREFIX}{OTHER_UID}"


def _seed_ready(provider: FakeVideoProvider, episode: Any) -> str:
    asset = episode.media_assets.get()
    return provider.seed_ready_asset(asset.provider_asset_id)


def _headers(
    *,
    territory: str = "FR",
    platform: str = "ios",
    language: str = "en",
    request_id: str | None = None,
    authorization: str | None = None,
) -> dict[str, Any]:
    headers: dict[str, Any] = {
        "HTTP_X_TERRITORY": territory,
        "HTTP_X_PLATFORM": platform,
        "HTTP_X_LANGUAGE": language,
    }
    if request_id is not None:
        headers["HTTP_X_REQUEST_ID"] = request_id
    if authorization is not None:
        headers["HTTP_AUTHORIZATION"] = authorization
    return headers


def _bearer(credential: str) -> str:
    return f"Bearer {credential}"


def _published_episode(
    *,
    order: int = 1,
    season_number: int = 1,
    title: str = "Harbor Lights",
    ends_at: Any = None,
) -> tuple[Any, Any]:
    series, first = make_published_title(title=title, territory="FR", ends_at=ends_at)
    if season_number == 1 and order == 1:
        return series, first
    season = make_season(series, number=season_number)
    episode = make_episode(
        series,
        season=season,
        order=order,
        publication_status=PublicationStatus.PUBLISHED,
    )
    return series, episode


@pytest.fixture
def freeze_catalog_clock() -> Iterator[None]:
    with patch("apps.catalog.eligibility.timezone.now", return_value=DEFAULT_NOW):
        yield


@pytest.fixture
def fake_provider() -> Iterator[FakeVideoProvider]:
    reset_provider_cache()
    provider = FakeVideoProvider(hmac_key=HMAC_KEY, ttl_seconds=600)
    with (
        patch("apps.playback.providers.fake.timezone.now", return_value=DEFAULT_NOW),
        patch("apps.playback.views.get_video_provider", return_value=provider),
    ):
        yield provider
    reset_provider_cache()


def _assert_granted(
    payload: dict[str, Any],
    fake_provider: FakeVideoProvider,
    *,
    access_method: str = "free",
) -> None:
    assert set(payload.keys()) == {"decision", "access_method", "playback_url", "expires_at"}
    assert payload["decision"] == "granted"
    assert payload["access_method"] == access_method
    playback_url = payload["playback_url"]
    parsed = urlparse(playback_url)
    assert parsed.scheme == "https"
    assert parsed.path.endswith(".m3u8")
    assert parsed.hostname == "video.example.test"
    assert "lock_reasons" not in payload
    assert fake_provider.verify_playback_request(
        playback_url,
        now=DEFAULT_NOW,
        request_host="video.example.test",
        referrer="https://video.example.test/app",
    )


def _assert_locked(payload: dict[str, Any], reason: str) -> None:
    assert payload["decision"] == "locked"
    assert payload["lock_reasons"] == [reason]
    assert "playback_url" not in payload
    assert "expires_at" not in payload


def _assert_ineligible_404(response: Any) -> None:
    assert response.status_code == 404
    assert response.status_code != 403
    assert "playback_url" not in response.json()


@pytest.mark.django_db
def test_missing_headers_return_400_error_envelope(client: Client) -> None:
    response = client.post(AUTHORIZE.format(episode_id="ep_missing"))
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "invalid_request_context"
    assert "request_id" in body
    fields = {item["field"] for item in body["field_errors"]}
    assert fields == {"X-Territory", "X-Platform", "X-Language"}


@pytest.mark.django_db
@pytest.mark.parametrize("order", (1, 5))
def test_anonymous_free_window_grants(
    client: Client,
    freeze_catalog_clock: None,
    fake_provider: FakeVideoProvider,
    order: int,
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=order, title=f"Free {order}")
    _seed_ready(fake_provider, episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider)


@pytest.mark.django_db
def test_anonymous_order_six_is_locked_login_required(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Past Window")
    _seed_ready(fake_provider, episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_season_two_order_one_is_free_for_anonymous(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, season_number=2, title="Season Two")
    _seed_ready(fake_provider, episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider)


@pytest.mark.django_db
def test_rewarded_ad_entitlement_reports_server_owned_access_method(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Rewarded")
    _seed_ready(fake_provider, episode)
    profile = get_or_create_profile(VALID_UID)
    EpisodeEntitlement.objects.create(
        user_profile=profile,
        episode=episode,
        source=EntitlementSource.REWARDED_AD,
    )

    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )

    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider, access_method="rewarded_ad")


@pytest.mark.django_db
def test_staff_entitlement_grants_order_six(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Entitled")
    _seed_ready(fake_provider, episode)
    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, episode)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider, access_method="staff")


@pytest.mark.django_db
def test_other_users_entitlement_does_not_grant(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Other Entitled")
    _seed_ready(fake_provider, episode)
    other = get_or_create_profile(OTHER_UID)
    grant_staff_entitlement(other, episode)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    _assert_locked(response.json(), "entitlement_required")
    assert UserProfile.objects.filter(firebase_uid=VALID_UID).count() == 1


@pytest.mark.django_db
def test_authenticated_without_entitlement_past_window_is_locked(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Auth Locked")
    _seed_ready(fake_provider, episode)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    _assert_locked(response.json(), "entitlement_required")


@pytest.mark.django_db
def test_missing_bearer_past_window_does_not_create_profile(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Anon Locked")
    _seed_ready(fake_provider, episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("credential", ("not-a-token", f"{MOCK_TOKEN_PREFIX}expired"))
def test_invalid_or_expired_bearer_is_401(
    client: Client,
    freeze_catalog_clock: None,
    fake_provider: FakeVideoProvider,
    credential: str,
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Invalid Token")
    _seed_ready(fake_provider, episode)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(credential)),
    )
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "authentication_required"
    assert "playback_url" not in body
    assert UserProfile.objects.count() == 0


@pytest.mark.django_db
def test_valid_token_on_free_episode_may_create_profile(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=1, title="Free Auth")
    _seed_ready(fake_provider, episode)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider)
    assert UserProfile.objects.filter(firebase_uid=VALID_UID).count() == 1


@pytest.mark.django_db
def test_wrong_territory_and_unpublished_are_404_never_403(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    _seed_ready(fake_provider, episode)
    wrong_territory = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(territory="DE"),
    )
    _assert_ineligible_404(wrong_territory)

    unpublished = make_series(title="Draft Series")
    make_right(unpublished, territories=["FR"])
    draft = make_episode(unpublished, publication_status=PublicationStatus.DRAFT)
    unpublished_response = client.post(AUTHORIZE.format(episode_id=draft.public_id), **_headers())
    _assert_ineligible_404(unpublished_response)


@pytest.mark.django_db
def test_entitled_catalog_ineligible_is_404_never_granted(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    """Staff entitlement must not bypass territory, takedown, or exclusive rights end."""
    del freeze_catalog_clock
    auth = _headers(authorization=_bearer(VALID_CREDENTIAL))

    _fr_series, wrong_territory_episode = _published_episode(
        order=6, title="Entitled Wrong Territory"
    )
    _seed_ready(fake_provider, wrong_territory_episode)
    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, wrong_territory_episode)
    wrong_territory = client.post(
        AUTHORIZE.format(episode_id=wrong_territory_episode.public_id),
        **_headers(territory="DE", authorization=_bearer(VALID_CREDENTIAL)),
    )
    _assert_ineligible_404(wrong_territory)

    taken_series, taken_episode = _published_episode(order=6, title="Entitled Takedown")
    _seed_ready(fake_provider, taken_episode)
    grant_staff_entitlement(profile, taken_episode)
    assert taken_episode.media_assets.filter(state=MediaAssetState.READY).exists()
    right = taken_series.rights.get()
    right.takedown = True
    right.save(update_fields=["takedown"])
    taken_down = client.post(AUTHORIZE.format(episode_id=taken_episode.public_id), **auth)
    _assert_ineligible_404(taken_down)

    _expired_series, expired_episode = _published_episode(
        order=6, title="Entitled Expired Right", ends_at=DEFAULT_NOW
    )
    _seed_ready(fake_provider, expired_episode)
    grant_staff_entitlement(profile, expired_episode)
    expired = client.post(AUTHORIZE.format(episode_id=expired_episode.public_id), **auth)
    _assert_ineligible_404(expired)


@pytest.mark.django_db
def test_rights_end_exclusive_is_404_at_boundary(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _expired, expired_episode = make_published_title(
        title="Expired Right", territory="FR", ends_at=DEFAULT_NOW
    )
    _seed_ready(fake_provider, expired_episode)
    expired = client.post(AUTHORIZE.format(episode_id=expired_episode.public_id), **_headers())
    assert expired.status_code == 404
    assert expired.status_code != 403
    assert "playback_url" not in expired.json()

    _open, open_episode = make_published_title(
        title="Open Right",
        territory="FR",
        ends_at=DEFAULT_NOW + timedelta(seconds=1),
    )
    _seed_ready(fake_provider, open_episode)
    granted = client.post(AUTHORIZE.format(episode_id=open_episode.public_id), **_headers())
    assert granted.status_code == 200
    _assert_granted(granted.json(), fake_provider)


@pytest.mark.django_db
def test_disabled_provider_returns_503_on_grant_candidate(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    with patch("apps.playback.views.get_video_provider", return_value=None):
        response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "playback_unavailable"
    assert "playback_url" not in body


@pytest.mark.django_db
def test_locked_does_not_mint_when_provider_is_none(
    client: Client, freeze_catalog_clock: None
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Locked No Provider")
    with patch("apps.playback.views.get_video_provider", return_value=None) as provider:
        response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    provider.assert_not_called()


@pytest.mark.django_db
def test_non_ready_and_removed_assets_are_404(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = make_published_title(title="Harbor Lights", territory="FR")
    asset = episode.media_assets.get()
    fake_provider.seed_ready_asset(asset.provider_asset_id)
    asset.state = MediaAssetState.PROCESSING
    asset.save(update_fields=["state"])
    processing = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert processing.status_code == 404

    asset.state = MediaAssetState.READY
    asset.save(update_fields=["state"])
    fake_provider.takedown(asset.provider_asset_id)
    asset.state = MediaAssetState.REMOVED
    asset.save(update_fields=["state"])
    removed = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert removed.status_code == 404
    assert removed.status_code != 403


@pytest.mark.django_db
def test_grant_then_rights_removal_is_404(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = make_published_title(title="Harbor Lights", territory="FR")
    _seed_ready(fake_provider, episode)
    granted = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert granted.status_code == 200
    _assert_granted(granted.json(), fake_provider)

    right = series.rights.get()
    right.takedown = True
    right.save(update_fields=["takedown"])
    after = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert after.status_code == 404
    assert "playback_url" not in after.json()


@pytest.mark.django_db
def test_free_window_is_order_not_time(client: Client, fake_provider: FakeVideoProvider) -> None:
    _series, episode = _published_episode(order=6, title="Clock Order")
    _seed_ready(fake_provider, episode)
    future = DEFAULT_NOW + timedelta(days=365)
    with (
        patch("apps.catalog.eligibility.timezone.now", return_value=future),
        patch("apps.playback.providers.fake.timezone.now", return_value=future),
    ):
        response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")


@pytest.mark.django_db(transaction=True)
def test_concurrent_anonymous_lock_has_no_url(
    freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Concurrent Lock")
    _seed_ready(fake_provider, episode)
    episode_id = episode.public_id

    def authorize() -> Any:
        thread_client = Client()
        return thread_client.post(AUTHORIZE.format(episode_id=episode_id), **_headers())

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = [future.result() for future in [pool.submit(authorize), pool.submit(authorize)]]
    for response in responses:
        assert response.status_code == 200
        _assert_locked(response.json(), "login_required")


@pytest.mark.django_db(transaction=True)
def test_concurrent_entitled_grants(
    freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="Concurrent Grant")
    _seed_ready(fake_provider, episode)
    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, episode)
    episode_id = episode.public_id

    def authorize() -> Any:
        thread_client = Client()
        return thread_client.post(
            AUTHORIZE.format(episode_id=episode_id),
            **_headers(authorization=_bearer(VALID_CREDENTIAL)),
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = [future.result() for future in [pool.submit(authorize), pool.submit(authorize)]]
    for response in responses:
        assert response.status_code == 200
        _assert_granted(response.json(), fake_provider, access_method="staff")


@pytest.mark.django_db
def test_client_cannot_create_entitlement_via_authorize(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    _series, episode = _published_episode(order=6, title="No Client Grant")
    _seed_ready(fake_provider, episode)
    before = EpisodeEntitlement.objects.count()
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        data=json.dumps(
            {
                "user_id": "usr_forged",
                "episode_id": episode.public_id,
                "source": "staff",
            }
        ),
        content_type="application/json",
        **_headers(),
    )
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    assert EpisodeEntitlement.objects.count() == before

    missing_collection = client.post("/v1/entitlements", **_headers())
    assert missing_collection.status_code == 404
    missing_me = client.get("/v1/me/entitlements")
    assert missing_me.status_code == 404


@pytest.mark.django_db
def test_series_policy_free_max_three_locks_order_four(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=4, title="Tight Window")
    _seed_ready(fake_provider, episode)
    make_series_access_policy(series, free_episode_order_max=3)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        data='{"free_episode_order_max": 10}',
        content_type="application/json",
        **_headers(),
    )
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    assert "playback_url" not in response.json()


@pytest.mark.django_db
def test_episode_force_free_grants_order_six(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=6, title="Force Free")
    _seed_ready(fake_provider, episode)
    AccessPolicy.objects.create(series=series, episode=episode, force_free=True)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_granted(response.json(), fake_provider)


@pytest.mark.django_db
def test_episode_force_lock_locks_order_one_unless_entitled(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=1, title="Force Lock")
    _seed_ready(fake_provider, episode)
    AccessPolicy.objects.create(series=series, episode=episode, force_lock=True)
    locked = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert locked.status_code == 200
    _assert_locked(locked.json(), "login_required")

    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, episode)
    granted = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert granted.status_code == 200
    _assert_granted(granted.json(), fake_provider, access_method="staff")


@pytest.mark.django_db
def test_ads_disabled_does_not_grant_past_window(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=6, title="Ads Off")
    _seed_ready(fake_provider, episode)
    make_series_access_policy(series, rewarded_ad_enabled=False)
    response = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert response.status_code == 200
    _assert_locked(response.json(), "entitlement_required")


@pytest.mark.django_db
def test_episode_override_defaults_do_not_restore_series_free_max(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=4, title="Override Defaults")
    _seed_ready(fake_provider, episode)
    make_series_access_policy(series, free_episode_order_max=3, rewarded_ad_enabled=True)
    make_episode_access_policy(episode)
    response = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert response.status_code == 200
    _assert_locked(response.json(), "login_required")
    assert "playback_url" not in response.json()


@pytest.mark.django_db
def test_episode_force_lock_keeps_series_ads_off_and_locks_unless_entitled(
    client: Client, freeze_catalog_clock: None, fake_provider: FakeVideoProvider
) -> None:
    del freeze_catalog_clock
    series, episode = _published_episode(order=1, title="Force Lock Ads Off")
    _seed_ready(fake_provider, episode)
    make_series_access_policy(series, rewarded_ad_enabled=False)
    make_episode_access_policy(episode, force_lock=True)
    locked = client.post(AUTHORIZE.format(episode_id=episode.public_id), **_headers())
    assert locked.status_code == 200
    _assert_locked(locked.json(), "login_required")

    profile = get_or_create_profile(VALID_UID)
    grant_staff_entitlement(profile, episode)
    granted = client.post(
        AUTHORIZE.format(episode_id=episode.public_id),
        **_headers(authorization=_bearer(VALID_CREDENTIAL)),
    )
    assert granted.status_code == 200
    _assert_granted(granted.json(), fake_provider, access_method="staff")
