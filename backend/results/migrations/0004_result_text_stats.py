# Generated for CV Analyzer Pro.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("results", "0003_extended_analysis_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="result",
            name="text_stats",
            field=models.JSONField(default=dict),
        ),
    ]
