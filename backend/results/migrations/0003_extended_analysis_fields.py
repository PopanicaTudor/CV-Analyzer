# Generated for CV Analyzer Pro.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("results", "0002_cv_quality_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="result",
            name="analysis_summary",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="result",
            name="strengths",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="missing_keywords",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="career_path",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="improvement_plan",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="rewrite_examples",
            field=models.JSONField(default=list),
        ),
    ]
