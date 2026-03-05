# Smart Campus API Guide

This document contains authentication flow, endpoint usage patterns, and ready-to-run request examples.

Base URL (local): `http://127.0.0.1:8000`

API version prefix: `/api/v1`

## 1. Authentication

### Obtain JWT token

`POST /api/v1/auth/token/`

Request:

```json
{
  "email": "teacher@bssc.local",
  "password": "Demo12345!"
}
```

Response:

```json
{
  "refresh": "<refresh_token>",
  "access": "<access_token>"
}
```

Use header:

`Authorization: Bearer <access_token>`

### Refresh token

`POST /api/v1/auth/token/refresh/`

```json
{
  "refresh": "<refresh_token>"
}
```

## 2. Core Endpoints

- Schools: `GET /api/v1/schools/`
- Students: `GET|POST /api/v1/students/`
- Student detail: `GET|PUT|PATCH|DELETE /api/v1/students/{id}/`
- Trigger prediction: `POST /api/v1/students/{id}/trigger_prediction/`
- Academic records: `GET|POST /api/v1/academic-records/`
- Attendance: `GET|POST /api/v1/attendance/`
- Attendance bulk: `POST /api/v1/attendance/bulk_mark/`
- Interventions: `GET /api/v1/interventions/`
- AI inference logs: `GET /api/v1/inference-logs/`
- Pulse snapshot: `GET /api/v1/pulse/?school=1`
- System summary: `GET /api/v1/system-summary/?school=1`
- Yearbook queue: `POST /api/v1/yearbooks/generate/`

## 3. cURL Examples

### Login

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@bssc.local","password":"Demo12345!"}'
```

### List students

```bash
curl http://127.0.0.1:8000/api/v1/students/ \
  -H "Authorization: Bearer <access_token>"
```

### Create student

```bash
curl -X POST http://127.0.0.1:8000/api/v1/students/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "school": 1,
    "parent": 25,
    "student_code": "C08S04",
    "full_name": "Student 8-4",
    "class_name": "8",
    "roll_number": 4,
    "success_prediction": 78,
    "focus_score": 84
  }'
```

### Bulk mark attendance

```bash
curl -X POST http://127.0.0.1:8000/api/v1/attendance/bulk_mark/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-03-05",
    "records": [
      {"student": 22, "status": "PRESENT"},
      {"student": 23, "status": "ABSENT"},
      {"student": 24, "status": "LATE"}
    ]
  }'
```

### Create academic record

```bash
curl -X POST http://127.0.0.1:8000/api/v1/academic-records/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "student": 22,
    "subject": "Math",
    "assessment": "Quiz 4",
    "score": 81,
    "max_score": 100,
    "exam_date": "2026-03-05"
  }'
```

### Get executive system summary

```bash
curl "http://127.0.0.1:8000/api/v1/system-summary/?school=1" \
  -H "Authorization: Bearer <access_token>"
```

## 4. WebSocket Endpoints

- Attendance stream: `ws://127.0.0.1:8000/ws/attendance/{school_id}/`
- Parent storyline: `ws://127.0.0.1:8000/ws/parent-timeline/{parent_id}/`

If local realtime is disabled, websocket events may not be emitted.

## 5. Error Codes (Common)

- `400`: Validation problem (missing/invalid fields)
- `401`: Missing/expired JWT
- `403`: Role not allowed for endpoint
- `404`: Resource not found

## 6. Role Access Summary

- `ADMIN`: full management access
- `TEACHER`: attendance and academic operations in own school
- `PARENT`: read-only access to own child scope

## 7. API Docs UI

- Swagger: `http://127.0.0.1:8000/api/schema/swagger/`
- Redoc: `http://127.0.0.1:8000/api/schema/redoc/`
