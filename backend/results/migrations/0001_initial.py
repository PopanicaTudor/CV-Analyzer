# Generated for CV Analyzer Pro.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("cv_processing", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Result",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("score", models.PositiveSmallIntegerField()),
                ("predicted_category", models.CharField(max_length=120)),
                ("feedback", models.TextField()),
                ("keywords", models.JSONField(default=list)),
                ("job_matches", models.JSONField(default=list)),
                ("extracted_text", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cv", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="result", to="cv_processing.cv")),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
    ]
