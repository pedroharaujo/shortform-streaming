from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("advertising", "0002_fixed_mvp_market")]

    operations = [
        migrations.AddField(
            model_name="rewardintent",
            name="policy_version",
            field=models.CharField(
                blank=True, default="", db_default="", editable=False, max_length=64
            ),
        ),
        migrations.AddConstraint(
            model_name="rewardintent",
            constraint=models.CheckConstraint(
                condition=models.Q(policy_version="")
                | models.Q(policy_version__regex=r"^[0-9a-f]{64}$"),
                name="reward_policy_version_valid",
            ),
        ),
    ]
