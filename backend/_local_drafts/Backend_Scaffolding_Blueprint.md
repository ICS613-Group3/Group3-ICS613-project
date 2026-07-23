# Backend Scaffolding Blueprint — FastAPI + Async SQLAlchemy + PostgreSQL + Docker

**Project:** ICS 613 — Neighborhood Tool Sharing Platform  
**Team:** Group 3  
**Scope:** Backend only  
**Date:** June 22, 2026  
**Sources:** `_local_drafts/Technical_Design_Backend.md`, `_local_drafts/Phasing_Plan_with_Roles.md`, and the latest v5 user stories and acceptance criteria.

---

## 1. Purpose of this blueprint

This document is the **scaffolding blueprint** the backend team will follow to build a production-ready FastAPI backend. It updates the existing technical design to use **SQLAlchemy 2.0 async sessions** (`AsyncSession`) and the **asyncpg** PostgreSQL driver, while keeping the N-Tier / Repository / Service architecture, the v5 data model, and the R1/R2 phasing plan unchanged.

It defines:

- The exact directory tree and file responsibilities.
- The technology stack and dependency versions.
- The database model summary, indexes, and constraints.
- The API surface grouped by router.
- The service-layer responsibilities mapped to user stories.
- Docker, environment, migration, test, and lint commands.
- A phased implementation order aligned with R1.A, R1.B, R1.C, and R2.A.

> **Note:** This is the blueprint to be scaffolded. The next step is to generate the actual files (`app/`, `alembic/`, `tests/`, `Dockerfile`, and so on) from this plan.

---

## 2. Guiding principles

1. **v5 requirements win.** Where the existing old code and the v5 user stories disagree, the v5 stories and acceptance criteria are the source of truth.
2. **Async first.** Every database operation uses SQLAlchemy `AsyncSession` with `asyncpg`. Sync helpers (for example, Alembic offline mode or a quick dev check script) are allowed only where they do not touch the main request path.
3. **N-Tier with Repository / Service pattern.**
   - **API layer** (`app/api/v1/*.py`) — parses requests, validates with Pydantic v2, calls services, returns responses.
   - **Service layer** (`app/services/*.py`) — contains all business logic, state-machine enforcement, authorization checks, and side effects (notifications, audit log).
   - **Repository / data layer** (`app/models/*.py`, `app/db/session.py`) — SQLAlchemy models and async session management. Services interact with the ORM directly; a separate repository module is optional if queries stay simple.
4. **PostgreSQL-native type safety.** Native `ENUM` types, a GiST `EXCLUDE` constraint to stop double-booking, and proper indexes.
5. **Security defaults.** bcrypt 12 rounds, HS256 JSON Web Tokens (JWT), short access-token lifetime, `password_changed_at` invalidation, anti-enumeration on forgot-password and resend-verification, and a default secret that is rejected in production.
6. **Timezone discipline.** All business dates are interpreted as Hawaii-Aleutian Standard Time (HST, UTC-10). Storage uses `TIMESTAMPTZ`; the `normalize_hst()` helper converts user input to the start of the HST calendar day in UTC.
7. **No scope creep.** Icebox stories (US28 Admin Manages Tool Categories, US33 Admin Generates Community Moderation Reports) are documented as known limitations and are not implemented unless the project manager explicitly moves them into scope.

---

## 3. Directory tree

