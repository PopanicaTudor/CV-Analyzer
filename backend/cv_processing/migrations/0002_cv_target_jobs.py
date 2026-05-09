from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cv_processing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="cv",
            name="target_jobs",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
