from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from academics.models import AcademicRecord
from analytics_engine.tasks import update_student_success_prediction


@receiver(post_save, sender=AcademicRecord)
def trigger_ai_prediction_on_grade_save(sender, instance: AcademicRecord, created: bool, **kwargs) -> None:
    if created:
        if settings.USE_ASYNC_TASKS:
            update_student_success_prediction.delay(instance.student_id, trigger="grade_entered")
        else:
            update_student_success_prediction(instance.student_id, trigger="grade_entered")
