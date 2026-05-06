# Generated for CV Analyzer Pro.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CV",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="cvs/%Y/%m/%d/")),
                ("upload_date", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("done", "Done"), ("failed", "Failed")], default="pending", max_length=20)),
                ("error_message", models.TextField(blank=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="cvs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-upload_date",),
            },
        ),
        migrations.AddIndex(
            model_name="cv",
            index=models.Index(fields=["user", "-upload_date"], name="cv_user_upload_idx"),
        ),
        migrations.AddIndex(
            model_name="cv",
            index=models.Index(fields=["status"], name="cv_status_idx"),
        ),
    ]
