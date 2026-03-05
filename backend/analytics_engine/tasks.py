from celery import shared_task
from django.db.models import Avg

from academics.models import AcademicRecord, Attendance, InterventionQueue, Student
from analytics_engine.ai_logic import predict_student_success
from analytics_engine.models import AIInferenceLog
from notifications.realtime import publish_parent_timeline_event


@shared_task(bind=True, max_retries=3)
def update_student_success_prediction(self, student_id: int, trigger: str = "grade_entered") -> dict:
    student = Student.objects.get(id=student_id)
    grade_values = list(student.academic_records.order_by("exam_date").values_list("score", flat=True))

    attendance = Attendance.objects.filter(student=student)
    present_count = attendance.filter(status="PRESENT").count()
    attendance_rate = (present_count / attendance.count() * 100) if attendance.exists() else 100

    result = predict_student_success(grade_values, attendance_rate, float(student.focus_score))

    student.success_prediction = result.success_prediction
    student.save(update_fields=["success_prediction"])

    AIInferenceLog.objects.create(
        student=student,
        trigger=trigger,
        risk_level=result.risk_level,
        confidence=result.confidence,
        payload={
            "factors": result.factors,
            "recommendation": result.recommendation,
            "attendance_rate": attendance_rate,
            "mean_score": round(sum(grade_values) / len(grade_values), 2) if grade_values else 0,
        },
    )

    if result.risk_level in {"HIGH", "MEDIUM"}:
        InterventionQueue.objects.create(
            student=student,
            priority=result.risk_level,
            recommendation=result.recommendation,
            rationale="; ".join(result.factors) or "AI-triggered intervention",
        )

    publish_parent_timeline_event(
        school_id=student.school_id,
        parent_user_id=student.parent_id,
        event={
            "kind": "MOMENT_OF_EXCELLENCE" if result.risk_level == "LOW" else "INTERVENTION_SIGNAL",
            "student_id": student.id,
            "student_name": student.full_name,
            "message": f"{student.full_name} success prediction updated to {result.success_prediction:.0f}%.",
        },
    )

    return {
        "student_id": student.id,
        "risk_level": result.risk_level,
        "success_prediction": result.success_prediction,
    }
