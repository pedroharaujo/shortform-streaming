from __future__ import annotations

import pytest
from django.test import Client
from django.urls import reverse

from apps.entitlements.models import AccessPolicy, AccessPolicyRevision
from tests.catalog.builders import make_published_title

_REVISION_MANAGEMENT = {
    "revisions-TOTAL_FORMS": "0",
    "revisions-INITIAL_FORMS": "0",
    "revisions-MIN_NUM_FORMS": "0",
    "revisions-MAX_NUM_FORMS": "0",
}


@pytest.mark.django_db
def test_anonymous_accesspolicy_admin_is_denied(client: Client) -> None:
    series, _episode = make_published_title(title="Secret Policy Title", territory="FR")
    response = client.get("/admin/entitlements/accesspolicy/")
    assert response.status_code in {301, 302}
    assert "login" in response.headers.get("Location", "")
    assert b"Secret Policy Title" not in response.content


@pytest.mark.django_db
def test_staff_save_creates_revision_with_actor(admin_client: Client) -> None:
    series, _episode = make_published_title(title="Admin Policy", territory="FR")
    add_url = reverse("admin:entitlements_accesspolicy_add")
    response = admin_client.post(
        add_url,
        {
            "series": str(series.pk),
            "free_episode_order_max": "3",
            "rewarded_ad_enabled": "on",
            "_save": "Save",
            **_REVISION_MANAGEMENT,
        },
    )
    assert response.status_code in {302, 200}
    policy = AccessPolicy.objects.get(series=series, episode__isnull=True)
    assert policy.free_episode_order_max == 3
    revision = AccessPolicyRevision.objects.get(policy=policy)
    assert revision.changed_by_id is not None
    assert revision.free_episode_order_max == 3


@pytest.mark.django_db
def test_staff_cannot_enable_coin_unlock(admin_client: Client) -> None:
    series, _episode = make_published_title(title="Coin Reject", territory="FR")
    add_url = reverse("admin:entitlements_accesspolicy_add")
    response = admin_client.post(
        add_url,
        {
            "series": str(series.pk),
            "free_episode_order_max": "5",
            "rewarded_ad_enabled": "on",
            "coin_unlock_enabled": "on",
            "_save": "Save",
            **_REVISION_MANAGEMENT,
        },
    )
    assert response.status_code == 200
    assert AccessPolicy.objects.filter(series=series).count() == 0
