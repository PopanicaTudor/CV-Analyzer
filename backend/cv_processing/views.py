import logging

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from results.models import Result
from results.serializers import ResultSerializer

from .models import CV, CVStatus
from .serializers import CVHistorySerializer, CVStatusSerializer, CVUploadSerializer
from .services.rabbitmq import RabbitMQPublishError, publish_cv_uploaded

logger = logging.getLogger(__name__)


class CVUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CVUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cv = serializer.save(user=request.user)

        try:
            publish_cv_uploaded(cv)
        except RabbitMQPublishError as exc:
            cv.status = CVStatus.FAILED
            cv.error_message = "CV was uploaded, but the processing queue is unavailable."
            cv.save(update_fields=["status", "error_message", "updated_at"])
            return Response(
                {"detail": str(exc), "cv_id": cv.id},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"cv_id": cv.id, "status": cv.status}, status=status.HTTP_202_ACCEPTED)


class CVStatusView(generics.RetrieveAPIView):
    serializer_class = CVStatusSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "cv_id"

    def get_queryset(self):
        return CV.objects.filter(user=self.request.user)


class CVResultView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, cv_id):
        cv = CV.objects.filter(user=request.user, id=cv_id).first()
        if cv is None:
            return Response({"detail": "CV not found."}, status=status.HTTP_404_NOT_FOUND)

        if cv.status != CVStatus.DONE:
            return Response(
                {
                    "cv_id": cv.id,
                    "status": cv.status,
                    "error_message": cv.error_message,
                    "detail": "Result is not available yet.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        result = Result.objects.filter(cv=cv).first()
        if result is None:
            return Response({"detail": "Result not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(ResultSerializer(result).data)


class CVHistoryView(generics.ListAPIView):
    serializer_class = CVHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            CV.objects.filter(user=self.request.user)
            .select_related("result")
            .order_by("-upload_date")
        )


class CVDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, cv_id):
        cv = CV.objects.filter(user=request.user, id=cv_id).first()
        if cv is None:
            return Response({"detail": "CV not found."}, status=status.HTTP_404_NOT_FOUND)

        file_name = cv.file.name if cv.file else ""
        storage = cv.file.storage if cv.file else None
        cv.delete()

        if file_name and storage:
            try:
                storage.delete(file_name)
            except Exception:
                logger.exception("Could not delete uploaded file for CV %s: %s", cv_id, file_name)

        return Response(status=status.HTTP_204_NO_CONTENT)