```text
backend/
├── Dockerfile                          # Multi-stage Python image for production
├── docker-compose.yml                  # Postgres + backend + (optional) MailHog
├── docker-compose.override.yml         # Dev-only overrides (volume mounts, reload)
├── .env.example                        # Template environment variables
├── .env                                # Gitignored local secrets (created from example)
├── pyproject.toml                      # ruff, mypy, pytest, and project metadata
├── requirements.txt                    # Pinned runtime + dev dependencies
├── alembic.ini                         # Alembic configuration
├── alembic/
│   ├── env.py                          # Async Alembic migration runner
│   ├── script.py.mako                  # Migration template
│   └── versions/                       # Generated migrations (git-tracked)
├── src/
│   └── app/
│       ├── __init__.py
│       ├── main.py                     # FastAPI factory, CORS, exception handlers, scheduler
│       ├── config.py                   # pydantic-settings from .env
│       ├── dependencies.py             # Common FastAPI dependencies (current_user, db_session)
│       ├── core/
│       │   ├── __init__.py
│       │   ├── security.py             # bcrypt, JWT mint/verify, token pair helpers
│       │   ├── exceptions.py           # AppError hierarchy and HTTP mappings
│       │   └── logging.py              # Structured logging config
│       ├── db/
│       │   ├── __init__.py
│       │   ├── base.py                 # Async SQLAlchemy declarative Base + MetaData
│       │   └── session.py              # async_engine, AsyncSessionLocal, get_db()
│       ├── models/
│       │   ├── __init__.py
│       │   ├── enums.py                # All PostgreSQL ENUM definitions
│       │   ├── user.py
│       │   ├── invite.py
│       │   ├── email_verification.py
│       │   ├── password_reset.py
│       │   ├── tool.py
│       │   ├── photo.py
│       │   ├── reservation.py
│       │   ├── message.py
│       │   ├── notification.py
│       │   ├── review.py
│       │   ├── listing_report.py
│       │   ├── suspension_record.py
│       │   ├── admin_audit_log.py
│       │   └── listing_rules.py        # ICEBOX — schema stub only
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── common.py               # Pagination, message wrappers
│       │   ├── auth.py
│       │   ├── user.py
│       │   ├── tool.py
│       │   ├── reservation.py
│       │   ├── message.py
│       │   ├── notification.py
│       │   ├── review.py
│       │   ├── admin.py
│       │   └── report.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── deps.py                 # Re-export of app.dependencies for routers
│       │   └── v1/
│       │       ├── __init__.py         # Aggregates all routers under /api/v1
│       │       ├── auth.py
│       │       ├── tools.py
│       │       ├── reservations.py
│       │       ├── messages.py
│       │       ├── notifications.py
│       │       ├── reviews.py
│       │       ├── admin.py
│       │       └── health.py
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   ├── user.py
│       │   ├── tool.py
│       │   ├── reservation.py
│       │   ├── message.py
│       │   ├── notification.py
│       │   ├── review.py
│       │   ├── admin.py
│       │   ├── scheduler.py            # APScheduler async jobs
│       │   └── photo_storage.py        # Local disk storage abstraction
│       └── tests/
│           ├── __init__.py
│           ├── conftest.py             # Async DB engine, session fixture, client
│           ├── factories.py            # Test data builders
│           ├── test_health.py
│           ├── test_auth.py
│           ├── test_tools.py
│           ├── test_reservations.py
│           ├── test_messages.py
│           ├── test_notifications.py
│           ├── test_reviews.py
│           └── test_admin.py
├── scripts/
│   ├── check_db.py              # Async DB connection checker (updated)
│   └── seed_dev.py              # Deterministic seed data for E2E demo
├── db/
│   └── init/
│       └── 00-create-test-db.sql  # Creates toolsharing_test DB on first boot
```

---

## 4. Technology stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| API framework | FastAPI | `>=0.115,<0.120` | Native async, auto OpenAPI docs, Pydantic v2 integration. |
| ASGI server | Uvicorn | `>=0.32,<0.40` | Production server with standard extras. |
| ORM | SQLAlchemy | `>=2.0,<2.1` | Async `AsyncSession`, `Mapped` annotations. |
| Async database driver | asyncpg | `>=0.30,<1.0` | Primary driver for the application. |
| Sync helper driver | psycopg2-binary | `>=2.9,<3.0` | Kept for legacy dev scripts and Alembic offline fallback. |
| Migrations | Alembic | `>=1.14,<2.0` | Async `env.py` using `postgresql+asyncpg`. |
| Validation | Pydantic | `>=2.10,<3.0` | Request/response schemas and settings. |
| Settings | pydantic-settings | `>=2.7,<3.0` | `.env` loading with validation. |
| Email validation | email-validator | `>=2.2,<3.0` | RFC-compliant email validation. |
| File uploads | python-multipart | `>=0.0.20,<1.0` | Multipart form parsing for photos. |
| JWT | python-jose[cryptography] | `>=3.3,<4.0` | HS256 tokens. |
| Password hashing | bcrypt | `>=4.0,<5.0` | 12 rounds. |
| Background jobs | APScheduler | `>=3.10,<4.0` | Async scheduler for auto-cancel and escalation. |
| Testing | pytest, pytest-asyncio, httpx, factory-boy | pinned | Async test client and fixtures. |
| Linting | ruff | `>=0.8,<1.0` | Replaces flake8 and isort. |
| Type checking | mypy | `>=1.13,<2.0` | With SQLAlchemy plugin. |
| Database | PostgreSQL | 15 | Native ENUMs, GiST indexes, EXCLUDE constraints. |

