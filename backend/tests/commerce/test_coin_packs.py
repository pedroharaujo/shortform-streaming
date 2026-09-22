from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import patch

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone

from apps.accounts.profiles import get_or_create_profile
from apps.accounts.verification import MOCK_TOKEN_PREFIX
from apps.commerce.admin import CoinPackForm
from apps.commerce.models import CoinPack
from apps.commerce.services import fulfill, purchase_identity
from apps.commerce.verification import normalize
from apps.wallet.services import wallet_balance
from tests.commerce.builders import configure, payload, registry

PRODUCT = "synthetic_consumable"
AUTH: dict[str, Any] = {"HTTP_AUTHORIZATION": f"Bearer {MOCK_TOKEN_PREFIX}synthetic-pack-viewer"}


def pack(**fields: Any) -> CoinPack:
    return CoinPack.objects.create(
        **{"product_id": PRODUCT, "base_coins": 100, "bonus": Decimal("0.20"), **fields}
    )


def now_ms(offset: timedelta = timedelta()) -> int:
    return int((timezone.now() + offset).timestamp() * 1000)


def catalog(client: Client) -> Any:
    return client.post(
        "/v1/purchases/catalog",
        {"application_id": "test.synthetic.stovio"},
        content_type="application/json",
        **AUTH,
    )


@pytest.mark.django_db
def test_catalog_shows_live_pack_and_purchase_credits_the_shown_coins(
    client: Client, settings: Any
) -> None:
    configure(settings)
    pack(badge="Best value", highlighted=True, sort_order=2)
    assert catalog(client).json()["products"] == [
        {
            "product_id": PRODUCT,
            "coins": 120,
            "bonus_percent": 20,
            "badge": "Best value",
            "highlighted": True,
            "product_type": "consumable",
            "store": "PLAY_STORE",
            "environment": "SANDBOX",
            "price_source": "store",
        }
    ]
    owner = purchase_identity(get_or_create_profile("synthetic-pack-buyer"))
    assert fulfill(normalize(payload(str(owner.pk), purchased_at_ms=now_ms()))).status == (
        "credited"
    )
    assert wallet_balance(owner.wallet) == 120


@pytest.mark.django_db
def test_turned_off_pack_is_hidden_but_honored_for_a_recent_payment(
    client: Client, settings: Any
) -> None:
    configure(settings)
    offer = pack()
    offer.is_active = False
    offer.save()
    assert catalog(client).status_code == 409
    owner = purchase_identity(get_or_create_profile("synthetic-pack-late-buyer"))
    fulfill(normalize(payload(str(owner.pk), purchased_at_ms=now_ms())))
    assert wallet_balance(owner.wallet) == 120
    later = timezone.now() + timedelta(days=2)
    with patch("apps.commerce.packs.timezone.now", return_value=later):
        fulfill(
            normalize(
                payload(
                    str(owner.pk),
                    transaction_id="paid-two-days-later",
                    purchased_at_ms=int(later.timestamp() * 1000),
                )
            )
        )
    # Only the registry floor applies once the pack was off for longer than the window.
    assert wallet_balance(owner.wallet) == 120 + registry()[0]["coins"]


@pytest.mark.django_db
def test_pack_amounts_and_schedule_are_fixed_and_packs_cannot_be_deleted() -> None:
    offer = pack()
    for update in (
        {"base_coins": 999},
        {"bonus": Decimal("1.00")},
        {"coins": 999},
        {"product_id": "synthetic_other"},
        {"ends_at": timezone.now() + timedelta(days=1)},
    ):
        with pytest.raises(IntegrityError), transaction.atomic():
            CoinPack.objects.filter(pk=offer.pk).update(**update)
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinPack.objects.filter(pk=offer.pk).delete()
    CoinPack.objects.filter(pk=offer.pk).update(badge="New badge", sort_order=5)
    offer.refresh_from_db()
    offer.is_active = False
    offer.save()
    assert offer.retired_at is not None
    with pytest.raises(IntegrityError), transaction.atomic():
        CoinPack.objects.filter(pk=offer.pk).update(is_active=True, retired_at=None)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("fields", "field"),
    [
        ({"badge": "Limited time"}, "ends_at"),
        ({"product_id": "synthetic_unapproved"}, "product_id"),
        ({"base_coins": 5, "bonus": "0.00"}, "base_coins"),
        ({"existing": True}, "product_id"),
    ],
)
def test_admin_form_rejects_misleading_or_conflicting_packs(
    settings: Any, fields: dict[str, Any], field: str
) -> None:
    configure(settings)
    if fields.pop("existing", False):
        pack()
    data = {
        "product_id": PRODUCT,
        "base_coins": 100,
        "bonus": "0.20",
        "badge": "",
        "sort_order": 0,
        "is_active": True,
        **fields,
    }
    form = CoinPackForm(data=data)
    assert not form.is_valid()
    assert field in form.errors


@pytest.mark.django_db
def test_admin_lists_and_edits_packs_but_cannot_delete_them(admin_client: Client) -> None:
    offer = pack(badge="Best value")
    base = "/admin/commerce/coinpack/"
    assert b"Best value" in admin_client.get(base).content
    assert admin_client.get(f"{base}add/").status_code == 200
    change = admin_client.get(f"{base}{offer.pk}/change/")
    assert change.status_code == 200
    assert b'name="base_coins"' in change.content and b"disabled" in change.content
    assert admin_client.get(f"{base}{offer.pk}/delete/").status_code == 403


@pytest.mark.django_db
def test_design_preview_lists_packs_only_for_local_development(
    client: Client, settings: Any
) -> None:
    url = "/v1/purchases/packs/preview"
    pack(badge="Best value", sort_order=1)
    pack(product_id="synthetic_scheduled", starts_at=timezone.now() + timedelta(days=1))
    settings.DEBUG = True
    settings.COIN_PURCHASE_MODE = "disabled"
    assert client.get(url).status_code == 401
    result = client.get(url, **AUTH)
    assert result.status_code == 200
    assert result.json() == {
        "packs": [
            {
                "product_id": PRODUCT,
                "coins": 120,
                "bonus_percent": 20,
                "badge": "Best value",
                "highlighted": False,
            }
        ]
    }
    settings.DEBUG = False
    assert client.get(url, **AUTH).status_code == 409
