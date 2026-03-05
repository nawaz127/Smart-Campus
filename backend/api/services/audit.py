from typing import Any

from django.contrib.auth import get_user_model

from academics.models import AuditLog

User = get_user_model()


def log_action(*, actor: User, action: str, target_type: str, target_id: Any, payload: dict[str, Any] | None = None) -> None:
    if not actor or not getattr(actor, "is_authenticated", False):
        return
    if not getattr(actor, "school_id", None):
        return
    AuditLog.objects.create(
        school_id=actor.school_id,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        payload=payload or {},
    )