### Updated `requirements.txt`

```text
# Core API
fastapi>=0.115,<0.120
uvicorn[standard]>=0.32,<0.40

# Database (async primary, sync helper)
sqlalchemy>=2.0,<2.1
asyncpg>=0.30,<1.0
psycopg2-binary>=2.9,<3.0
alembic>=1.14,<2.0

# Validation
pydantic>=2.10,<3.0
pydantic-settings>=2.7,<3.0
email-validator>=2.2,<3.0
python-multipart>=0.0.20,<1.0

# Auth
python-jose[cryptography]>=3.3,<4.0
bcrypt>=4.0,<5.0

# Config / utilities
python-dotenv>=1.0,<2.0

# Background jobs
apscheduler>=3.10,<4.0

# Testing
pytest>=8.3,<9.0
pytest-asyncio>=0.24,<1.0
httpx>=0.28,<1.0
factory-boy>=3.3,<4.0

# Dev tooling
ruff>=0.8,<1.0
mypy>=1.13,<2.0
```

---

## 5. Configuration (`app/config.py`)

Pydantic-settings class loading from `.env`:

| Setting | Type | Default / required | Purpose |
|---------|------|-------------------|---------|
| `DATABASE_URL` | PostgresDsn | required | `postgresql+asyncpg://...` |
| `TEST_DATABASE_URL` | PostgresDsn | optional | Used by pytest if present. |
| `SECRET_KEY` | str | required | Min 32 chars; default rejected in production. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | int | 15 | JWT access-token lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | int | 30 | JWT refresh-token lifetime. |
| `ALGORITHM` | str | HS256 | JWT signing algorithm. |
| `ENVIRONMENT` | str | development | `development`, `staging`, or `production`. |
| `CORS_ORIGINS` | list[str] | localhost origins | Comma-separated origins. |
| `API_V1_PREFIX` | str | /api/v1 | API version prefix. |
| `UPLOAD_DIR` | Path | backend/uploads/ | Local photo storage root. |
| `MAX_PHOTO_SIZE_MB` | int | 5 | Per-photo upload limit. |
| `MAX_PHOTOS_PER_TOOL` | int | 5 | Photo count limit. |
| `HST_TIMEZONE` | str | Pacific/Honolulu | Timezone for business dates. |
| `TOOLSHARING_DISABLE_SCHEDULER` | bool | False | Turns scheduler off for tests. |
| `SMTP_*` settings | optional | — | Production email via Gmail SMTP. |
| `MAILHOG_HOST`, `MAILHOG_PORT` | optional | — | Dev email capture. |

Validator: if `ENVIRONMENT == "production"` and `SECRET_KEY` equals the dev default, raise `ValueError` and refuse to start.

---

## 6. Database layer

### 6.1 Base and session (`app/db/`)

- `base.py` — `DeclarativeBase` with `AsyncAttrs`, shared `metadata`, and a `UUIDMixin` that maps `id: Mapped[uuid.UUID]` as the primary key.
- `session.py` — `async_engine`, `async_sessionmaker(class_=AsyncSession, expire_on_commit=False)`, and `get_db()` FastAPI dependency that yields `AsyncSession` and rolls back on unhandled exceptions.

### 6.2 ENUMs (`app/models/enums.py`)

```python
UserStatus: EMAIL_PENDING, ACTIVE, SUSPENDED, DELETED
InviteStatus: SENT, USED, EXPIRED, REVOKED
ToolCategory: HAND_TOOLS, POWER_TOOLS, GARDEN_TOOLS, CLEANING_TOOLS, OUTDOOR_GEAR
ToolCondition: NEW, LIKE_NEW, GOOD, FAIR, POOR
ReservationState: REQUESTED, APPROVED, PICKED_UP, RETURNED, DENIED, CANCELLED
DeactivationActor: OWNER, ADMIN
ReportStatus: PENDING, VALID, INVALID
SuspensionAction: SUSPEND, REACTIVATE
NotificationType: ...  # 10 event types
```

