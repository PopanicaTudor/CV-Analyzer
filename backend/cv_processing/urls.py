from django.urls import path

from .views import CVDeleteView, CVHistoryView, CVResultView, CVStatusView, CVUploadView


urlpatterns = [
    path("upload", CVUploadView.as_view(), name="cv-upload"),
    path("<int:cv_id>", CVDeleteView.as_view(), name="cv-delete"),
    path("<int:cv_id>/status", CVStatusView.as_view(), name="cv-status"),
    path("<int:cv_id>/result", CVResultView.as_view(), name="cv-result"),
    path("history", CVHistoryView.as_view(), name="cv-history"),
]
