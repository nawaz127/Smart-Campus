from django.db import models


class AIInferenceLog(models.Model):
    student = models.ForeignKey("academics.Student", on_delete=models.CASCADE, related_name="inference_logs")
    trigger = models.CharField(max_length=100)
    risk_level = models.CharField(max_length=10)
    confidence = models.FloatField(default=0.0)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class CampusPulseSnapshot(models.Model):
    school = models.ForeignKey("campus.School", on_delete=models.CASCADE, related_name="pulse_snapshots")
    pulse_score = models.FloatField()
    attendance_component = models.FloatField()
    performance_component = models.FloatField()
    finance_component = models.FloatField(default=75.0)
    captured_at = models.DateTimeField(auto_now_add=True)
