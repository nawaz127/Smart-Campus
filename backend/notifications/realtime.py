from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings


def publish_attendance_update(school_id: int, payload: dict) -> None:
    if not settings.ENABLE_REALTIME_PUSH:
        return
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"attendance_{school_id}",
            {"type": "attendance_event", "payload": payload},
        )
    except Exception:
        # Ignore realtime push failures in local/offline mode.
        return


def publish_parent_timeline_event(school_id: int, parent_user_id: int, event: dict) -> None:
    if not settings.ENABLE_REALTIME_PUSH:
        return
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"parent_timeline_{parent_user_id}",
            {
                "type": "timeline_event",
                "payload": {
                    "school_id": school_id,
                    "event": event,
                },
            },
        )
    except Exception:
        return
