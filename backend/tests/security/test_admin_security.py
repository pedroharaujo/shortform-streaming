from __future__ import annotations

import pytest
from django.contrib.auth.models import Permission, User
from django.test import Client, override_settings
from django.urls import reverse

from apps.catalog.models import Genre, PublicationStatus
from tests.catalog.builders import make_series

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


def test_view_only_catalog_role_cannot_mutate_or_read_ownership_metadata() -> None:
    series = make_series(
        title="Visible Editorial Title",
        provenance_reference="synthetic-confidential-provenance",
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
            "title": "Tampered title",
        },
    )

    assert viewed.status_code == 200
    assert "Visible Editorial Title" in viewed.content.decode()
    assert b"synthetic-confidential-provenance" not in viewed.content
    assert attempted_change.status_code == 403
    series.refresh_from_db()
    assert series.publication_status == PublicationStatus.DRAFT
    assert series.editorial_rank != 999
    assert series.title == "Visible Editorial Title"


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
