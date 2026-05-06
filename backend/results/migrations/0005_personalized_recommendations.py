# Generated for CV Analyzer Pro.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("results", "0004_result_text_stats"),
    ]

    operations = [
        migrations.AddField(
            model_name="result",
            name="personalization_profile",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="result",
            name="personalized_recommendations",
            field=models.JSONField(default=list),
        ),
    ]
