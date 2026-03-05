from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AIInferenceLogViewSet,
    AcademicRecordViewSet,
    AuditLogViewSet,
    AttendanceViewSet,
    InterventionQueueViewSet,
    ProfileViewSet,
    PulseDashboardViewSet,
    SchoolViewSet,
    StudentViewSet,
    SystemSummaryViewSet,
    TeacherAssignmentViewSet,
    UserManagementViewSet,
    YearbookViewSet,
)

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="schools")
router.register("students", StudentViewSet, basename="students")
router.register("academic-records", AcademicRecordViewSet, basename="academic-records")
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("interventions", InterventionQueueViewSet, basename="interventions")
router.register("inference-logs", AIInferenceLogViewSet, basename="inference-logs")
router.register("audit-logs", AuditLogViewSet, basename="audit-logs")
router.register("pulse", PulseDashboardViewSet, basename="pulse")
router.register("system-summary", SystemSummaryViewSet, basename="system-summary")
router.register("yearbooks", YearbookViewSet, basename="yearbooks")
router.register("users", UserManagementViewSet, basename="users")
router.register("teacher-assignments", TeacherAssignmentViewSet, basename="teacher-assignments")
router.register("auth/me", ProfileViewSet, basename="auth-me")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("", include(router.urls)),
]
