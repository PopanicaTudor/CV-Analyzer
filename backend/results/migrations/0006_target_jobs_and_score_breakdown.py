from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("results", "0005_personalized_recommendations"),
    ]

    operations = [
        migrations.AddField(
            model_name="result",
            name="career_score_breakdown",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="result",
            name="target_job_matches",
            field=models.JSONField(default=list),
        ),
    ]
