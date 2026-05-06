from django.contrib import admin

from .models import Result


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("id", "cv", "score", "cv_quality_score", "predicted_category", "created_at")
    list_filter = ("predicted_category", "created_at")
    search_fields = ("cv__user__username", "cv__user__email", "predicted_category", "keywords")
    readonly_fields = ("created_at", "updated_at")
