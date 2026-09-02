from __future__ import annotations

import pytest
from django.test import Client
from django.urls import reverse

from tests.catalog.builders import make_series


@pytest.mark.django_db
def test_anonymous_admin_is_denied_and_does_not_leak_catalog(client: Client) -> None:
    series = make_series(title="Secret Draft Title")

    root = client.get("/admin/")
    assert root.status_code in {301, 302}
    location = root.headers.get("Location", "")
    assert "login" in location
    assert b"Secret Draft Title" not in root.content

    login = client.get("/admin/login/")
    assert login.status_code == 200
    assert b"Secret Draft Title" not in login.content
    assert series.public_id.encode() not in login.content
    assert b"synthetic-self-owned-fixture" not in login.content

    changelist = client.get("/admin/catalog/series/")
    assert changelist.status_code in {301, 302}
    assert "login" in changelist.headers.get("Location", "")
    assert b"Secret Draft Title" not in changelist.content


@pytest.mark.django_db
def test_staff_can_see_draft_series_and_ownership_evidence(admin_client: Client) -> None:
    series = make_series(title="Draft Title")

    changelist = admin_client.get("/admin/catalog/series/")
    assert changelist.status_code == 200
    body = changelist.content.decode()
    assert series.public_id in body
    assert "Draft Title" in body

    change = admin_client.get(reverse("admin:catalog_series_change", args=[series.pk]))
    assert change.status_code == 200
    content = change.content.decode()
    assert series.public_id in content
    assert "Draft Title" in content
    assert "draft" in content.lower()
    assert "synthetic-self-owned-fixture" in content
    assert "self_owned" in content or "Self owned" in content
