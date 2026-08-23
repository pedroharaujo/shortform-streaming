from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from django.db import OperationalError
from django.test import Client


def test_live_is_process_only(client: Client) -> None:
    with patch("apps.health.views.connections") as mocked_connections:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mocked_connections.__getitem__.assert_not_called()


@pytest.mark.django_db
def test_ready_succeeds_with_database(client: Client) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_fails_safely_without_database(client: Client) -> None:
    database = MagicMock()
    database.cursor.side_effect = OperationalError("synthetic outage")
    mocked_connections = MagicMock()
    mocked_connections.__getitem__.return_value = database

    with patch("apps.health.views.connections", mocked_connections):
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
