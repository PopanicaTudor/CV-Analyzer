from django.contrib import admin

from .models import CV


@admin.register(CV)
class CVAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "file", "status", "upload_date", "updated_at")
    list_filter = ("status", "upload_date")
    search_fields = ("user__username", "user__email", "file")
    readonly_fields = ("upload_date", "updated_at")