### 6.3 Model summary

| Model | Key fields / relationships | Key constraints |
|-------|---------------------------|-----------------|
| `User` | UUID PK, email (unique, indexed), hashed_password, full_name, bio, neighborhood, photo_url, status ENUM, is_admin, trust_score, damage_reported, violation_count, password_changed_at, deleted_at | PII anonymized on soft-delete |
| `InviteToken` | UUID PK, token (unique), email, status ENUM, created_by FK → users, expires_at, used_at | Admin invites story |
| `EmailVerificationToken` | UUID PK, token (unique), FK → users CASCADE, expires_at, used_at | US2 |
| `PasswordResetToken` | UUID PK, token (unique), FK → users CASCADE, expires_at, used_at | US4 |
| `Tool` | UUID PK, FK → users(owner), name, description, category ENUM, condition ENUM, is_active, deleted_at, deactivation_reason, deactivated_by, deactivated_at, reactivated_at, rating_sum, rating_count | Owner scope: unique name per owner |
| `Photo` | UUID PK, FK → tools CASCADE, url, display_order | Max 5 per tool enforced in service |
| `Reservation` | UUID PK, FK → tools, FK → users(borrower), state ENUM, start_date, end_date, requested_at, approved_at, picked_up_at, returned_at, cancelled_at, cancel_reason, damage_reported_at, damage_description, overdue_escalated_at, force_returned_by, force_return_reason | **EXCLUDE GiST** for overlap prevention |
| `Message` | UUID PK, FK → reservations CASCADE, FK → users(sender), body (TEXT, 5000 max), created_at | Index on reservation_id + created_at |
| `Notification` | UUID PK, FK → users CASCADE, type ENUM, title, body, payload JSON, read_at, created_at | Indexes on user_id + created_at and read_at |
| `Review` | UUID PK, FK → reservations, FK → reviewer, FK → reviewee, rating int, comment, created_at, edited_at | UNIQUE(reservation_id, reviewer_id) |
| `ListingReport` | UUID PK, FK → tools, FK → users(reporter), reason, status ENUM, created_at, resolved_at | UNIQUE(tool_id, reporter_id) for pending reports |
| `SuspensionRecord` | UUID PK, FK → users, action ENUM, reason, created_by, created_at | Index on user_id |
| `AdminAuditLog` | UUID PK, FK → users(actor), action_type, target_type, target_id, reason (required), metadata JSON, created_at | Immutable; index on target_type + target_id |
| `ListingRules` | ICEBOX — single-row config stub | Not implemented in R1/R2 |

### 6.4 Critical indexes and constraints

- `users.ix_users_email` — login lookup.
- `tools.ix_tools_owner_id`, `ix_tools_is_active`, `ix_tools_category`.
- `reservations.ix_reservations_tool_id`, `ix_reservations_borrower_id`, `ix_reservations_state`, composite `tool_id + state`, composite `tool_id + date_range`.
- `reservations` — **EXCLUDE USING GIST** preventing overlapping `(tool_id, daterange(start_date, end_date, '[]'))` where state is in an active set (for example, REQUESTED/APPROVED/PICKED_UP).
- `reviews.ix_reviews_reservation_id`, `ix_reviews_reviewee_id`, `ix_reviews_reviewee_rating`.
- `listing_reports.uq_report_tool_reporter`.
- `suspension_records.ix_suspension_records_user_id`.
- `admin_audit_log` indexes on `action_type + created_at` and `target_type + target_id`.

---

## 7. Service-layer responsibilities

Services are async and receive `AsyncSession` plus validated request objects. They raise domain exceptions from `app.core.exceptions`, which the API layer maps to HTTP responses.

