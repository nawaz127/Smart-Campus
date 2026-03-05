# Begum Shahanara Smart Campus

AI-first educational platform with a Django 5 backend and a React + Vite mission-control frontend.

This document is the complete project handbook for developers and operators.

## 1. Product Overview

The system provides:

- Multi-role operations: `ADMIN`, `TEACHER`, `PARENT`
- Student management and class-wise attendance
- AI-driven intervention queue and success prediction
- Parent storyline and live campus signals
- Executive mission dashboard with full system summary

## 2. Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind, motion
- Backend: Django 5, Django REST Framework, SimpleJWT
- Realtime: Django Channels (WebSockets)
- Async jobs: Celery
- Data stores: PostgreSQL (prod), SQLite (local option), Redis (prod realtime/queue)
- API docs: drf-spectacular (OpenAPI, Swagger, Redoc)

## 3. Repository Structure

- `src/`: frontend app
- `backend/`: Django project
- `backend/accounts/`: custom user model and RBAC roles
- `backend/campus/`: school model and tenancy basics
- `backend/academics/`: students, attendance, academic records, interventions
- `backend/analytics_engine/`: AI logic, inference logs, Celery tasks, signals
- `backend/notifications/`: websocket consumers and realtime publishing
- `backend/api/`: DRF serializers, viewsets, routes

## 4. Prerequisites

- Node.js 20+
- Python 3.11+
- pip
- Windows PowerShell (for commands below)

Optional for production-like local setup:

- PostgreSQL 15+
- Redis 7+

## 5. Local Development Setup

### Frontend

```powershell
cd C:\Smart-Campus-main
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

### Backend (Windows safest path)

```powershell
cd C:\Smart-Campus-main\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Migrate and seed:

```powershell
$env:USE_SQLITE="true"
$env:USE_ASYNC_TASKS="false"
$env:ENABLE_REALTIME_PUSH="false"
python manage.py makemigrations
python manage.py migrate
python manage.py seed_demo_data
python manage.py createsuperuser
```

Start backend:

```powershell
.\start_local.ps1
```

Backend URL: `http://127.0.0.1:8000`

Root health endpoint: `http://127.0.0.1:8000/`

## 6. Demo Data and Credentials

Seed command creates:

- Classes `1` to `10`
- `3` students per class (`30` total)
- `14` days attendance history (`420` rows)
- Academic records (`120` rows)

Credentials:

- Admin: `admin@bssc.local` / `Demo12345!`
- Teacher: `teacher@bssc.local` / `Demo12345!`
- Parent pattern: `parentXY@bssc.local` / `Demo12345!`

## 7. How To Manage the Full System

### Daily operations (UI)

1. `Mission` tab:
- executive system summary
- attendance command metrics
- risk distribution
- class coverage matrix
- recent operational alerts

2. `Students` tab:
- verify student roster
- inspect success and focus indicators

3. `Attendance` tab:
- choose class
- choose date
- mark `PRESENT`, `ABSENT`, or `LATE`
- click `Save Attendance`

### Administrative operations (Django Admin)

Use `http://127.0.0.1:8000/admin/` to:

- create/edit users and roles
- add parents and map students
- inspect attendance and records
- correct data manually when needed

### API operations (Swagger)

Use `http://127.0.0.1:8000/api/schema/swagger/` to:

- test JWT login
- create/update students
- bulk mark attendance
- trigger AI and review logs

## 8. Server Management Guide

### A) Local server lifecycle

Start backend safely (venv + local flags):

```powershell
cd C:\Smart-Campus-main\backend
.\start_local.ps1
```

Start frontend:

```powershell
cd C:\Smart-Campus-main
npm run dev
```

Stop servers:

- Press `Ctrl + C` in each terminal.

### B) Recommended terminal layout

- Terminal 1: backend (`start_local.ps1`)
- Terminal 2: frontend (`npm run dev`)
- Terminal 3: optional worker (when async enabled)

### C) Production mode concept

Use:

- Django ASGI service (Daphne/Uvicorn)
- Celery worker service
- Redis service
- PostgreSQL service
- Reverse proxy (Nginx)

Enable production flags:

- `USE_SQLITE=false`
- `USE_ASYNC_TASKS=true`
- `ENABLE_REALTIME_PUSH=true`
- set `DB_*`, `REDIS_URL`, `CELERY_*`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`

## 9. Environment Variables

Core:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`

Database:

- `DB_ENGINE`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `USE_SQLITE`

Queue/realtime:

- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `USE_ASYNC_TASKS`
- `ENABLE_REALTIME_PUSH`

## 10. Main API Endpoints

- JWT login: `POST /api/v1/auth/token/`
- JWT refresh: `POST /api/v1/auth/token/refresh/`
- Students: `/api/v1/students/`
- Academic records: `/api/v1/academic-records/`
- Attendance list/create: `/api/v1/attendance/`
- Attendance bulk save: `POST /api/v1/attendance/bulk_mark/`
- Interventions: `/api/v1/interventions/`
- AI inference logs: `/api/v1/inference-logs/`
- Pulse: `/api/v1/pulse/?school=<id>`
- Executive summary: `/api/v1/system-summary/?school=<id>`
- Yearbook queue: `POST /api/v1/yearbooks/generate/`

## 11. API Documentation

- OpenAPI: `/api/schema/`
- Swagger: `/api/schema/swagger/`
- Redoc: `/api/schema/redoc/`

## 12. Troubleshooting

### `ModuleNotFoundError: celery`

Cause: system Python used instead of venv.

Fix:

```powershell
cd C:\Smart-Campus-main\backend
.\start_local.ps1
```

### `can't open file ... manage.py`

Cause: running command from wrong directory.

Fix:

```powershell
cd C:\Smart-Campus-main\backend
python manage.py check
```

### Port already in use `127.0.0.1:8000`

Cause: another backend instance already running.

Fix: stop old process or run a different port.

### Attendance save fails intermittently

Cause: expired JWT in browser.

Status: frontend now auto-retries auth once.

### Redis connection errors in local

Use local-safe flags:

```powershell
$env:USE_ASYNC_TASKS="false"
$env:ENABLE_REALTIME_PUSH="false"
```

## 13. Operational Checklist

Before every session:

1. Start backend with `start_local.ps1`
2. Start frontend with `npm run dev`
3. Verify API health at `http://127.0.0.1:8000/`
4. Open dashboard and test one attendance save

Before release:

1. `npm run lint`
2. `python manage.py check`
3. verify migrations and seed scripts
4. verify role restrictions and API docs
