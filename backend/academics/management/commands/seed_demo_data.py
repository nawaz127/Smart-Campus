from datetime import date, timedelta
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from academics.models import AcademicRecord, Attendance, Student
from campus.models import School

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo campus data for classes 1-10 with working attendance records."

    @transaction.atomic
    def handle(self, *args, **options):
        school, _ = School.objects.get_or_create(
            slug="bssc-main",
            defaults={
                "name": "Begum Shahanara Smart Campus",
                "primary_color": "#22c55e",
                "secondary_color": "#0f172a",
                "attendance_threshold": 75,
            },
        )

        admin_user, _ = User.objects.get_or_create(
            email="admin@bssc.local",
            defaults={
                "username": "admin_bssc",
                "role": "ADMIN",
                "school": school,
                "phone": "+8801700000001",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin_user.set_password("Demo12345!")
        admin_user.save()

        teacher_user, _ = User.objects.get_or_create(
            email="teacher@bssc.local",
            defaults={
                "username": "teacher_bssc",
                "role": "TEACHER",
                "school": school,
                "phone": "+8801700000002",
                "is_staff": True,
            },
        )
        teacher_user.set_password("Demo12345!")
        teacher_user.save()

        student_count = 0
        attendance_count = 0
        record_count = 0

        subjects = ["Math", "English", "Science", "Bangla"]

        for class_no in range(1, 11):
            for idx in range(1, 4):
                parent_email = f"parent{class_no}{idx}@bssc.local"
                parent, _ = User.objects.get_or_create(
                    email=parent_email,
                    defaults={
                        "username": f"parent_{class_no}_{idx}",
                        "role": "PARENT",
                        "school": school,
                        "phone": f"+88017010{class_no:02d}{idx:02d}",
                    },
                )
                parent.set_password("Demo12345!")
                parent.save()

                code = f"C{class_no:02d}S{idx:02d}"
                student, created = Student.objects.get_or_create(
                    student_code=code,
                    defaults={
                        "school": school,
                        "parent": parent,
                        "full_name": f"Student {class_no}-{idx}",
                        "class_name": str(class_no),
                        "roll_number": idx,
                        "success_prediction": random.randint(60, 95),
                        "focus_score": random.randint(58, 98),
                    },
                )
                if created:
                    student_count += 1

                for day_offset in range(0, 14):
                    target_date = date.today() - timedelta(days=day_offset)
                    status = random.choices(["PRESENT", "ABSENT", "LATE"], weights=[78, 14, 8], k=1)[0]
                    _, att_created = Attendance.objects.update_or_create(
                        student=student,
                        date=target_date,
                        defaults={
                            "teacher": teacher_user,
                            "status": status,
                            "notes": "Auto-seeded attendance",
                        },
                    )
                    if att_created:
                        attendance_count += 1

                for subject in subjects:
                    assessment_date = date.today() - timedelta(days=random.randint(10, 45))
                    _, rec_created = AcademicRecord.objects.get_or_create(
                        student=student,
                        subject=subject,
                        assessment=f"Monthly Test {subject}",
                        exam_date=assessment_date,
                        defaults={
                            "score": random.randint(52, 99),
                            "max_score": 100,
                            "created_by": teacher_user,
                        },
                    )
                    if rec_created:
                        record_count += 1

        self.stdout.write(self.style.SUCCESS("Demo dataset seeded successfully."))
        self.stdout.write(f"Students created: {student_count}")
        self.stdout.write(f"Attendance rows created: {attendance_count}")
        self.stdout.write(f"Academic records created: {record_count}")
        self.stdout.write("Login users: admin@bssc.local / teacher@bssc.local / parentXY@bssc.local")
        self.stdout.write("Password for all demo users: Demo12345!")
