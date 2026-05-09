from rest_framework import serializers

from .models import Result


class ResultSerializer(serializers.ModelSerializer):
    cv_id = serializers.IntegerField(source="cv.id", read_only=True)
    filename = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = (
            "id",
            "cv_id",
            "filename",
            "score",
            "predicted_category",
            "feedback",
            "cv_quality_score",
            "cv_quality_level",
            "cv_quality_feedback",
            "cv_quality_suggestions",
            "cv_quality_breakdown",
            "analysis_summary",
            "career_score_breakdown",
            "personalization_profile",
            "personalized_recommendations",
            "strengths",
            "missing_keywords",
            "career_path",
            "improvement_plan",
            "rewrite_examples",
            "keywords",
            "job_matches",
            "target_job_matches",
            "extracted_text",
            "text_stats",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_filename(self, obj):
        return obj.cv.file.name.split("/")[-1] if obj.cv and obj.cv.file else ""
