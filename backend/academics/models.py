from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Student(models.Model):
    school = models.ForeignKey("campus.School", on_delete=models.CASCADE, related_name="students")
    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="children")
    student_code = models.CharField(max_length=30)
    full_name = models.CharField(max_length=255)
    class_name = models.CharField(max_length=50)
    roll_number = models.PositiveIntegerField()
    success_prediction = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    focus_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("school", "student_code"), ("school", "class_name", "roll_number"))
        indexes = [
            models.Index(fields=["class_name"]),
            models.Index(fields=["school", "class_name"]),
        ]

    def __str__(self) -> str:
        return f"{self.student_code} - {self.full_name}"


class AcademicRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="academic_records")
    subject = models.CharField(max_length=120)
    assessment = models.CharField(max_length=120)
    score = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    max_score = models.FloatField(default=100)
    exam_date = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_records")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["student"]),
            models.Index(fields=["student", "exam_date"]),
        ]


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    ABSENT = "ABSENT", "Absent"
    LATE = "LATE", "Late"


class Attendance(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_logs")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="attendance_marked")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=AttendanceStatus.choices)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "date")
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["student"]),
            models.Index(fields=["student", "date"]),
        ]


class InterventionQueue(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="interventions")
    recommendation = models.CharField(max_length=255)
    rationale = models.TextField()
    priority = models.CharField(max_length=20, default="MEDIUM")
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class TeacherAssignment(models.Model):
    school = models.ForeignKey("campus.School", on_delete=models.CASCADE, related_name="teacher_assignments")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="class_assignments")
    class_name = models.CharField(max_length=50)
    subject = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("school", "teacher", "class_name", "subject"),)
        indexes = [models.Index(fields=["school", "class_name"])]


class AuditLog(models.Model):
    school = models.ForeignKey("campus.School", on_delete=models.CASCADE, related_name="audit_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="audit_entries")
    action = models.CharField(max_length=120)
    target_type = models.CharField(max_length=120)
    target_id = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["school", "created_at"]),
            models.Index(fields=["target_type", "target_id"]),
        ]
