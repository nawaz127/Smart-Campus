import pytest
from datetime import date
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from academics.models import Attendance, Student
from campus.models import School


@pytest.mark.django_db
def test_bulk_attendance_mark_creates_rows():
    User = get_user_model()
    school = School.objects.create(name="Bulk School", slug="bulk-school")

    teacher = User.objects.create_user(
        username="teacher2",
        email="teacher2@test.local",
        password="StrongPass123!",
        role="TEACHER",
        school=school,
    )
    parent = User.objects.create_user(
        username="parent1",
        email="parent1@test.local",
        password="StrongPass123!",
        role="PARENT",
        school=school,
    )

    student = Student.objects.create(
        school=school,
        parent=parent,
        student_code="T001",
        full_name="Test Student",
        class_name="1",
        roll_number=1,
        success_prediction=80,
        focus_score=85,
    )

    client = APIClient()
    token_response = client.post(
        "/api/v1/auth/token/",
        {"email": teacher.email, "password": "StrongPass123!"},
        format="json",
    )
    access = token_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    payload = {
        "date": str(date.today()),
        "records": [{"student": student.id, "status": "PRESENT"}],
    }
    response = client.post("/api/v1/attendance/bulk_mark/", payload, format="json")

    assert response.status_code == 200
    assert Attendance.objects.filter(student=student, date=date.today()).count() == 1
