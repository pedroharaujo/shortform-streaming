from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from django.test import Client

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.commerce.models import (
    ApplicationBinding,
    PurchaseDecision,
    PurchaseEvent,
    PurchaseIdentity,
)
from apps.commerce.services import purchase_identity
from apps.wallet.models import CoinLedgerEntry, Wallet
from tests.commerce.builders import callback, configure, payload, registry
from tests.test_openapi import build_schema

CATALOG = "/v1/purchases/catalog"
STATUS = "/v1/purchases/status"
APPLICATION = "test.synthetic.shortform"
QUERY = {
    "application_id": APPLICATION,
    "product_id": "synthetic_consumable",
    "transaction_id": "synthetic-checkout-one",
}
WAITING = {
    "status": "awaiting_verification",
    "historical_credited_coins": 0,
    "support_reference": None,
}


@pytest.fixture(autouse=True)
def synthetic_mode(settings: Any) -> None:
    configure(settings)


def post(client: Client, url: str, data: object, uid: str = "synthetic-sync-owner") -> Any:
    return client.post(
        url,
        data,
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {MOCK_TOKEN_PREFIX}{uid}",
    )


def credit(client: Client, settings: Any, **changes: Any) -> PurchaseIdentity:
    owner = purchase_identity(get_or_create_profile("synthetic-sync-owner"))
    event = {"transaction_id": QUERY["transaction_id"], **changes}
    response = callback(client, settings, payload(str(owner.pk), **event))
    assert response.status_code == 200
    return owner


@pytest.mark.django_db
def test_catalog_scopes_products_without_private_fields_or_financial_writes(
    client: Client,
    settings: Any,
) -> None:
    other = {
        **registry()[0],
        "app_id": "synthetic_other",
        "application_id": "test.synthetic.other",
        "coins": 99,
    }
    settings.COIN_PURCHASE_PRODUCTS.append(other)
    result = post(client, CATALOG, {"application_id": APPLICATION})
    assert result.status_code == 200
    assert result["Cache-Control"] == "no-store"
    assert result.json() == {
        "products": [
            {
                "product_id": "synthetic_consumable",
                "coins": 13,
                "product_type": "consumable",
                "store": "PLAY_STORE",
                "environment": "SANDBOX",
                "price_source": "store",
            }
        ]
    }
    assert not Wallet.objects.exists()
    assert not PurchaseIdentity.objects.exists()
    assert not ApplicationBinding.objects.exists()
    assert post(client, CATALOG, {"application_id": "test.synthetic.unknown"}).status_code == 409


@pytest.mark.django_db
@pytest.mark.parametrize("changed_field", ["app_id", "application_id"])
def test_catalog_rejects_persisted_application_binding_drift(
    client: Client,
    settings: Any,
    changed_field: str,
) -> None:
    credit(client, settings)
    settings.COIN_PURCHASE_PRODUCTS[0][changed_field] = (
        "synthetic_replacement" if changed_field == "app_id" else "test.synthetic.replacement"
    )
    application = settings.COIN_PURCHASE_PRODUCTS[0]["application_id"]
    assert post(client, CATALOG, {"application_id": application}).status_code == 409


@pytest.mark.django_db
def test_read_identifiers_match_existing_registry_boundary(client: Client, settings: Any) -> None:
    settings.COIN_PURCHASE_PRODUCTS[0].update(
        application_id="test.synthetic.", product_id="synthetic_"
    )
    response = post(client, CATALOG, {"application_id": "test.synthetic."})
    assert response.status_code == 200
    assert response.json()["products"][0]["product_id"] == "synthetic_"
    credit(client, settings, product_id="synthetic_")
    result = post(
        client,
        STATUS,
        {
            **QUERY,
            "application_id": "test.synthetic.",
            "product_id": "synthetic_",
        },
    )
    assert result.status_code == 200
    assert result.json()["status"] == "credited"


@pytest.mark.django_db
def test_status_waits_for_exact_verified_credit_without_creating_state(
    client: Client,
    settings: Any,
) -> None:
    assert post(client, STATUS, QUERY).json() == WAITING
    assert not Wallet.objects.exists()
    owner = credit(client, settings)
    credit(client, settings)  # New delivery of the same transaction, no second credit.
    result = post(client, STATUS, QUERY)
    assert result.status_code == 200
    assert result["Cache-Control"] == "no-store"
    assert result.json() == {
        "status": "credited",
        "historical_credited_coins": 13,
        "support_reference": str(PurchaseDecision.objects.get().pk),
    }
    assert post(client, STATUS, QUERY).json() == result.json()
    assert CoinLedgerEntry.objects.get().amount == 13
    assert PurchaseDecision.objects.count() == 1
    assert PurchaseEvent.objects.count() == 2
    for private in (
        str(owner.pk),
        QUERY["transaction_id"],
        "synthetic-sync-owner",
        "approval_reference",
    ):
        assert private not in result.content.decode()


