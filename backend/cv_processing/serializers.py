import json
import re
from pathlib import Path

from rest_framework import serializers

from results.serializers import ResultSerializer

from .models import CV


ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_TARGET_JOBS = 5
MAX_TARGET_TITLE_LENGTH = 120
MAX_TARGET_DESCRIPTION_LENGTH = 1500


def compact_spaces(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


class TargetJobsField(serializers.Field):
    default_error_messages = {
        "invalid_json": "Target jobs must be valid JSON.",
        "invalid_type": "Target jobs must be a list.",
        "too_many": f"Add at most {MAX_TARGET_JOBS} target jobs.",
        "empty": "Each target job needs a title or description.",
    }

    def to_internal_value(self, data):
        if data in (None, ""):
            return []
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                self.fail("invalid_json")
        if not isinstance(data, list):
            self.fail("invalid_type")
        if len(data) > MAX_TARGET_JOBS:
            self.fail("too_many")

        normalized = []
        for item in data:
            if isinstance(item, str):
                title = compact_spaces(item)
                description = ""
            elif isinstance(item, dict):
                title = compact_spaces(item.get("title") or item.get("role") or item.get("name"))
                description = compact_spaces(item.get("description") or item.get("signals") or item.get("requirements"))
            else:
                self.fail("empty")

            if not title and not description:
                continue
            if not title:
                title = description[:80].rstrip()

            normalized.append(
                {
                    "title": title[:MAX_TARGET_TITLE_LENGTH],
                    "description": description[:MAX_TARGET_DESCRIPTION_LENGTH],
                }
            )

        return normalized

    def to_representation(self, value):
        return value or []


class CVUploadSerializer(serializers.ModelSerializer):
    target_jobs = TargetJobsField(required=False)

    class Meta:
        model = CV
        fields = ("id", "file", "target_jobs", "upload_date", "status")
        read_only_fields = ("id", "upload_date", "status")

    def validate_file(self, file):
        extension = Path(file.name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Only PDF and DOCX files are supported.")
        if file.size > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("CV file must be 10 MB or smaller.")
        return file

    def validate(self, attrs):
        if not attrs.get("target_jobs"):
            raise serializers.ValidationError({"target_jobs": "Add at least one target job to evaluate against this CV."})
        return attrs


class CVSerializer(serializers.ModelSerializer):
    result = ResultSerializer(read_only=True)
    filename = serializers.SerializerMethodField()

    class Meta:
        model = CV
        fields = (
            "id",
            "filename",
            "file",
            "upload_date",
            "updated_at",
            "status",
            "error_message",
            "target_jobs",
            "result",
        )
        read_only_fields = fields

    def get_filename(self, obj):
        return Path(obj.file.name).name if obj.file else ""


class CVStatusSerializer(serializers.ModelSerializer):
    filename = serializers.SerializerMethodField()

    class Meta:
        model = CV
        fields = ("id", "filename", "status", "error_message", "target_jobs", "upload_date", "updated_at")
        read_only_fields = fields

    def get_filename(self, obj):
        return Path(obj.file.name).name if obj.file else ""


class CVHistorySerializer(serializers.ModelSerializer):
    filename = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    cv_quality_score = serializers.SerializerMethodField()
    predicted_category = serializers.SerializerMethodField()

    class Meta:
        model = CV
        fields = (
            "id",
            "filename",
            "upload_date",
            "updated_at",
            "status",
            "error_message",
            "target_jobs",
            "score",
            "cv_quality_score",
            "predicted_category",
        )

    def get_filename(self, obj):
        return Path(obj.file.name).name if obj.file else ""

    def get_score(self, obj):
        return getattr(getattr(obj, "result", None), "score", None)

    def get_cv_quality_score(self, obj):
        return getattr(getattr(obj, "result", None), "cv_quality_score", None)

    def get_predicted_category(self, obj):
        return getattr(getattr(obj, "result", None), "predicted_category", None)
