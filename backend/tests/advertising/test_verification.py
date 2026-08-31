from __future__ import annotations

import logging
from typing import Any

import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from apps.advertising import verification
from tests.advertising.test_callbacks import signed_query
from tests.test_production_settings import IMPORT_VALID_ENVIRONMENT, run_settings_import


def test_key_cache_refreshes_and_fails_closed(
    ephemeral_signer: ec.EllipticCurvePrivateKey, monkeypatch: pytest.MonkeyPatch
) -> None:
    query = signed_query(
        ephemeral_signer,
        {
            "custom_data": "a" * 43,
            "ssv_user_id": "b" * 43,
            "ad_unit_id": "ca-app-pub-3940256099942544/5224354917",
        },
    )
    verification.verify_callback(query)

    def outage() -> Any:
        raise verification.VerificationUnavailable()

    monkeypatch.setattr(verification, "fetch_key_document", outage)
    verification.verify_callback(query)  # bounded cache remains valid
    monkeypatch.setattr(verification, "_fetched_at", -100_000.0)
    with pytest.raises(verification.VerificationUnavailable):
        verification.verify_callback(query)


@pytest.mark.parametrize("mode", ["test", "live", "anything"])
def test_production_cannot_enable_reward_ads(mode: str) -> None:
    result = run_settings_import({**IMPORT_VALID_ENVIRONMENT, "REWARDED_ADS_MODE": mode})
    assert result.returncode != 0


def test_development_request_logs_remove_query_strings() -> None:
    from config.logging import RedactQueryString

    record = logging.LogRecord(
        "django.server",
        logging.INFO,
        "",
        0,
        '"%s" %s %s',
        ("GET /v1/rewards/admob/ssv?custom_data=private&signature=private HTTP/1.1", 200, 0),
        None,
    )
    assert RedactQueryString().filter(record)
    assert "custom_data" not in record.getMessage()
    assert "signature" not in record.getMessage()
    assert "/v1/rewards/admob/ssv HTTP/1.1" in record.getMessage()
