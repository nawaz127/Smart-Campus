from django.urls import re_path

from .consumers import AttendanceConsumer, ParentTimelineConsumer

websocket_urlpatterns = [
    re_path(r"ws/attendance/(?P<school_id>\d+)/$", AttendanceConsumer.as_asgi()),
    re_path(r"ws/parent-timeline/(?P<parent_id>\d+)/$", ParentTimelineConsumer.as_asgi()),
]