| Service | File | Responsibilities mapped to v5 stories |
|---------|------|--------------------------------------|
| `AuthService` | `app/services/auth.py` | Admin invite creation, registration with invite token, email verification, resend verification, login, logout, refresh, forgot/reset password, profile read/update, account deletion. |
| `UserService` | `app/services/user.py` | Profile CRUD helpers, public member lookup with review aggregates. |
| `ToolService` | `app/services/tool.py` | Tool CRUD, photo upload/delete/reorder, owner/admin deactivate/reactivate, availability filter, soft-delete cleanup. |
| `ReservationService` | `app/services/reservation.py` | Request creation with overlap check, approve/deny/cancel state machine, mark picked-up, mark returned, damage report, admin force-return, history queries. |
| `MessageService` | `app/services/message.py` | Thread listing and send, restricted to open reservation states. |
| `NotificationService` | `app/services/notification.py` | Create on status changes, list, mark-read. |
| `ReviewService` | `app/services/review.py` | Create/update/delete review, 24h edit window, 30-day create window, recalculate trust score / rating aggregates. |
| `AdminService` | `app/services/admin.py` | User deactivate/reactivate/delete, tool deactivate/reactivate, report resolution, audit-log queries, moderation reports. |
| `SchedulerService` | `app/services/scheduler.py` | APScheduler async jobs: auto-cancel APPROVED pickups after 3-day grace, escalate PICKED_UP returns after 7 days. |
| `PhotoStorageService` | `app/services/photo_storage.py` | Save/delete files under `UPLOAD_DIR`, generate `/uploads/` URLs, validate image MIME type and size. |

---

## 8. API endpoints

All endpoints are under `{API_V1_PREFIX}` (default `/api/v1`). Authentication is JWT Bearer in the `Authorization` header.

### Auth (`/auth`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/invites` | Admin | Create invite token for an email address. |
| POST | `/auth/register` | Public | Register using invite token. |
| POST | `/auth/verify-email` | Public | Consume email verification token; returns first token pair. |
| POST | `/auth/resend-verification` | Public | Resend verification email (always 200). |
| POST | `/auth/login` | Public | Email + password login. |
| POST | `/auth/refresh` | Public | Rotate refresh token. |
| POST | `/auth/logout` | Member | Stateless logout hook. |
| GET | `/auth/me` | Member | Current user profile. |
| PUT | `/auth/me` | Member | Update profile. |
| DELETE | `/auth/me` | Member | Soft-delete account. |
| POST | `/auth/forgot-password` | Public | Request reset email (always 200). |
| POST | `/auth/reset-password` | Public | Consume reset token. |

### Tools (`/tools`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/tools` | Member | Create listing with photos. |
| GET | `/tools` | Member | Browse/search active tools. |
| GET | `/tools/me` | Member | Caller's own listings. |
| GET | `/tools/{id}` | Member | Single tool detail. |
| PATCH | `/tools/{id}` | Owner | Partial update. |
| DELETE | `/tools/{id}` | Owner | Soft-delete. |
| POST | `/tools/{id}/photos` | Owner | Upload photo. |
| DELETE | `/tools/{id}/photos/{pid}` | Owner | Remove photo. |
| POST | `/tools/{id}/deactivate` | Owner/Admin | Deactivate with reason. |
| POST | `/tools/{id}/reactivate` | Admin | Reactivate. |

### Reservations (`/reservations`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/reservations` | Member | Submit request. |
| GET | `/reservations` | Member | List (borrower or owner filter). |
| GET | `/reservations/{id}` | Member | Single reservation. |
| POST | `/reservations/{id}/approve` | Owner | REQUESTED → APPROVED. |
| POST | `/reservations/{id}/deny` | Owner | REQUESTED → DENIED. |
| POST | `/reservations/{id}/cancel` | Borrower/Owner | REQUESTED/APPROVED → CANCELLED. |
| POST | `/reservations/{id}/mark-picked-up` | Borrower | APPROVED → PICKED_UP. |
| POST | `/reservations/{id}/mark-returned` | Borrower | PICKED_UP → RETURNED. |
| POST | `/reservations/{id}/mark-damaged` | Owner | File damage report. |
| POST | `/reservations/{id}/admin-force-return` | Admin | Force PICKED_UP → RETURNED. |

### Messages (`/reservations/{id}/messages`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/reservations/{id}/messages` | Party/Admin | List thread. |
| POST | `/reservations/{id}/messages` | Party | Send message. |

### Notifications (`/notifications`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/notifications` | Member | List newest first. |
| POST | `/notifications/{id}/read` | Member | Mark as read. |

