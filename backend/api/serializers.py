from django.contrib.auth import get_user_model
from rest_framework import serializers

from academics.models import AcademicRecord, Attendance, InterventionQueue, Student
from analytics_engine.models import AIInferenceLog, CampusPulseSnapshot
from campus.models import School

User = get_user_model()


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["id", "name", "slug", "primary_color", "secondary_color", "attendance_threshold"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "phone", "school"]


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            "id",
            "school",
            "parent",
            "student_code",
            "full_name",
            "class_name",
            "roll_number",
            "success_prediction",
            "focus_score",
        ]


class AcademicRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicRecord
        fields = ["id", "student", "subject", "assessment", "score", "max_score", "exam_date", "created_by", "created_at"]
        read_only_fields = ["created_at", "created_by"]


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ["id", "student", "teacher", "date", "status", "notes", "created_at"]
        read_only_fields = ["created_at", "teacher"]


class InterventionQueueSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = InterventionQueue
        fields = ["id", "student", "student_name", "recommendation", "rationale", "priority", "is_closed", "created_at"]


class AIInferenceLogSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AIInferenceLog
        fields = ["id", "student", "student_name", "trigger", "risk_level", "confidence", "payload", "created_at"]


class CampusPulseSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source="school.name", read_only=True)

    class Meta:
        model = CampusPulseSnapshot
        fields = [
            "id",
            "school",
            "school_name",
            "pulse_score",
            "attendance_component",
            "performance_component",
            "finance_component",
            "captured_at",
        ]
