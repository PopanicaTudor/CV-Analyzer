from django.db import models

from cv_processing.models import CV


class Result(models.Model):
    cv = models.OneToOneField(CV, on_delete=models.CASCADE, related_name="result")
    score = models.PositiveSmallIntegerField()
    predicted_category = models.CharField(max_length=120)
    feedback = models.TextField()
    cv_quality_score = models.PositiveSmallIntegerField(blank=True, null=True)
    cv_quality_level = models.CharField(max_length=80, blank=True)
    cv_quality_feedback = models.TextField(blank=True)
    cv_quality_suggestions = models.JSONField(default=list)
    cv_quality_breakdown = models.JSONField(default=list)
    analysis_summary = models.TextField(blank=True)
    strengths = models.JSONField(default=list)
    missing_keywords = models.JSONField(default=list)
    career_path = models.JSONField(default=list)
    improvement_plan = models.JSONField(default=list)
    rewrite_examples = models.JSONField(default=list)
    keywords = models.JSONField(default=list)
    job_matches = models.JSONField(default=list)
    extracted_text = models.TextField(blank=True)
    text_stats = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"Result for CV #{self.cv_id}"
