from django.contrib.auth import get_user_model
from rest_framework import serializers

from academics.models import AcademicRecord, Attendance, AuditLog, InterventionQueue, Student, TeacherAssignment
from analytics_engine.models import AIInferenceLog, CampusPulseSnapshot
from campus.models import School

User = get_user_model()


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["id", "name", "slug", "primary_color", "secondary_color", "attendance_threshold"]


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "phone", "school", "is_active", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class StudentSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.email", read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "school",
            "parent",
            "parent_name",
            "student_code",
            "full_name",
            "class_name",
            "roll_number",
            "success_prediction",
            "focus_score",
            "is_archived",
        ]

    def validate(self, attrs):
        school = attrs.get("school") or getattr(self.instance, "school", None)
        student_code = attrs.get("student_code") or getattr(self.instance, "student_code", None)
        if school and student_code:
            qs = Student.objects.filter(school=school, student_code=student_code)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({"student_code": "Student code must be unique per school."})
        return attrs


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


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source="teacher.email", read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = ["id", "school", "teacher", "teacher_name", "class_name", "subject", "created_at"]
        read_only_fields = ["created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "school", "actor", "actor_email", "action", "target_type", "target_id", "payload", "created_at"]