### Reviews (`/reservations/{id}/review`, `/reviews`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/reservations/{id}/review` | Party | Submit review. |
| GET | `/reservations/{id}/review` | Member | View reviews for reservation. |
| PATCH | `/reviews/{id}` | Author | Edit within 24h. |
| DELETE | `/reviews/{id}` | Author | Delete within 24h. |

### Admin (`/admin`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/admin/users/{id}/deactivate` | Admin | Deactivate member. |
| POST | `/admin/users/{id}/reactivate` | Admin | Reactivate member. |
| POST | `/admin/users/{id}/delete` | Admin | Hard-delete member. |
| POST | `/admin/tools/{id}/deactivate` | Admin | Deactivate listing. |
| POST | `/admin/tools/{id}/reactivate` | Admin | Reactivate listing. |
| GET | `/admin/audit-log` | Admin | Filterable moderation history. |
| GET | `/admin/reports` | Admin | Moderation reports. |
| GET | `/admin/reservations` | Admin | All active reservations. |

### Health

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/health` | Public | `{"status": "ok"}` |

---

## 9. Pydantic v2 schema groups

| File | Schemas |
|------|---------|
| `schemas/common.py` | `PaginatedResponse[T]`, `MessageResponse`, `ErrorResponse` |
| `schemas/auth.py` | `InviteCreate`, `InviteResponse`, `RegisterRequest`, `VerifyEmailRequest`, `ResendRequest`, `LoginRequest`, `TokenPairResponse`, `RefreshRequest`, `PasswordResetRequest`, `PasswordResetConfirm` |
| `schemas/user.py` | `UserCreate`, `UserUpdate`, `UserPublic`, `UserProfile` |
| `schemas/tool.py` | `ToolCreate`, `ToolUpdate`, `ToolListItem`, `ToolDetail`, `ToolAvailabilityFilter`, `PhotoResponse` |
| `schemas/reservation.py` | `ReservationCreate`, `ReservationUpdate` (unused), `ReservationResponse`, `ReservationAction`, `DamageReportCreate` |
| `schemas/message.py` | `MessageCreate`, `MessageResponse` |
| `schemas/notification.py` | `NotificationResponse`, `NotificationList` |
| `schemas/review.py` | `ReviewCreate`, `ReviewUpdate`, `ReviewResponse` |
| `schemas/admin.py` | `AdminActionRequest`, `AuditLogFilter`, `AuditLogResponse`, `ModerationReportFilter` |
| `schemas/report.py` | `ListingReportCreate`, `ListingReportResponse` |

---

## 10. Docker and local environment

### `docker-compose.yml`

- `db` service: PostgreSQL 15, port `5432:5432`, persistent volume, init script for test DB.
- Optional `mailhog` service: captures outbound SMTP on port `1025`, web UI on `8025`.
- Optional `backend` service (production-style): built from `Dockerfile`, depends on `db`.

### `Dockerfile`

Multi-stage build:

1. `builder` stage — install build dependencies, compile wheels.
2. `runtime` stage — copy wheels, install, expose `8000`, run `uvicorn app.main:app`.

### `.env.example`

```bash
DATABASE_URL=postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing
TEST_DATABASE_URL=postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing_test
SECRET_KEY=change-me-in-production-please-use-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
ALGORITHM=HS256
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
API_V1_PREFIX=/api/v1
UPLOAD_DIR=./uploads
MAX_PHOTO_SIZE_MB=5
MAX_PHOTOS_PER_TOOL=5
HST_TIMEZONE=Pacific/Honolulu
TOOLSHARING_DISABLE_SCHEDULER=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
```

---

## 11. Developer commands

### Start the database

```bash
docker compose up -d
```

### Create and activate a virtual environment

```bash
cd backend
python3 -m venv venv_py313
source venv_py313/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Configure environment

```bash
cp src/.env.example src/.env
# Edit src/.env with the real database password
```

### Run migrations

```bash
cd backend/src
alembic upgrade head
```

### Start the server

