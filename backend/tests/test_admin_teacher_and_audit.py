import pytest
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from academics.models import Attendance, AuditLog, Student
from campus.models import School


@pytest.mark.django_db
def test_auth_me_and_teacher_assignment_flow():
    user_model = get_user_model()
    school = School.objects.create(name="Ops School", slug="ops-school")

    admin = user_model.objects.create_user(
        username="admin",
        email="admin@ops.local",
        password="StrongPass123!",
        role="ADMIN",
        school=school,
    )
    teacher = user_model.objects.create_user(
        username="teacher",
        email="teacher@ops.local",
        password="StrongPass123!",
        role="TEACHER",
        school=school,
    )

    client = APIClient()
    token_response = client.post(
        "/api/v1/auth/token/",
        {"email": admin.email, "password": "StrongPass123!"},
        format="json",
    )
    assert token_response.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

    me_response = client.get("/api/v1/auth/me/")
    assert me_response.status_code == 200
    assert me_response.data["role"] == "ADMIN"

    assignment_response = client.post(
        "/api/v1/teacher-assignments/",
        {
            "school": school.id,
            "teacher": teacher.id,
            "class_name": "10",
            "subject": "Math",
        },
        format="json",
    )
    assert assignment_response.status_code == 201


@pytest.mark.django_db
def test_sensitive_attendance_write_creates_audit_log():
    user_model = get_user_model()
    school = School.objects.create(name="Audit School", slug="audit-school")

    teacher = user_model.objects.create_user(
        username="teacher2",
        email="teacher2@audit.local",
        password="StrongPass123!",
        role="TEACHER",
        school=school,
    )
    parent = user_model.objects.create_user(
        username="parent2",
        email="parent2@audit.local",
        password="StrongPass123!",
        role="PARENT",
        school=school,
    )
    student = Student.objects.create(
        school=school,
        parent=parent,
        student_code="A100",
        full_name="Audit Student",
        class_name="8",
        roll_number=1,
        success_prediction=75,
        focus_score=80,
    )

    client = APIClient()
    token_response = client.post(
        "/api/v1/auth/token/",
        {"email": teacher.email, "password": "StrongPass123!"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

    response = client.post(
        "/api/v1/attendance/bulk_mark/",
        {
            "date": str(date.today()),
            "records": [{"student": student.id, "status": "ABSENT"}],
        },
        format="json",
    )

    assert response.status_code == 200
    assert Attendance.objects.filter(student=student, date=date.today()).exists()
    assert AuditLog.objects.filter(action="attendance.bulk_marked", actor=teacher).exists()
