from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_accountdeletion_userprofile_ads_consent_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="auto_unlock_next",
            field=models.BooleanField(db_default=False, default=False),
        ),
    ]
