import json

from channels.generic.websocket import AsyncWebsocketConsumer


class AttendanceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.school_id = self.scope["url_route"]["kwargs"]["school_id"]
        self.room_group_name = f"attendance_{self.school_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def attendance_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


class ParentTimelineConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.parent_id = self.scope["url_route"]["kwargs"]["parent_id"]
        self.room_group_name = f"parent_timeline_{self.parent_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def timeline_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
