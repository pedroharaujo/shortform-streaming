from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("advertising", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="rewardintent",
            name="language",
            field=models.CharField(default="en", editable=False, max_length=2),
        ),
        migrations.AlterField(
            model_name="rewardintent",
            name="platform",
            field=models.CharField(default="android", editable=False, max_length=7),
        ),
        migrations.AlterField(
            model_name="rewardintent",
            name="territory",
            field=models.CharField(default="FR", editable=False, max_length=2),
        ),
    ]
