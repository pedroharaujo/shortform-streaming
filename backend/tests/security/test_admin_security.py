from __future__ import annotations

import pytest
from django.contrib.auth.models import Permission, User
from django.test import Client, override_settings
from django.urls import reverse

from apps.catalog.models import Genre, PublicationStatus
from tests.catalog.builders import make_right, make_series

pytestmark = pytest.mark.django_db


@override_settings(CSRF_USE_SESSIONS=True)
def test_admin_mutation_without_csrf_token_is_rejected() -> None:
    user = User.objects.create(
        username="csrf-admin",
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)

    response = client.post(
        reverse("admin:catalog_genre_add"),
        {"name": "Injected Genre", "slug": "injected-genre"},
    )

    assert response.status_code == 403
    assert not Genre.objects.filter(slug="injected-genre").exists()


def test_view_only_catalog_role_cannot_mutate_or_read_rights_metadata() -> None:
    series = make_series(title="Visible Editorial Title")
    right = make_right(
        series,
        licensor="Synthetic Confidential Licensor",
        contract_reference="synthetic-confidential-contract",
    )
    user = User.objects.create_user(username="catalog-viewer", is_staff=True)
    user.user_permissions.add(Permission.objects.get(codename="view_series"))
    client = Client()
    client.force_login(user)

    change_url = reverse("admin:catalog_series_change", args=[series.pk])
    viewed = client.get(change_url)
    attempted_change = client.post(
        change_url,
        {
            "publication_status": PublicationStatus.PUBLISHED,
            "editorial_rank": 999,
            "original_language": "en",
        },
    )
    rights = client.get(reverse("admin:catalog_contentright_changelist"))

    assert viewed.status_code == 200
    assert "Visible Editorial Title" in viewed.content.decode()
    assert right.licensor.encode() not in viewed.content
    assert right.contract_reference.encode() not in viewed.content
    assert attempted_change.status_code == 403
    assert rights.status_code == 403
    series.refresh_from_db()
    assert series.publication_status == PublicationStatus.DRAFT
    assert series.editorial_rank != 999


def test_non_superuser_cannot_administer_staff_even_with_auth_permissions() -> None:
    user = User.objects.create_user(username="role-manager", is_staff=True)
    user.user_permissions.add(
        *Permission.objects.filter(
            content_type__app_label="auth",
            content_type__model="user",
        )
    )
    client = Client()
    client.force_login(user)

    assert client.get(reverse("admin:auth_user_changelist")).status_code == 403
    assert client.get(reverse("admin:auth_user_add")).status_code == 403
