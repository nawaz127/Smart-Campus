# Smart Campus Deployment Guide

This guide describes a production deployment for the Smart Campus platform on Ubuntu with Nginx, systemd, PostgreSQL, Redis, Django ASGI, and Celery.

## 1. Target Architecture

- Frontend: Vite build served by Nginx
- Backend: Django ASGI app (Daphne)
- Worker: Celery worker service
- Database: PostgreSQL
- Queue/Realtime: Redis
- Reverse proxy: Nginx

## 2. Prerequisites

- Ubuntu 22.04+
- Domain name (optional but recommended)
- Python 3.11+
- Node.js 20+
- sudo access

## 3. Install System Packages

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx redis-server postgresql postgresql-contrib git
```

Enable services:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 4. Database Setup (PostgreSQL)

```bash
sudo -u postgres psql
```

In psql:

```sql
CREATE DATABASE smartcampus;
CREATE USER smartcampus_user WITH PASSWORD 'change_this_password';
ALTER ROLE smartcampus_user SET client_encoding TO 'utf8';
ALTER ROLE smartcampus_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE smartcampus_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE smartcampus TO smartcampus_user;
\q
```

## 5. Deploy Application Code

```bash
cd /opt
sudo git clone https://github.com/nawaz127/Smart-Campus.git
sudo chown -R $USER:$USER /opt/Smart-Campus
cd /opt/Smart-Campus/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 6. Environment Variables

Create `/opt/Smart-Campus/backend/.env.production`:

```env
DJANGO_SECRET_KEY=replace_with_strong_secret
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=your-domain.com,server-ip
CSRF_TRUSTED_ORIGINS=https://your-domain.com

DB_ENGINE=django.db.backends.postgresql
DB_NAME=smartcampus
DB_USER=smartcampus_user
DB_PASSWORD=change_this_password
DB_HOST=127.0.0.1
DB_PORT=5432

REDIS_URL=redis://127.0.0.1:6379/1
CELERY_BROKER_URL=redis://127.0.0.1:6379/1
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1

USE_SQLITE=false
USE_ASYNC_TASKS=true
ENABLE_REALTIME_PUSH=true
```

## 7. Migrations and Static Files

```bash
cd /opt/Smart-Campus/backend
source .venv/bin/activate
set -a
source .env.production
set +a
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

## 8. Build Frontend

```bash
cd /opt/Smart-Campus
npm install
npm run build
```

## 9. systemd Service: Django (Daphne)

Create `/etc/systemd/system/smartcampus-daphne.service`:

```ini
[Unit]
Description=Smart Campus Daphne ASGI Service
After=network.target redis-server.service postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/Smart-Campus/backend
EnvironmentFile=/opt/Smart-Campus/backend/.env.production
ExecStart=/opt/Smart-Campus/backend/.venv/bin/daphne -b 127.0.0.1 -p 8000 smartcampus.asgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 10. systemd Service: Celery Worker

Create `/etc/systemd/system/smartcampus-celery.service`:

```ini
[Unit]
Description=Smart Campus Celery Worker
After=network.target redis-server.service postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/Smart-Campus/backend
EnvironmentFile=/opt/Smart-Campus/backend/.env.production
ExecStart=/opt/Smart-Campus/backend/.venv/bin/celery -A smartcampus worker --loglevel=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartcampus-daphne
sudo systemctl start smartcampus-daphne
sudo systemctl enable smartcampus-celery
sudo systemctl start smartcampus-celery
```

## 11. Nginx Configuration

Create `/etc/nginx/sites-available/smartcampus`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /opt/Smart-Campus/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /static/ {
        alias /opt/Smart-Campus/backend/staticfiles/;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/smartcampus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 12. TLS (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 13. Operations and Monitoring

Check services:

```bash
sudo systemctl status smartcampus-daphne
sudo systemctl status smartcampus-celery
sudo systemctl status nginx
```

Logs:

```bash
sudo journalctl -u smartcampus-daphne -f
sudo journalctl -u smartcampus-celery -f
sudo tail -f /var/log/nginx/error.log
```

## 14. Backup Strategy

- PostgreSQL daily dump
- Keep at least 7 rolling backups
- Copy backups to offsite storage

Example cron script:

```bash
pg_dump -U smartcampus_user -h 127.0.0.1 smartcampus > /var/backups/smartcampus_$(date +%F).sql
```

## 15. Rollback Plan

- Keep previous git tag deployed
- Revert service to previous release commit
- Restore latest healthy DB dump if migration causes break
