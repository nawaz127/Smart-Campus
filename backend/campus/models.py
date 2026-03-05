from django.db import models


class School(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    primary_color = models.CharField(max_length=20, default="#22c55e")
    secondary_color = models.CharField(max_length=20, default="#0f172a")
    attendance_threshold = models.PositiveSmallIntegerField(default=75)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name
