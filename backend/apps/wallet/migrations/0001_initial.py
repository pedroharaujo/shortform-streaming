import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0002_accountdeletion_userprofile_ads_consent_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Wallet",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user_profile",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_wallet",
                        to="accounts.userprofile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="CoinLedgerEntry",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("reference", models.UUIDField(editable=False, unique=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("purchase", "Purchase"),
                            ("unlock", "Unlock"),
                            ("correction", "Correction"),
                        ],
                        max_length=16,
                    ),
                ),
                ("amount", models.BigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "wallet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="entries",
                        to="wallet.wallet",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(
                            models.Q(("amount__gt", 0), ("kind", "purchase")),
                            models.Q(("amount__lt", 0), ("kind", "unlock")),
                            models.Q(
                                ("kind", "correction"), models.Q(("amount", 0), _negated=True)
                            ),
                            _connector="OR",
                        ),
                        name="wallet_ledger_valid_kind_sign",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            ("amount__gte", -2147483647), ("amount__lte", 2147483647)
                        ),
                        name="wallet_ledger_bounded_amount",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="CoinUnlock",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("request_id", models.UUIDField()),
                ("episode_public_id", models.CharField(max_length=40)),
                ("policy_version", models.CharField(max_length=64)),
                ("expected_coin_price", models.PositiveIntegerField()),
                ("charged_coins", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ledger_entry",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="unlock_receipt",
                        to="wallet.coinledgerentry",
                    ),
                ),
                (
                    "wallet",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="unlocks",
                        to="wallet.wallet",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("wallet", "request_id"), name="wallet_unlock_unique_request"
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            models.Q(("charged_coins", 0), ("ledger_entry__isnull", True)),
                            models.Q(
                                ("charged_coins", models.F("expected_coin_price")),
                                ("charged_coins__gt", 0),
                                ("ledger_entry__isnull", False),
                            ),
                            _connector="OR",
                        ),
                        name="wallet_unlock_charge_has_entry",
                    ),
                ],
            },
        ),
    ]
