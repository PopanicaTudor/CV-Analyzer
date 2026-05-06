from pathlib import Path

from rest_framework import serializers

from results.serializers import ResultSerializer

from .models import CV


ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class CVUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CV
        fields = ("id", "file", "upload_date", "status")
        read_only_fields = ("id", "upload_date", "status")

    def validate_file(self, file):
        extension = Path(file.name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Only PDF and DOCX files are supported.")
        if file.size > MAX_UPLOAD_BYTES:
            raise serializers.ValidationError("CV file must be 10 MB or smaller.")
        return file


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
            "result",
        )
        read_only_fields = fields

    def get_filename(self, obj):
        return Path(obj.file.name).name if obj.file else ""


class CVStatusSerializer(serializers.ModelSerializer):
    filename = serializers.SerializerMethodField()

    class Meta:
        model = CV
        fields = ("id", "filename", "status", "error_message", "upload_date", "updated_at")
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
