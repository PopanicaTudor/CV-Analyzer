# Generated for CV Analyzer Pro.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("results", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="result",
            name="cv_quality_score",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="result",
            name="cv_quality_level",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="result",
            name="cv_quality_feedback",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="result",
            name="cv_quality_suggestions",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="cv_quality_breakdown",
            field=models.JSONField(default=list),
        ),
    ]