@pytest.mark.django_db
def test_status_foreign_unknown_wrong_product_and_scope_are_indistinguishable(
    client: Client,
    settings: Any,
) -> None:
    credit(client, settings)
    assert post(client, STATUS, QUERY, uid="synthetic-other-account").json() == WAITING
    for field, value in (
        ("product_id", "synthetic_other"),
        ("transaction_id", "synthetic-unknown"),
        ("application_id", "test.synthetic.other"),
    ):
        assert post(client, STATUS, {**QUERY, field: value}).json() == WAITING


@pytest.mark.django_db
def test_status_uses_historical_quantity_after_registry_change_or_removal(
    client: Client,
    settings: Any,
) -> None:
    credit(client, settings)
    original = post(client, STATUS, QUERY).json()
    settings.COIN_PURCHASE_PRODUCTS[0]["coins"] = 99
    assert post(client, STATUS, QUERY).json() == original
    settings.COIN_PURCHASE_PRODUCTS[0]["product_id"] = "synthetic_replacement"
    assert post(client, STATUS, QUERY).json() == original


@pytest.mark.django_db
@pytest.mark.parametrize("event_type", ["CANCELLATION", "REFUND", "PENDING"])
def test_quarantine_after_credit_stays_in_review_after_a_successful_retry(
    client: Client,
    settings: Any,
    event_type: str,
) -> None:
    credit(client, settings)
    credit(client, settings, type=event_type)
    credit(client, settings)
    result = post(client, STATUS, QUERY).json()
    assert result["status"] == "review_required"
    assert result["historical_credited_coins"] == 13
    assert CoinLedgerEntry.objects.get().amount == 13


@pytest.mark.django_db
def test_unattributed_quarantine_never_claims_owner_or_credit(
    client: Client, settings: Any
) -> None:
    credit(client, settings, type="CANCELLATION")
    credit(client, settings)
    assert post(client, STATUS, QUERY).json() == WAITING
    assert not CoinLedgerEntry.objects.exists()


@pytest.mark.django_db
def test_deleted_recreated_owner_cannot_read_old_credit(client: Client, settings: Any) -> None:
    owner = credit(client, settings)
    profile = owner.wallet.user_profile
    assert profile is not None
    profile.delete()
    assert post(client, STATUS, QUERY).json() == WAITING
    assert CoinLedgerEntry.objects.get().amount == 13


@pytest.mark.django_db
@pytest.mark.parametrize("url,data", [(CATALOG, {"application_id": APPLICATION}), (STATUS, QUERY)])
def test_reads_require_authentication_and_app_check(
    client: Client, settings: Any, url: str, data: dict[str, str]
) -> None:
    assert client.post(url, data, content_type="application/json").status_code == 401
    settings.FIREBASE_APP_CHECK_MODE = "enforce"
    settings.FIREBASE_APP_CHECK_APP_ID = "synthetic-android-app"
    assert post(client, url, data).status_code == 401
    assert not Wallet.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("url,data", [(CATALOG, {"application_id": APPLICATION}), (STATUS, QUERY)])
@pytest.mark.parametrize("debug,mode", [(True, "disabled"), (False, "test")])
def test_reads_fail_closed_outside_local_synthetic_mode(
    client: Client,
    settings: Any,
    url: str,
    data: dict[str, str],
    debug: bool,
    mode: str,
) -> None:
    settings.DEBUG, settings.COIN_PURCHASE_MODE = debug, mode
    assert post(client, url, data).status_code == 409
    assert not Wallet.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "changes",
    [
        {"coins": 100},
        {"app_user_id": "synthetic-other"},
        {"environment": "PRODUCTION"},
        {"application_id": "real.application"},
        {"transaction_id": ""},
        {"transaction_id": "x" * 201},
        {"transaction_id": " synthetic-trimmed"},
        {"transaction_id": 123},
        {"product_id": "synthetic_product\n"},
    ],
)
def test_status_rejects_untrusted_fields_without_reflecting_values(
    client: Client,
    changes: dict[str, object],
) -> None:
    response = post(client, STATUS, {**QUERY, **changes})
    assert response.status_code == 400
    assert QUERY["transaction_id"] not in response.content.decode()
    assert not PurchaseDecision.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("url,data", [(CATALOG, {"application_id": APPLICATION}), (STATUS, QUERY)])
def test_stale_authenticated_profile_is_rejected_after_deletion(
    client: Client,
    settings: Any,
    url: str,
    data: dict[str, str],
) -> None:
    from apps.accounts.profiles import lock_current_profile

    credit(client, settings)

    def delete_before_read(profile: Any) -> Any:
        profile.delete()
        return lock_current_profile(profile)

    with patch("apps.commerce.reads.lock_current_profile", side_effect=delete_before_read):
        assert post(client, url, data).status_code == 401
    assert CoinLedgerEntry.objects.get().amount == 13


def test_purchase_read_schema_requires_both_identity_and_app_check() -> None:
    schema = build_schema()
    for path in (CATALOG, STATUS):
        operation = schema["paths"][path]["post"]
        assert operation["security"] == [{"FirebaseAppCheck": [], "FirebaseIdToken": []}]
        assert {"200", "400", "401", "409"} <= operation["responses"].keys()
    assert "/v1/purchases/revenuecat" not in schema["paths"]
