from django.conf import settings
from django.db import models


class CVStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class CV(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cvs")
    file = models.FileField(upload_to="cvs/%Y/%m/%d/")
    upload_date = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=CVStatus.choices, default=CVStatus.PENDING)
    error_message = models.TextField(blank=True)
    target_jobs = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-upload_date",)
        indexes = [
            models.Index(fields=("user", "-upload_date"), name="cv_user_upload_idx"),
            models.Index(fields=("status",), name="cv_status_idx"),
        ]

    def __str__(self):
        return f"CV #{self.pk} - {self.user}"
