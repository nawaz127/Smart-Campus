import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from campus.models import School


@pytest.mark.django_db
def test_auth_token_and_students_list():
    User = get_user_model()
    school = School.objects.create(name="Test School", slug="test-school")
    teacher = User.objects.create_user(
        username="teacher",
        email="teacher@test.local",
        password="StrongPass123!",
        role="TEACHER",
        school=school,
    )

    client = APIClient()
    token_response = client.post(
        "/api/v1/auth/token/",
        {"email": teacher.email, "password": "StrongPass123!"},
        format="json",
    )

    assert token_response.status_code == 200
    access = token_response.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    list_response = client.get("/api/v1/students/")
    assert list_response.status_code == 200
