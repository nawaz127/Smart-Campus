from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    TEACHER = "TEACHER", "Teacher"
    PARENT = "PARENT", "Parent"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    school = models.ForeignKey("campus.School", on_delete=models.PROTECT, related_name="users", null=True, blank=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.PARENT)
    phone = models.CharField(max_length=24, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"
