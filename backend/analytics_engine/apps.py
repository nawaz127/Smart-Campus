from django.apps import AppConfig


class AnalyticsEngineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "analytics_engine"

    def ready(self) -> None:
        from . import signals  # noqa: F401