```bash
cd backend/src
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Run tests

```bash
cd backend/src
pytest -q
```

### Lint and type check

```bash
cd backend
ruff check src
ruff format --check src
mypy src
```

### Seed dev data

```bash
cd backend/src
python ../scripts/seed_dev.py
```

---

## 12. Testing strategy

- **Unit / integration tests** with `pytest-asyncio`, `httpx.AsyncClient`, and an isolated `toolsharing_test` database.
- `conftest.py` creates the async engine, drops/creates all tables once per test session, and wraps each test in a transaction rollback.
- `factories.py` builds test users, tools, reservations, and reviews with deterministic defaults.
- Coverage target: 80%+ on reservation, auth, and tool modules by Final demo.
- E2E path: invite → register → verify → login → create tool → request → approve → pickup → return → review.

---

## 13. Phased implementation order (backend only)

### R1.A — Foundation

Backend deliverables for the 8 foundation stories:

- Project skeleton, Docker, config, logging, security utilities.
- Async SQLAlchemy base, session, and Alembic async setup.
- Models: `User`, `InviteToken`, `EmailVerificationToken`, `PasswordResetToken`.
- Services: `AuthService` (full invite/register/verify/login/refresh/logout/profile/delete/password-reset flow).
- Routers: `/auth`.
- Tests for all auth flows.

### R1.B — Core demo path

Backend deliverables for the 15 core stories:

- Models: `Tool`, `Photo`, `Reservation`, `Review`.
- Services: `ToolService`, `ReservationService`, `ReviewService`, `PhotoStorageService`.
- Routers: `/tools`, `/reservations`, `/reviews`.
- Reservation state machine, overlap rejection, auto-cancel scheduler.
- HST date normalization utility.
- Tests for tool, reservation, and review lifecycles.

### R1.C — Cross-cutting infrastructure

Backend deliverables for the 7 infrastructure items:

- JWT dependency (`get_current_user`, `get_current_admin_user`).
- Email abstraction (SMTP for prod, MailHog for dev).
- Notification model + `NotificationService` + `/notifications` router.
- APScheduler async job runner (auto-cancel, escalation).
- PostgreSQL EXCLUDE GiST constraint migration.
- Admin audit log model + inserts on deactivate/reactivate/suspend.
- `/health` endpoint and base exception handlers.

### R2.A — Deferred stories

Backend deliverables for the 10 R2 stories:

- Models: `Message`, `ListingReport`, `SuspensionRecord`, `AdminAuditLog`.
- Services: `MessageService`, `AdminService`.
- Routers: `/reservations/{id}/messages`, `/admin` expanded, report endpoints.
- Admin views: all reservations, reported listings, member moderation history.
- Pagination (20/page) and advanced filters on list endpoints.

### R2.B — Improvements

- Pagination query params on all list endpoints.
- Condition and rating filters on tool search.
- Regression test pass and bug fixes from R1.

### Final — Polish and harden

- Deployment guide validation.
- E2E seed data and demo script.
- Coverage report and gap filling.
- README architecture section.
- Final bug fixes.

---

## 14. Known limitations (Icebox)

These stories are intentionally out of scope per v5 phasing:

- **US28 — Admin Manages Tool Categories:** Categories remain a static `ToolCategory` ENUM. A content-management interface is not built.
- **US33 — Admin Generates Community Moderation Reports:** Report queries are available through admin endpoints and direct database access. A dedicated report-generation user interface is not built.

---

## 15. Risks carried forward from the technical design

| Risk | Mitigation in this scaffold |
|------|----------------------------|
| Double-booking race condition | PostgreSQL `EXCLUDE USING GIST` constraint; service catches `IntegrityError` and returns HTTP 409. |
| Email delivery in local dev | MailHog container captures all SMTP traffic. |
| Default JWT secret in production | Config validator refuses to start with the dev secret when `ENVIRONMENT=production`. |
| Local photo storage scaling | Photo model stores URLs; swapping to object storage is a one-file change in `photo_storage.py`. |
| In-process scheduler | APScheduler runs in-process with a kill-switch for tests (`TOOLSHARING_DISABLE_SCHEDULER`). |

---

## 16. Next step

Generate the actual file scaffolding from this blueprint:

1. Create `app/`, `alembic/`, `tests/`, `scripts/` files.
2. Replace the sync `psycopg2`-based `check_db.py` with an async version using `asyncpg`.
3. Update `docker-compose.yml` with an optional `backend` and `mailhog` service.
4. Add `pyproject.toml` with ruff, mypy, and pytest configuration.
5. Initialize the first Alembic migration for the R1.A models.

Tell the project manager or backend lead to approve this blueprint, then proceed to code generation.
