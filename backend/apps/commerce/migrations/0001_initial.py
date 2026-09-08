import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("wallet", "0002_accounting_safeguards")]
    operations = [
        migrations.CreateModel(
            name="ApplicationBinding",
            fields=[
                ("app_id", models.CharField(max_length=128, primary_key=True, serialize=False)),
                ("application_id", models.CharField(max_length=128, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="PurchaseIdentity",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "wallet",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT, to="wallet.wallet"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PurchaseDecision",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("transaction_key", models.CharField(max_length=64, unique=True)),
                ("claim_fingerprint", models.CharField(max_length=64)),
                ("status", models.CharField(max_length=16)),
                ("reason", models.CharField(max_length=40)),
                ("coins", models.PositiveIntegerField(default=0)),
                ("product_id", models.CharField(blank=True, max_length=128)),
                ("application_id", models.CharField(blank=True, max_length=128)),
                ("approval_reference", models.CharField(blank=True, max_length=128)),
                ("product_type", models.CharField(blank=True, max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "identity",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        to="commerce.purchaseidentity",
                    ),
                ),
                (
                    "ledger_entry",
                    models.OneToOneField(
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        to="wallet.coinledgerentry",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(
                            models.Q(
                                ("coins__gte", 1),
                                ("coins__lte", 2147483647),
                                ("identity__isnull", False),
                                ("ledger_entry__isnull", False),
                                ("status", "credited"),
                            ),
                            models.Q(
                                ("coins", 0),
                                ("ledger_entry__isnull", True),
                                ("status", "quarantined"),
                            ),
                            _connector="OR",
                        ),
                        name="commerce_valid_decision_credit",
                    )
                ]
            },
        ),
        migrations.CreateModel(
            name="PurchaseEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("event_key", models.CharField(max_length=64)),
                ("fingerprint", models.CharField(max_length=64)),
                ("status", models.CharField(max_length=16)),
                ("reason", models.CharField(max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "decision",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        to="commerce.purchasedecision",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("event_key", "fingerprint"), name="commerce_unique_event_delivery"
                    )
                ]
            },
        ),
    ]
