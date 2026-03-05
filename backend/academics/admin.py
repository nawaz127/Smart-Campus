from django.contrib import admin

from .models import AcademicRecord, Attendance, AuditLog, InterventionQueue, Student, TeacherAssignment


@admin.action(description="Archive selected students")
def archive_students(modeladmin, request, queryset):
    queryset.update(is_archived=True)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("student_code", "full_name", "class_name", "school", "parent", "is_archived")
    list_filter = ("school", "class_name", "is_archived")
    search_fields = ("student_code", "full_name", "parent__email")
    actions = [archive_students]


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("date", "student", "status", "teacher")
    list_filter = ("date", "status", "student__school")
    search_fields = ("student__full_name", "student__student_code")


@admin.register(AcademicRecord)
class AcademicRecordAdmin(admin.ModelAdmin):
    list_display = ("student", "subject", "assessment", "score", "exam_date", "created_by")
    list_filter = ("subject", "exam_date", "student__school")
    search_fields = ("student__full_name", "student__student_code")


@admin.register(InterventionQueue)
class InterventionAdmin(admin.ModelAdmin):
    list_display = ("student", "priority", "is_closed", "created_at")
    list_filter = ("priority", "is_closed", "student__school")


@admin.register(TeacherAssignment)
class TeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "class_name", "subject", "school")
    list_filter = ("school", "class_name", "subject")
    search_fields = ("teacher__email", "class_name", "subject")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "target_type", "target_id", "actor", "school")
    list_filter = ("school", "action", "target_type")
    search_fields = ("target_id", "actor__email")
