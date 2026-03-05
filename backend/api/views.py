from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from academics.models import AcademicRecord, Attendance, AuditLog, InterventionQueue, Student, TeacherAssignment
from analytics_engine.models import AIInferenceLog, CampusPulseSnapshot
from analytics_engine.tasks import update_student_success_prediction
from campus.models import School
from notifications.realtime import publish_attendance_update, publish_parent_timeline_event
from .services.audit import log_action

from .permissions import IsAdminOrTeacher, IsAdminRole, IsParentRole
from .serializers import (
    AIInferenceLogSerializer,
    AcademicRecordSerializer,
    AuditLogSerializer,
    AttendanceSerializer,
    CampusPulseSerializer,
    InterventionQueueSerializer,
    SchoolSerializer,
    StudentSerializer,
    TeacherAssignmentSerializer,
    UserSerializer,
)

User = get_user_model()


class SchoolViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = School.objects.all().order_by("name")
    serializer_class = SchoolSerializer


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("school", "parent").all().order_by("full_name")
    serializer_class = StudentSerializer
    filterset_fields = ["school", "class_name"]
    search_fields = ["full_name", "student_code"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrTeacher()]

    def get_queryset(self):
        base = super().get_queryset()
        user = self.request.user
        if user.role == "PARENT":
            return base.filter(parent=user, is_archived=False)
        if user.role == "TEACHER":
            return base.filter(school=user.school, is_archived=False)
        return base.filter(is_archived=False)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "TEACHER":
            serializer.save(school=user.school)
        else:
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        student = serializer.instance
        if user.role == "TEACHER" and student.school_id != user.school_id:
            raise permissions.PermissionDenied("Teachers can only edit students in their school.")
        updated_student = serializer.save()
        log_action(
            actor=user,
            action="student.updated",
            target_type="Student",
            target_id=updated_student.id,
            payload={"class_name": updated_student.class_name, "parent": updated_student.parent_id},
        )

    def perform_destroy(self, instance):
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])
        log_action(
            actor=self.request.user,
            action="student.archived",
            target_type="Student",
            target_id=instance.id,
            payload={"student_code": instance.student_code},
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAdminOrTeacher])
    def trigger_prediction(self, request, pk=None):
        student = self.get_object()
        update_student_success_prediction.delay(student.id, trigger="manual_recompute")
        return Response({"detail": "Prediction update queued."}, status=status.HTTP_202_ACCEPTED)


class AcademicRecordViewSet(viewsets.ModelViewSet):
    queryset = AcademicRecord.objects.select_related("student", "created_by").all().order_by("-exam_date")
    serializer_class = AcademicRecordSerializer
    filterset_fields = ["student", "subject"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrTeacher()]

    def perform_create(self, serializer):
        record = serializer.save(created_by=self.request.user)
        log_action(
            actor=self.request.user,
            action="academic_record.created",
            target_type="AcademicRecord",
            target_id=record.id,
            payload={"student": record.student_id, "score": record.score, "subject": record.subject},
        )

    def get_queryset(self):
        base = super().get_queryset()
        user = self.request.user
        if user.role == "PARENT":
            return base.filter(student__parent=user)
        if user.role == "TEACHER":
            return base.filter(student__school=user.school)
        return base


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.select_related("student", "teacher").all().order_by("-date")
    serializer_class = AttendanceSerializer
    filterset_fields = ["student", "date", "status"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrTeacher()]

    def perform_create(self, serializer):
        attendance = serializer.save(teacher=self.request.user)
        log_action(
            actor=self.request.user,
            action="attendance.marked",
            target_type="Attendance",
            target_id=attendance.id,
            payload={"student": attendance.student_id, "status": attendance.status, "date": str(attendance.date)},
        )
        publish_attendance_update(
            school_id=attendance.student.school_id,
            payload={
                "student_id": attendance.student_id,
                "student_name": attendance.student.full_name,
                "status": attendance.status,
                "date": str(attendance.date),
            },
        )
        if attendance.status == "ABSENT":
            publish_parent_timeline_event(
                school_id=attendance.student.school_id,
                parent_user_id=attendance.student.parent_id,
                event={
                    "kind": "ABSENCE_ALERT",
                    "student_id": attendance.student_id,
                    "student_name": attendance.student.full_name,
                    "message": f"{attendance.student.full_name} marked absent on {attendance.date}.",
                },
            )

    def get_queryset(self):
        base = super().get_queryset()
        user = self.request.user
        if user.role == "PARENT":
            return base.filter(student__parent=user)
        if user.role == "TEACHER":
            return base.filter(student__school=user.school)
        return base

    @action(detail=False, methods=["post"], permission_classes=[IsAdminOrTeacher])
    def bulk_mark(self, request):
        date = request.data.get("date")
        records = request.data.get("records", [])
        if not date or not isinstance(records, list) or len(records) == 0:
            return Response({"detail": "date and records are required."}, status=status.HTTP_400_BAD_REQUEST)

        updated = 0
        for item in records:
            student_id = item.get("student")
            status_value = item.get("status")
            notes = item.get("notes", "")

            if not student_id or not status_value:
                continue

            attendance, _ = Attendance.objects.update_or_create(
                student_id=student_id,
                date=date,
                defaults={
                    "teacher": request.user,
                    "status": status_value,
                    "notes": notes,
                },
            )
            updated += 1
            log_action(
                actor=request.user,
                action="attendance.bulk_marked",
                target_type="Attendance",
                target_id=f"{attendance.student_id}:{attendance.date}",
                payload={"status": attendance.status, "date": str(attendance.date)},
            )

            publish_attendance_update(
                school_id=attendance.student.school_id,
                payload={
                    "student_id": attendance.student_id,
                    "student_name": attendance.student.full_name,
                    "status": attendance.status,
                    "date": str(attendance.date),
                },
            )

            if attendance.status == "ABSENT":
                publish_parent_timeline_event(
                    school_id=attendance.student.school_id,
                    parent_user_id=attendance.student.parent_id,
                    event={
                        "kind": "ABSENCE_ALERT",
                        "student_id": attendance.student_id,
                        "student_name": attendance.student.full_name,
                        "message": f"{attendance.student.full_name} marked absent on {attendance.date}.",
                    },
                )

        return Response({"detail": "Attendance saved.", "count": updated}, status=status.HTTP_200_OK)


class InterventionQueueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InterventionQueue.objects.select_related("student").all().order_by("-created_at")
    serializer_class = InterventionQueueSerializer

    def get_permissions(self):
        return [IsAdminOrTeacher()]

    def get_queryset(self):
        queryset = super().get_queryset()
        school_id = self.request.query_params.get("school")
        if school_id:
            queryset = queryset.filter(student__school_id=school_id)
        return queryset


class AIInferenceLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AIInferenceLog.objects.select_related("student").all().order_by("-created_at")
    serializer_class = AIInferenceLogSerializer

    def get_permissions(self):
        return [IsAdminOrTeacher()]

    def get_queryset(self):
        base = super().get_queryset()
        user = self.request.user
        if user.role == "TEACHER":
            return base.filter(student__school=user.school)
        return base


class PulseDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        school_id = request.query_params.get("school") or getattr(request.user, "school_id", None)
        school = get_object_or_404(School, id=school_id)

        attendance = Attendance.objects.filter(student__school=school)
        total_attendance = attendance.count() or 1
        present_pct = (attendance.filter(status="PRESENT").count() / total_attendance) * 100

        avg_grade = (
            AcademicRecord.objects.filter(student__school=school).aggregate(avg=Avg("score")).get("avg") or 0
        )
        performance_component = min(100, avg_grade)
        finance_component = 81.0

        pulse_score = round((present_pct * 0.4) + (performance_component * 0.4) + (finance_component * 0.2), 2)

        snapshot = CampusPulseSnapshot.objects.create(
            school=school,
            pulse_score=pulse_score,
            attendance_component=round(present_pct, 2),
            performance_component=round(performance_component, 2),
            finance_component=finance_component,
        )

        return Response(CampusPulseSerializer(snapshot).data)


class YearbookViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminOrTeacher]

    @action(detail=False, methods=["post"])
    def generate(self, request):
        student_id = request.data.get("student_id")
        student = get_object_or_404(Student, id=student_id)

        # This endpoint is a queue hook for a Celery PDF pipeline (Puppeteer or HTML-to-PDF service).
        return Response(
            {
                "detail": "Yearbook generation queued.",
                "student": student.full_name,
                "status": "QUEUED",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class SystemSummaryViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        school_id = request.query_params.get("school") or getattr(request.user, "school_id", None)
        school = get_object_or_404(School, id=school_id)

        students_qs = Student.objects.filter(school=school)
        attendance_qs = Attendance.objects.filter(student__school=school)
        interventions_qs = InterventionQueue.objects.filter(student__school=school, is_closed=False)

        today = timezone.localdate()
        attendance_today = attendance_qs.filter(date=today)
        total_today = attendance_today.count() or 1
        present_today = attendance_today.filter(status="PRESENT").count()
        absent_today = attendance_today.filter(status="ABSENT").count()
        late_today = attendance_today.filter(status="LATE").count()

        thirty_days_back = today - timedelta(days=30)
        attendance_30d = attendance_qs.filter(date__gte=thirty_days_back)
        present_30d = attendance_30d.filter(status="PRESENT").count()
        attendance_30d_total = attendance_30d.count() or 1

        avg_score = AcademicRecord.objects.filter(student__school=school).aggregate(avg=Avg("score")).get("avg") or 0
        avg_prediction = students_qs.aggregate(avg=Avg("success_prediction")).get("avg") or 0

        class_breakdown = list(
            students_qs.values("class_name")
            .annotate(student_count=Count("id"), avg_success=Avg("success_prediction"))
            .order_by("class_name")
        )

        risk_distribution = {
            "critical": students_qs.filter(success_prediction__lt=60).count(),
            "watch": students_qs.filter(success_prediction__gte=60, success_prediction__lt=80).count(),
            "stable": students_qs.filter(success_prediction__gte=80).count(),
        }

        recent_alerts = list(
            interventions_qs.select_related("student").order_by("-created_at")[:5].values(
                "id", "student__full_name", "priority", "recommendation", "created_at"
            )
        )

        return Response(
            {
                "school": {"id": school.id, "name": school.name},
                "totals": {
                    "students": students_qs.count(),
                    "classes": len(class_breakdown),
                    "open_interventions": interventions_qs.count(),
                    "ai_logs": AIInferenceLog.objects.filter(student__school=school).count(),
                },
                "attendance": {
                    "today_present": present_today,
                    "today_absent": absent_today,
                    "today_late": late_today,
                    "today_rate": round((present_today / total_today) * 100, 2),
                    "thirty_day_rate": round((present_30d / attendance_30d_total) * 100, 2),
                },
                "academics": {
                    "average_score": round(float(avg_score), 2),
                    "average_success_prediction": round(float(avg_prediction), 2),
                },
                "risk_distribution": risk_distribution,
                "class_breakdown": [
                    {
                        "class_name": row["class_name"],
                        "student_count": row["student_count"],
                        "avg_success": round(float(row["avg_success"] or 0), 2),
                    }
                    for row in class_breakdown
                ],
                "recent_alerts": [
                    {
                        "id": row["id"],
                        "student_name": row["student__full_name"],
                        "priority": row["priority"],
                        "recommendation": row["recommendation"],
                        "created_at": row["created_at"],
                    }
                    for row in recent_alerts
                ],
            }
        )


class ProfileViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        return Response(UserSerializer(request.user).data)


class UserManagementViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("school").all().order_by("email")
    serializer_class = UserSerializer
    filterset_fields = ["role", "school", "is_active"]
    search_fields = ["email", "username"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAdminOrTeacher()]
        return [IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "TEACHER":
            return qs.filter(role="PARENT", school=user.school)
        if user.role == "ADMIN":
            return qs.filter(school=user.school)
        return qs.none()

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(
            actor=self.request.user,
            action="user.created",
            target_type="User",
            target_id=user.id,
            payload={"email": user.email, "role": user.role},
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(
            actor=self.request.user,
            action="user.updated",
            target_type="User",
            target_id=user.id,
            payload={"email": user.email, "role": user.role, "is_active": user.is_active},
        )


class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.select_related("school", "teacher").all().order_by("class_name", "subject")
    serializer_class = TeacherAssignmentSerializer
    filterset_fields = ["school", "teacher", "class_name", "subject"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAdminOrTeacher()]
        return [IsAdminRole()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in {"ADMIN", "TEACHER"}:
            return qs.filter(school=user.school)
        return qs.none()

    def perform_create(self, serializer):
        assignment = serializer.save()
        log_action(
            actor=self.request.user,
            action="teacher_assignment.created",
            target_type="TeacherAssignment",
            target_id=assignment.id,
            payload={
                "teacher": assignment.teacher_id,
                "class_name": assignment.class_name,
                "subject": assignment.subject,
            },
        )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("school", "actor").all().order_by("-created_at")
    serializer_class = AuditLogSerializer
    filterset_fields = ["school", "action", "target_type", "actor"]

    def get_permissions(self):
        return [IsAdminRole()]

    def get_queryset(self):
        user = self.request.user
        return super().get_queryset().filter(school=user.school)
