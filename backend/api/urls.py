from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AIInferenceLogViewSet,
    AcademicRecordViewSet,
    AttendanceViewSet,
    InterventionQueueViewSet,
    PulseDashboardViewSet,
    SchoolViewSet,
    StudentViewSet,
    SystemSummaryViewSet,
    YearbookViewSet,
)

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="schools")
router.register("students", StudentViewSet, basename="students")
router.register("academic-records", AcademicRecordViewSet, basename="academic-records")
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("interventions", InterventionQueueViewSet, basename="interventions")
router.register("inference-logs", AIInferenceLogViewSet, basename="inference-logs")
router.register("pulse", PulseDashboardViewSet, basename="pulse")
router.register("system-summary", SystemSummaryViewSet, basename="system-summary")
router.register("yearbooks", YearbookViewSet, basename="yearbooks")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("", include(router.urls)),
]
