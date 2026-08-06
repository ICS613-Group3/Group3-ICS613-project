# Neighborhood Tool Sharing — Deployment Guide

**Team:** Group 3 — ICS 613
**Project:** Neighborhood Tool Sharing (Full-Stack Web Application)
**Stack:** FastAPI + PostgreSQL (backend) · React + Vite (frontend)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Local Development Setup](#3-local-development-setup)
4. [Docker Configuration](#4-docker-configuration)
5. [Environment Variables](#5-environment-variables)
6. [Database Initialization](#6-database-initialization)
7. [Seed Data](#7-seed-data)
8. [Health Checks](#8-health-checks)
9. [Troubleshooting](#9-troubleshooting)
10. [Known Limitations](#10-known-limitations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                   │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                │
│                   Port: 5173 (dev)                      │
│                   Proxies /api/* → Backend               │
└─────────────────────────┬───────────────────────────────┘
                          │ /api/v1/*
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Uvicorn)            │
│                   Port: 8000                             │
│                   JWT Auth, REST API                     │
└─────────────────────────┬───────────────────────────────┘
                          │ DATABASE_URL
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL 15 (Docker)                 │
│                   Port: 5432                             │
│                   Container: tool-db                     │
└─────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- Backend runs on the host (not in Docker) for faster hot-reload during development
- PostgreSQL runs in Docker for consistent, reproducible database setup
- Frontend uses Vite's proxy to forward `/api/*` to the backend, avoiding CORS issues

---

## 2. Prerequisites

| Program | Minimum Version | Check Command |
|---------|----------------|---------------|
| Git | 2.30+ | `git --version` |
| Python | 3.11, 3.12, or 3.13 | `python --version` |
| Node.js | 20.19+ or 22.12+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |

> **Windows Note:** The official Python installer registers `python` (not `python3`)
> on PATH. Use `python` instead of `python3` in all commands below. Activate the
> venv with `venv\Scripts\activate` instead of `source venv/bin/activate`.

---

## 3. Local Development Setup

### 3.1 Clone the Repository

```bash
git clone https://github.com/ICS613-Group3/Group3-ICS613-project.git
cd Group3-ICS613-project
```

### 3.2 Start PostgreSQL (Docker)

```bash
cd backend
docker compose up -d
```

Wait until `tool-db` shows `(healthy)` and the pgadmin container shows `(running)`.

```bash
docker compose ps
```

**Verify database connectivity:**

```bash
docker exec tool-db psql -U ics613user -d toolsharing -c "SELECT 1;"
# Should return: 1
```

The init script at `db/init/` auto-creates both `toolsharing` and `toolsharing_test`
databases on first boot.

### 3.3 Set Up Backend

```bash
# (still in backend/ from step 3.2)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt

cp .env.example .env
```

> `.env.example` already includes `ENVIRONMENT=development` and default connection
> settings. For local development, no edits are required.

### 3.4 Initialize Database

```bash
python scripts/init_db.py
# Expected: All tables created successfully.
```

### 3.5 Load Seed Data (Optional)

```bash
SEED_PASSWORD=devpass123 python scripts/seed_dev.py
# Expected: Seed data created.
```

**Seed Users (all password: `devpass123`):**  <!-- pragma: allowlist secret -->

| Email | Role |
|-------|------|
| `admin@example.com` | Admin |
| `member01@example.com` | Owner |
| `member02@example.com` | Borrower |

### 3.6 Start Backend

```bash
python run.py --port 8000
# Expected: Uvicorn running on http://0.0.0.0:8000
```

**Verify:**

```bash
curl http://localhost:8000/api/v1/health
# Returns: {"status":"ok"}
```

Interactive API documentation: `http://localhost:8000/docs`

### 3.7 Set Up Frontend (Second Terminal)

```bash
# From the repository root:
cd frontend
npm install
npm run dev
# Vite starts on http://localhost:5173
```

> The frontend dev server proxies `/api/*` and `/uploads/*` to `http://localhost:8000`
> (configured in `vite.config.ts`). This means `/api/v1/health` reaches the backend
> without CORS issues.

**Verify proxy:**

```bash
curl http://localhost:5173/api/v1/health
# Returns: {"status":"ok"}
```

If you get a 502 Bad Gateway, the backend is not running. Go back to step 3.6.

### 3.8 Build Frontend for Production (Optional)

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

To preview the production build locally:

```bash
npm run preview -- --port 4173 --host 0.0.0.0
```

---

## 4. Docker Configuration

### docker-compose.yml (Database)

PostgreSQL runs inside Docker for a consistent, reproducible setup. The backend
and frontend both run on the host — no Dockerfile needed for local development.

```yaml
# backend/docker-compose.yml
name: tool-share

services:
  db:
    image: postgres:15
    container_name: tool-db
    restart: always
    environment:
      POSTGRES_USER: ics613user
      POSTGRES_PASSWORD: ics613password
      POSTGRES_DB: toolsharing
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ics613user -d toolsharing"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    restart: always
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: devpass123
      PGADMIN_CONFIG_SERVER_MODE: "False"
      PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: False
    ports:
      - "${PGADMIN_PORT:-5050}:80"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      db:
        condition: service_healthy

volumes:
  postgres_data:
  pgadmin_data:
```

---

## 5. Environment Variables

### Backend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing` |  <!-- pragma: allowlist secret -->
| `ENVIRONMENT` | `development` or `production` | `development` |
| `SECRET_KEY` | JWT signing key | Placeholder (dev only) |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000,http://localhost:5173` |
| `DISABLE_SCHEDULER` | Disable background scheduler | `false` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (465 = SSL, 587 = STARTTLS) | `465` |
| `SMTP_USER` | SMTP username | (empty) |
| `SMTP_PASSWORD` | SMTP password / app password | (empty) |
| `SMTP_FROM` | From address for emails | `noreply@toolsharing.local` |

### Docker Compose (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PORT` | PostgreSQL host port | `5432` |
| `PGADMIN_PORT` | pgAdmin host port | `5050` |

---

## 6. Database Initialization

### First Time Setup

```bash
# 1. Start PostgreSQL
cd backend && docker compose up -d

# 2. Create tables
python scripts/init_db.py

# 3. Seed demo data (optional)
SEED_PASSWORD=devpass123 python scripts/seed_dev.py
```

### Reset Database

```bash
# Drop all tables and recreate
docker exec tool-db psql -U ics613user -d toolsharing \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
python scripts/init_db.py
SEED_PASSWORD=devpass123 python scripts/seed_dev.py
```

---

## 7. Seed Data

The seed script creates:

- **3 demo users** — `admin@example.com` (Admin), `member01@example.com` (Owner),
  `member02@example.com` (Borrower) — all password `devpass123`
- **2 invite tokens** — one pending (`newmember@example.com`), one used
- **5 tool categories** — Hand Tools, Power Tools, Garden Tools, Cleaning Tools,
  Outdoor Gear
- **12 tool listings** with photos
- **7 reservations** — covering REQUESTED, PICKED_UP, and RETURNED states (used by
  the Playwright e2e suite and manual testing)
- **4 reviews** — on RETURNED reservations (US24/US25 demo data)
- **3 notifications** for member02 — 2 unread, 1 read

**Usage:**

```bash
SEED_PASSWORD=devpass123 python scripts/seed_dev.py
```

If `SEED_PASSWORD` is unset, the script generates a random password and prints it.

---

## 8. Health Checks

### Backend Health

```bash
curl http://localhost:8000/api/v1/health
# Returns: {"status":"ok"}
```

### Database Health

```bash
docker exec tool-db pg_isready -U ics613user -d toolsharing
# Returns: /var/run/postgresql:5432 - accepting connections
```

### Docker Compose Status

```bash
cd backend && docker compose ps
```

---

## 9. Troubleshooting

### Common Issues

**Port already in use:**

```bash
lsof -i :5432            # Find what's using PostgreSQL port
lsof -i :8000            # Find what's using backend port
# Kill the conflicting process, or change the port via .env / command line
```

**Database connection refused:**

```bash
docker info               # Check Docker daemon is running
cd backend && docker compose ps  # Check tool-db is healthy
docker compose down && docker compose up -d  # Restart
```

**Seed script fails with duplicate key:**

```bash
# Database already has data. Reset it:
docker exec tool-db psql -U ics613user -d toolsharing \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
python scripts/init_db.py
SEED_PASSWORD=devpass123 python scripts/seed_dev.py
```

**Frontend can't reach backend (502 Bad Gateway):**

```bash
curl http://localhost:8000/api/v1/health  # Check backend
curl http://localhost:5173/api/v1/health  # Check proxy
# If first passes but second fails, restart Vite
```

**pip install fails with build errors:**

```bash
# Ensure system build tools are installed:
sudo apt-get install -y gcc libpq-dev python3-dev  # Ubuntu/Debian
# On macOS: xcode-select --install
# Then retry: pip install -r requirements.txt
```

---

## 10. Known Limitations

1. **No SSL/TLS** — Local development runs over HTTP with no encryption. This is
   acceptable for development and localhost demos.

2. **No automated migrations** — The backend uses SQLAlchemy `create_all()` with
   CREATE TABLE IF NOT EXISTS (idempotent). Schema changes to existing columns
   require dropping and recreating the schema. New tables are added automatically.

3. **Photo storage on local filesystem** — Tool photos are stored in
   `backend/media/tool_photos/`. This directory is gitignored and must be created
   on first run (handled automatically by the application).

4. **Rate limits are generous** — Default rate limits (50/min) are suitable for
   development but should be tightened to 5–10/min for production via environment
   variables.

5. **Scheduler runs on the host** — Background tasks (auto-cancel overdue pickups,
   auto-escalate returns) run in-process within Uvicorn. Set `DISABLE_SCHEDULER=true`
   to disable them.

6. **SMTP is optional for development** — Email sending failures are logged but do
   not block application startup or user registration. The seed data provides
   pre-verified accounts for testing.

---

*Last verified: Tue 7/29/2026 — all steps validated on a clean setup.*
