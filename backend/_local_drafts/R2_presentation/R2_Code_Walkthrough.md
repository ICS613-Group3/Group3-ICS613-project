# R2 Backend Code Walkthrough — Full Reference

**Speaker:** Ivan Wu, BE Lead  
**Purpose:** Deep-dive into the backend architecture, data model, API design, and business logic  
**For:** R2 Demo — Code Walkthrough & DB Schema segment (~1 min)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Layout](#2-project-layout)
3. [Configuration & Startup](#3-configuration--startup)
4. [Database Layer](#4-database-layer)
5. [ORM Models (13 Tables)](#5-orm-models-13-tables)
6. [Enums](#6-enums)
7. [Exception Hierarchy](#7-exception-hierarchy)
8. [Authentication & Security](#8-authentication--security)
9. [Dependency Injection](#9-dependency-injection)
10. [API Routes — Complete Endpoint Inventory](#10-api-routes--complete-endpoint-inventory)
11. [Services — Business Logic Layer](#11-services--business-logic-layer)
12. [Reservation State Machine](#12-reservation-state-machine)
13. [Background Scheduler](#13-background-scheduler)
14. [Photo Upload Pipeline](#14-photo-upload-pipeline)
15. [Rate Limiting](#15-rate-limiting)
16. [Email Service](#16-email-service)
17. [Testing Architecture](#17-testing-architecture)

---

## 1. Architecture Overview

```
Browser → React (Vite dev proxy :5173)
  └─→ FastAPI (uvicorn :8000)
       ├─ API Routes (api/v1/)     ← thin HTTP layer: parse request, call service
       ├─ Services (services/)     ← all business logic lives here
       ├─ Models (models/)         ← SQLAlchemy ORM, 13 tables
       ├─ Schemas (schemas/)       ← Pydantic request/response validation
       ├─ Core (core/)             ← security, exceptions, logging, rate limit
       └─ DB (db/)                 ← async engine, session factory
            └─ PostgreSQL 15 (Docker, port 5432)
```

**Key design decisions:**
- **Async everywhere** — asyncpg driver, AsyncSession, async service methods
- **Three-layer separation** — Routes → Services → Models (routes never touch DB directly)
- **Domain exceptions** — services raise `AppError` subclasses; a central handler maps them to HTTP status codes
- **No Alembic for dev** — `init_db.py` uses `Base.metadata.create_all()`; Alembic only in Dockerfile for production

---

## 2. Project Layout

```
backend/
├── src/app/
│   ├── main.py                    # FastAPI app factory + lifespan + exception handlers
│   ├── config.py                  # pydantic-settings: all env vars in one place
│   ├── dependencies.py            # get_current_user, get_current_member, get_current_admin_user
│   ├── dependencies_rate_limit.py  # per-endpoint rate limit deps
│   ├── api/
│   │   ├── deps.py                # re-exports from dependencies.py
│   │   └── v1/
│   │       ├── __init__.py        # mounts all routers under /api/v1
│   │       ├── auth.py            # /auth/* (13 endpoints)
│   │       ├── tools.py           # /tools/* (7 endpoints)
│   │       ├── reservations.py    # /reservations/* (9 endpoints)
│   │       ├── reviews.py         # /reservations/:id/review, /users/me/reviews, /reviews/:id
│   │       ├── messages.py        # /reservations/:id/messages (2 endpoints)
│   │       ├── notifications.py   # /notifications/* (2 endpoints)
│   │       ├── reports.py         # /tools/:id/report, /reports/* (4 endpoints)
│   │       ├── categories.py      # /categories/* (3 endpoints)
│   │       ├── admin.py           # /admin/* (11 endpoints)
│   │       └── health.py          # /health (1 endpoint)
│   ├── models/                    # 13 SQLAlchemy ORM models + enums
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── services/                  # 13 service classes with business logic
│   ├── core/                      # security, exceptions, logging, rate_limit, timezone
│   └── db/                        # async engine + session factory
├── alembic/                       # migrations (only used in Docker production)
├── scripts/
│   ├── init_db.py                 # create_all() — no Alembic needed
│   ├── seed_dev.py                # demo data (3 users, 5 categories, 12 tools)
│   ├── clean_dev.py               # wipe all rows (keep tables)
│   └── seed_photos/               # 12 JPEG files for seed tools
├── tests/                         # pytest + httpx async test suite
├── docker-compose.yml             # PostgreSQL 15 + pgAdmin
├── Dockerfile                     # Production: alembic + uvicorn
└── requirements.txt
```

---

## 3. Configuration & Startup

### config.py — pydantic-settings

All configuration lives in `Settings(BaseSettings)` (`config.py:10-293`). Values are read from env vars or `.env`.

**Key settings:**
| Setting | Default | Purpose | Line |
|---------|---------|---------|--------|
| `SECRET_KEY` | (required, ≥32 chars) | HMAC key for JWT signing | `config.py:41-47` |
| `ENVIRONMENT` | `production` | Set to `development` to accept placeholder SECRET_KEY | `config.py:29-36` |
| `DATABASE_URL` | `postgresql+asyncpg://...` | AsyncPG connection string | `config.py:82-85` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins | `config.py:90-96` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 60 | JWT access token lifetime | `config.py:48-51` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | JWT refresh token lifetime | `config.py:52-55` |
| `SCHEDULER_GRACE_PERIOD_DAYS` | 3 | Auto-cancel overdue pickups after N days | `config.py:147-155` |
| `SCHEDULER_ESCALATION_DAYS` | 7 | Soft-escalate overdue returns after N days | `config.py:156-163` |
| `SCHEDULER_HARD_ESCALATION_DAYS` | 14 | Force-return severely overdue items | `config.py:165-173` |
| `RATE_LIMIT_LOGIN_PER_MINUTE` | 50 | Login rate limit per IP | `config.py:199-206` |
| `MAX_UPLOAD_SIZE_BYTES` | 5 MB | Max photo upload size | `config.py:109-112` |

**Validators:**
- `SECRET_KEY` must be ≥32 chars
- In `production`, dev placeholders (`change-me`, `replace-with`) are rejected at startup
- In `development`/`test`, placeholders are tolerated for fresh checkouts

### main.py — App Factory

```python
app = create_application()  # main.py:82-126
```

The `create_application()` function:
1. Creates FastAPI with `lifespan` hook
2. Adds CORS middleware (explicit allowlist, not wildcard)
3. Registers exception handler: `AppError` → HTTP status code mapping
4. Mounts API router at `/api/v1`
5. Mounts static files at `/uploads` for tool photos

**Exception handler mapping:** (`main.py:46-79`)
| Exception | HTTP Status |
|-----------|-------------|
| `NotFoundError` | 404 |
| `PermissionDeniedError` | 403 |
| `ConflictError` | 409 |
| `ValidationError` | 422 |
| `VerifyTokenError` | 400 |
| `AuthenticationError` | 401 |
| `TooManyRequestsError` | 429 |
| (anything else) | 500 |

**Lifespan:** (`main.py:29-43`) starts `SchedulerService` (`services/scheduler.py:41-81`) on startup, shuts it down on exit.

---

## 4. Database Layer

### db/session.py — Async Engine

- `get_engine()` (`db/session.py:19-46`) — singleton async engine with connection pooling (pool_size=5, max_overflow=10, pool_recycle=30min, pool_pre_ping=True)
- `get_async_session_maker()` (`db/session.py:49-65`) — singleton sessionmaker, `expire_on_commit=False`
- `get_db()` (`db/session.py:79-94`) — FastAPI dependency: yields session, commits on clean exit, rolls back on exception
- `get_session()` (`db/session.py:97-113`) — async context manager for non-FastAPI code (scheduler jobs)
- `reset_engine_cache()` (`db/session.py:68-76`) — used by tests to rebuild engine with test DATABASE_URL

### db/base.py — Declarative Base

```python
class Base(DeclarativeBase):  # db/base.py:11-14
    pass
```

Shared column types: `UUID_PK` (`db/base.py:18`) (auto-generated UUID4), `CreatedAt` (`db/base.py:19-26`) (server_default=now()), `UpdatedAt` (`db/base.py:27-35`) (server_default=now(), onupdate=now()).

### init_db.py — Schema Creation

Uses `Base.metadata.create_all()` — creates all 13 tables from ORM models. Also creates the `btree_gist` PostgreSQL extension (required for the GiST EXCLUDE constraint on reservations). Script: `scripts/init_db.py` (relative to `backend/`).

**Why no Alembic for dev?** `create_all()` is simpler and sufficient for a fresh database. Alembic migrations exist for production (Dockerfile runs `alembic upgrade head` on startup).

---

## 5. ORM Models (13 Tables)

### users (`models/user.py:24-124`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, auto-generated |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, indexed |
| `hashed_password` | VARCHAR(255) | NOT NULL |
| `full_name` | VARCHAR(255) | nullable |
| `bio` | TEXT | nullable |
| `neighborhood` | VARCHAR(255) | nullable |
| `photo_url` | VARCHAR(500) | nullable |
| `status` | ENUM(user_status) | NOT NULL, default EMAIL_PENDING, indexed |
| `is_admin` | BOOLEAN | NOT NULL, default False, indexed |
| `trust_score` | FLOAT | NOT NULL, default 0.0 |
| `damage_reported` | INTEGER | NOT NULL, default 0 |
| `violation_count` | INTEGER | NOT NULL, default 0 |
| `password_changed_at` | TIMESTAMPTZ | nullable |
| `deleted_at` | TIMESTAMPTZ | nullable (soft-delete) |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**UserStatus enum:** `EMAIL_PENDING → ACTIVE → SUSPENDED → DELETED` (`models/enums.py:6-10`)

**Relationships:** `tools` (one-to-many), `reservations_as_borrower`, `reviews_given`, `reviews_received`, `notifications`, `created_invites`, `verification_tokens`, `password_reset_tokens`

### tools (`models/tool.py:20-91`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `owner_id` | UUID FK(users) | NOT NULL, CASCADE, indexed |
| `name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | nullable |
| `category` | VARCHAR(100) | NOT NULL, indexed |
| `condition` | ENUM(tool_condition) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL, default True, indexed |
| `deactivated_by` | ENUM(deactivation_actor) | nullable |
| `deactivated_at` | TIMESTAMPTZ | nullable |
| `deactivation_reason` | TEXT | nullable |
| `avg_rating` | FLOAT | NOT NULL, default 0.0 |
| `rating_count` | INTEGER | NOT NULL, default 0 |
| `deleted_at` | TIMESTAMPTZ | nullable (soft-delete) |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**ToolCondition enum:** `NEW, LIKE_NEW, GOOD, FAIR, POOR` (`models/enums.py:20-25`)

**DeactivationActor enum:** `OWNER, ADMIN, DAMAGE_REPORT` (`models/enums.py:51-54`)

**Relationships:** `owner` (many-to-one User), `photos` (one-to-many, cascade delete), `reservations` (one-to-many)

### reservations (`models/reservation.py:29-151`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tool_id` | UUID FK(tools) | NOT NULL, CASCADE |
| `borrower_id` | UUID FK(users) | NOT NULL, CASCADE |
| `state` | ENUM(reservation_state) | NOT NULL, default REQUESTED |
| `start_date` | DATE | NOT NULL |
| `end_date` | DATE | NOT NULL |
| `picked_up_at` | TIMESTAMPTZ | nullable |
| `returned_at` | TIMESTAMPTZ | nullable |
| `cancelled_by_type` | VARCHAR(20) | nullable, CHECK constraint |
| `cancelled_reason` | TEXT | nullable |
| `denied_reason` | TEXT | nullable |
| `damage_reported` | BOOLEAN | NOT NULL, default False |
| `damage_description` | TEXT | nullable |
| `damage_reported_at` | TIMESTAMPTZ | nullable |
| `force_resolved_by` | UUID FK(users) | nullable |
| `force_resolved_at` | TIMESTAMPTZ | nullable |
| `force_resolution_reason` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**ReservationState enum:** `REQUESTED → APPROVED → PICKED_UP → RETURNED` (also `DENIED, CANCELLED`) (`models/enums.py:28-34`)

**CancellerType (string + CHECK):** `borrower, owner, system, admin` (`models/enums.py:37-48`)

**Critical constraint — GiST EXCLUDE:** (`models/reservation.py:51-59`)
```python
ExcludeConstraint(
    ("tool_id", "="),
    (text("tsrange(start_date, end_date, '[]')"), "&&"),
    where=text("state IN ('REQUESTED', 'APPROVED', 'PICKED_UP')"),
    using="gist",
    name="ex_no_overlap_active",
)
```
This prevents double-booking at the database level: two active reservations for the same tool cannot have overlapping date ranges. Uses PostgreSQL's GiST index with the `btree_gist` extension.

**Indexes:** `tool_id`, `borrower_id`, `state`, `(tool_id, state)`, `(tool_id, start_date, end_date)`

### reviews (`models/review.py:24-74`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `reservation_id` | UUID FK(reservations) | NOT NULL, CASCADE, indexed |
| `reviewer_id` | UUID FK(users) | NOT NULL, CASCADE |
| `reviewee_id` | UUID FK(users) | NOT NULL, CASCADE |
| `rating` | INTEGER | NOT NULL, CHECK 1-5 |
| `comment` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**Constraints:** `UNIQUE(reservation_id, reviewer_id)` — one review per reservation per reviewer.

### photos (`models/photo.py:16-39`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tool_id` | UUID FK(tools) | NOT NULL, CASCADE, indexed |
| `url` | VARCHAR(500) | NOT NULL |
| `display_order` | INTEGER | NOT NULL, default 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |

Max 5 photos per tool (enforced in service layer).

### notifications (`models/notification.py:34-74`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID FK(users) | NOT NULL, CASCADE, indexed |
| `type` | VARCHAR(50) | NOT NULL, indexed, CHECK constraint |
| `title` | VARCHAR(255) | NOT NULL |
| `body` | TEXT | NOT NULL |
| `payload` | JSONB | nullable |
| `read_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |

`type` is stored as a plain string (not PG ENUM) so adding new notification types doesn't require `ALTER TYPE`. A CHECK constraint validates against known values.

### messages (`models/message.py:22-57`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `reservation_id` | UUID FK(reservations) | NOT NULL, CASCADE, indexed |
| `sender_id` | UUID FK(users) | NOT NULL, CASCADE, indexed |
| `body` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

Threaded messaging per reservation. Read-only once the reservation is RETURNED/DENIED/CANCELLED.

### listing_reports (`models/listing_report.py:25-89`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tool_id` | UUID FK(tools) | NOT NULL, CASCADE, indexed |
| `reporter_id` | UUID FK(users) | NOT NULL, CASCADE |
| `reason` | TEXT | NOT NULL |
| `comment` | TEXT | nullable |
| `status` | ENUM(report_status) | NOT NULL, default PENDING, indexed |
| `resolved_by` | UUID FK(users) | nullable |
| `resolved_at` | TIMESTAMPTZ | nullable |
| `resolution_note` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**ReportStatus enum:** `PENDING → VALID | INVALID` (`models/enums.py:57-60`)  
**ReportReason enum (string, not PG enum):** `INAPPROPRIATE_CONTENT, PROHIBITED_ITEM, MISLEADING_LISTING, SCAM_OR_FRAUD, DUPLICATE_LISTING, OTHER` (`models/enums.py:63-71`)

**Unique constraint:** `UNIQUE(tool_id, reporter_id)` — one report per tool per reporter.

### admin_audit_log (`models/admin_audit_log.py:17-57`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `actor_id` | UUID FK(users) | nullable, SET NULL, indexed |
| `action_type` | VARCHAR(50) | NOT NULL, indexed |
| `target_type` | VARCHAR(50) | NOT NULL |
| `target_id` | UUID | NOT NULL, indexed |
| `reason` | TEXT | NOT NULL |
| `metadata` | JSONB | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |

Immutable — never updated, only inserted. Records every admin moderation action.

**action_type values:** `TOOL_DEACTIVATE, TOOL_REACTIVATE, USER_SUSPEND, USER_REACTIVATE, ACCOUNT_DELETE, RESERVATION_FORCE_RETURN, LISTING_REPORT_RESOLVED`

### tool_categories (`models/category.py:16-48`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE, indexed |
| `description` | TEXT | nullable |
| `created_by` | UUID FK(users) | nullable, SET NULL, indexed |
| `created_at` | TIMESTAMPTZ | NOT NULL |

Admin-managed. Tool listings reference categories via `Tool.category` (plain VARCHAR), not a foreign key — so deactivated tools retain their category string for history.

### invite_tokens (`models/invite.py:24-70`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `token` | VARCHAR(64) | NOT NULL, UNIQUE, indexed |
| `email` | VARCHAR(255) | NOT NULL, indexed |
| `status` | ENUM(invite_status) | NOT NULL, default SENT, indexed |
| `created_by` | UUID FK(users) | nullable |
| `expires_at` | TIMESTAMPTZ | NOT NULL (7 days default) |
| `used_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |

### email_verification_tokens (`models/email_verification.py:22-61`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `token` | VARCHAR(64) | NOT NULL, UNIQUE, indexed |
| `user_id` | UUID FK(users) | NOT NULL, CASCADE, indexed |
| `expires_at` | TIMESTAMPTZ | NOT NULL (24h default) |
| `used_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |

### password_reset_tokens (`models/password_reset.py:22-61`)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `token` | VARCHAR(64) | NOT NULL, UNIQUE, indexed |
| `user_id` | UUID FK(users) | NOT NULL, CASCADE, indexed |
| `expires_at` | TIMESTAMPTZ | NOT NULL (1h default) |
| `used_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL |

---

## 6. Enums

All enums are defined in `models/enums.py` (lines 1-95):

| Enum | Values | Used By | Line |
|------|--------|---------|------|
| `UserStatus` | EMAIL_PENDING, ACTIVE, SUSPENDED, DELETED | users.status | `models/enums.py:6-10` |
| `InviteStatus` | sent, used, expired, revoked | invite_tokens.status | `models/enums.py:13-17` |
| `ToolCondition` | NEW, LIKE_NEW, GOOD, FAIR, POOR | tools.condition | `models/enums.py:20-25` |
| `ReservationState` | REQUESTED, APPROVED, PICKED_UP, RETURNED, DENIED, CANCELLED | reservations.state | `models/enums.py:28-34` |
| `CancellerType` | borrower, owner, system, admin | reservations.cancelled_by_type (string + CHECK) | `models/enums.py:37-48` |
| `DeactivationActor` | OWNER, ADMIN, DAMAGE_REPORT | tools.deactivated_by | `models/enums.py:51-54` |
| `ReportStatus` | PENDING, VALID, INVALID | listing_reports.status | `models/enums.py:57-60` |
| `ReportReason` | INAPPROPRIATE_CONTENT, PROHIBITED_ITEM, MISLEADING_LISTING, SCAM_OR_FRAUD, DUPLICATE_LISTING, OTHER | listing_reports.reason | `models/enums.py:63-71` |
| `SuspensionAction` | SUSPEND, REACTIVATE | admin service | `models/enums.py:74-76` |
| `NotificationType` | 16 values (see below) | notifications.type | `models/enums.py:79-95` |

**NotificationType values:** `INVITE_SENT, EMAIL_VERIFIED, PASSWORD_RESET, RESERVATION_REQUESTED, RESERVATION_APPROVED, RESERVATION_DENIED, RESERVATION_CANCELLED, RESERVATION_PICKED_UP, RESERVATION_RETURNED, RESERVATION_OVERDUE, TOOL_DEACTIVATED, TOOL_REACTIVATED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED, LISTING_REPORT_SUBMITTED, LISTING_REPORT_RESOLVED` (`models/enums.py:79-95`)

**Design choice:** `CancellerType` and `NotificationType` are stored as plain strings (not PG ENUMs) with CHECK constraints. This lets us add new values without running `ALTER TYPE` migrations.

---

## 7. Exception Hierarchy

```
AppError (base)                                    → `core/exceptions.py:11-17`
├── NotFoundError          → 404                  → `core/exceptions.py:20-23`
├── PermissionDeniedError  → 403                  → `core/exceptions.py:26-29`
├── ConflictError          → 409                  → `core/exceptions.py:32-35`
├── ValidationError        → 422                  → `core/exceptions.py:38-41`
├── AuthenticationError    → 401                  → `core/exceptions.py:44-47`
├── VerifyTokenError       → 400 (has resend_available flag) → `core/exceptions.py:50-65`
└── TooManyRequestsError   → 429                  → `core/exceptions.py:68-76`
```

**`parse_enum_or_raise()`** (`core/exceptions.py:79-93`) — utility that catches `ValueError` from enum constructors and re-raises as `ValidationError` with valid-values hint. Used in route layer for query param validation.

---

## 8. Authentication & Security

### JWT Token System

- **Access token:** 60 min lifetime, contains `sub` (user ID), `type: "access"`, `aud`, `iss`, `jti` (`core/security.py:34-58`)
- **Refresh token:** 7 days lifetime, contains `sub`, `type: "refresh"`, `aud`, `iss`, `jti` (`core/security.py:61-82`)
- **Algorithm:** HS256 (`config.py:56-59`)
- **Audience/Issuer:** `toolsharing-api` — prevents cross-service token replay (`config.py:66-78`, verified in `core/security.py:92-98`)

### Password Hashing

- bcrypt with 12 rounds (`core/security.py:15-19`)
- `hash_password(plain) → hash` (`core/security.py:15-19`)
- `verify_password(plain, hash) → bool` (`core/security.py:22-27`)

### Token Rotation

- Login returns `{access_token, refresh_token}` (`services/auth.py:293-297`)
- `/auth/refresh` rotates: old refresh token is consumed, new pair issued (`services/auth.py:299-343`)
- Password change invalidates all tokens (via `password_changed_at` timestamp — tokens issued before this are rejected: `models/user.py:58-61`, checked in `dependencies.py:52-60` and `services/auth.py:332-337`)

### Security Flow

```
1. POST /auth/register (with invite_token)
   → creates user with EMAIL_PENDING status
   → sends verification email

2. POST /auth/verify-email (with verification token)
   → sets user to ACTIVE
   → returns access + refresh tokens

3. POST /auth/login
   → verifies credentials
   → returns access + refresh tokens

4. GET /auth/me (Authorization: Bearer <access_token>)
   → decodes JWT, checks aud/iss, loads user
   → rejects if token issued before password_changed_at
```

---

## 9. Dependency Injection

FastAPI's `Depends()` system chains authentication and authorization:

```python
**Level 0: raw JWT decode**
get_current_user(credentials) → User (`dependencies.py:25-62`)

**Level 1: status checks**
get_current_member = get_current_user + requires ACTIVE status (`dependencies.py:78-84`)
get_current_member_read_only = get_current_user + requires ACTIVE or SUSPENDED (`dependencies.py:87-98`)
get_current_admin_user = get_current_member + requires is_admin=True (`dependencies.py:101-107`)
```

**Usage in routes:**
```python
@router.get("/tools")
async def list_tools(
    current_user: Annotated[User, Depends(get_current_member_read_only)],
    ...
):
    # current_user is guaranteed to be ACTIVE or SUSPENDED
```

**Rate limit dependencies** are added as separate `Depends()`:
```python
@router.post("/login", response_model=TokenPairResponse)
async def login(
    request_data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rl: Annotated[None, Depends(rate_limit_login)] = None,  # ← rate limit
):
```

---

## 10. API Routes — Complete Endpoint Inventory

### Auth (`/api/v1/auth`) — `api/v1/auth.py:1-225`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/invites` | admin | List all invite tokens |
| POST | `/invites` | admin | Create invite token |
| POST | `/invites/{id}/revoke` | admin | Revoke invite |
| POST | `/register` | none | Register with invite token |
| POST | `/verify-email` | none | Verify email, get tokens |
| POST | `/resend-verification` | none | Resend verification email |
| POST | `/login` | none | Login, get tokens |
| POST | `/refresh` | none | Rotate refresh token |
| POST | `/logout` | member | Stateless logout |
| GET | `/me` | member_read_only | Get own profile |
| PUT | `/me` | member | Update own profile |
| DELETE | `/me` | any_user | Soft-delete own account |
| POST | `/forgot-password` | none | Request password reset |
| POST | `/reset-password` | none | Reset password with token |

### Tools (`/api/v1/tools`) — `api/v1/tools.py:1-261`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | member | Create tool (multipart form) |
| GET | `/` | member_read_only | List tools (paginated, filtered) |
| GET | `/{id}` | member_read_only | Get tool detail |
| PUT | `/{id}` | member | Update tool |
| POST | `/{id}/photos` | member | Add photos |
| DELETE | `/{id}/photos/{photo_id}` | member | Remove photo |
| POST | `/{id}/deactivate` | member | Deactivate own tool |
| POST | `/{id}/reactivate` | member | Reactivate own tool |
| GET | `/returned` | member | Browse returned tools |

**List tools filters:** category, search (name/description), available_start/end, condition, min_rating

### Reservations (`/api/v1/reservations`) — `api/v1/reservations.py:1-199`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | member | Create reservation |
| GET | `/` | member_read_only | List (filtered by role, state) |
| GET | `/{id}` | member_read_only | Get detail (party check) |
| POST | `/{id}/approve` | owner | Approve request |
| POST | `/{id}/deny` | owner | Deny request |
| POST | `/{id}/cancel` | member | Cancel (borrower or owner) |
| POST | `/{id}/pickup` | borrower | Confirm pickup |
| POST | `/{id}/return` | borrower | Confirm return |
| POST | `/{id}/damage` | owner | Report damage (7-day window) |
| POST | `/{id}/force-return` | admin | Force return (dispute resolution) |

### Reviews (`/api/v1`) — `api/v1/reviews.py:1-131`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reservations/{id}/review` | member | Submit review |
| GET | `/reservations/{id}/review` | member_read_only | Get reviews for reservation |
| GET | `/users/me/reviews` | member_read_only | My review history |
| PATCH | `/reviews/{id}` | member | Edit review (24h window) |
| DELETE | `/reviews/{id}` | member | Delete review |

### Messages (`/api/v1`) — `api/v1/messages.py:1-70`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/reservations/{id}/messages` | member | Send message |
| GET | `/reservations/{id}/messages` | member_read_only | List messages |

### Notifications (`/api/v1/notifications`) — `api/v1/notifications.py:1-55`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | member_read_only | List (unread_only filter, unread_count) |
| POST | `/{id}/read` | member | Mark as read |

### Reports (`/api/v1`) — `api/v1/reports.py:1-142`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tools/{id}/report` | member | Submit report |
| GET | `/reports` | admin | List all reports |
| POST | `/reports/{id}/resolve` | admin | Resolve report |
| GET | `/reports/me` | member | My submitted reports |

### Categories (`/api/v1/categories`) — `api/v1/categories.py:1-76`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | member_read_only | List all categories |
| POST | `/` | admin | Add category |
| DELETE | `/{id}` | admin | Remove category |

### Admin (`/api/v1/admin`) — `api/v1/admin.py:1-333`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | admin | List all users (paginated) |
| GET | `/users/{id}` | admin | Get user detail |
| POST | `/users/{id}/deactivate` | admin | Suspend user |
| POST | `/users/{id}/reactivate` | admin | Reactivate user |
| DELETE | `/users/{id}` | admin | Hard-delete user |
| GET | `/tools` | admin | List all tools |
| POST | `/tools/{id}/deactivate` | admin | Deactivate listing |
| POST | `/tools/{id}/reactivate` | admin | Reactivate listing |
| GET | `/audit-log` | admin | View moderation history |
| POST | `/reservations/{id}/force-return` | admin | Force return |
| GET | `/violations` | admin | View violation profiles |
| GET | `/moderation-reports` | admin | Generate/export reports |

### Health (`/api/v1/health`) — `api/v1/health.py:1-21`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | none | `{"status": "ok"}` |

---

## 11. Services — Business Logic Layer

### AuthService (470 lines) — `services/auth.py:44-470`

Handles the full auth lifecycle:
- `create_invite()` (`services/auth.py:53-78`) → generates token, sends email
- `register()` (`services/auth.py:123-174`) → validates invite token, creates user with EMAIL_PENDING
- `verify_email()` (`services/auth.py:179-215`) → activates user, returns tokens
- `login()` (`services/auth.py:253-297`) → validates credentials, returns tokens
- `refresh()` (`services/auth.py:299-343`) → rotates refresh token
- `forgot_password()` (`services/auth.py:363-394`) → creates reset token, sends email
- `reset_password()` (`services/auth.py:396-431`) → validates token, updates password, returns tokens
- `update_me()` (`services/auth.py:440-458`) → updates profile fields
- `delete_me()` (`services/auth.py:460-470`) → soft-delete (checks no active reservations)

### ToolService (584 lines) — `services/tool.py:31-584`

- `create_tool()` (`services/tool.py:40-83`) → validates category, checks duplicate name
- `create_with_photos()` (`services/tool.py:126-155`) → creates tool + uploads photos atomically
- `add_photos()` (`services/tool.py:85-124`) → validates image (magic bytes!), enforces 1-5 limit
- `list_tools()` (`services/tool.py:177-274`) → advanced filtering (category, search, availability, condition, rating)
- `deactivate_tool()` (`services/tool.py:446-500`) → owner deactivation, auto-cancels pending reservations
- `reactivate_tool()` (`services/tool.py:500-540`) → owner reactivation
- `deactivate_by_admin()` (`services/tool.py:540-584`) → admin deactivation with audit log

### ReservationService (644 lines) — `services/reservation.py:25-644`

The most complex service — full lifecycle with state machine enforcement:
- `create_reservation()` (`services/reservation.py:31-92`) → validates dates, checks self-reservation, catches GiST EXCLUDE conflicts
- `approve()` (`services/reservation.py:188-234`) → double-checks overlap (defense-in-depth over GiST constraint)
- `deny()` (`services/reservation.py:236-267`) → sets denied_reason
- `cancel()` (`services/reservation.py:269-334`) → borrower or owner, with reason
- `mark_picked_up()` (`services/reservation.py:336-384`) → borrower only, validates not before start_date
- `mark_returned()` (`services/reservation.py:386-422`) → borrower only
- `mark_damaged()` (`services/reservation.py:424-550`) → owner, 7-day window, auto-deactivates tool, increments borrower's damage_reported, cancels pending reservations
- `force_return()` (`services/reservation.py:550-644`) → admin only, audit-logged

### ReviewService (280 lines) — `services/review.py:21-280`

- `create_review()` (`services/review.py:24-84`) → RETURNED reservation only, 30-day window, one per reviewer
- `_recalculate_ratings()` (`services/review.py:228-280`) → updates tool's `avg_rating` and `rating_count` atomically
- 24-hour edit window, self-review blocked

### AdminService (456 lines) — `services/admin.py:21-456`

Every action is audit-logged to `admin_audit_log`:
- `deactivate_user()` (`services/admin.py:93-146`) → suspends, notifies user
- `reactivate_user()` (`services/admin.py:148-189`) → reactivates, notifies user
- `delete_user()` (`services/admin.py:191-241`) → hard-delete with anonymization (replaces PII)
- `record_tool_deactivation()` (`services/admin.py:246-264`) / `record_reservation_force_return()` (`services/admin.py:284-302`) → audit entries

### ListingReportService (271 lines) — `services/listing_report.py:31-271`

- `submit_report()` (`services/listing_report.py:37-97`) → blocks self-report, duplicate, deactivated listing
- `resolve_report()` (`services/listing_report.py:102-236`) → VALID: deactivates tool, auto-cancels pending reservations, increments violation_count; INVALID: just updates status

### NotificationService (102 lines) — `services/notification.py:15-102`

- `create()` (`services/notification.py:18-39`) → creates in-app notification
- `list_for_user()` → paginated, with unread_count
- `mark_read()` → sets read_at

### CategoryService (123 lines)

- `list_categories()` → ordered by name
- `create_category()` → case-insensitive duplicate check
- `remove_category()` → blocked if ACTIVE tools use it
- `validate_category_name()` → used by ToolService to validate category exists

### MessageService (119 lines)

- `send_message()` → borrower, owner, or admin; read-only for closed states
- `list_messages()` → paginated, chronological

---

## 12. Reservation State Machine

```
                    ┌──────────┐
                    │ REQUESTED │
                    └────┬─────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        ┌────────┐  ┌─────────┐  ┌───────────┐
        │APPROVED│  │ DENIED  │  │ CANCELLED │
        └───┬────┘  └─────────┘  └───────────┘
            │                     (borrower or
            │                      owner cancel)
            ▼
      ┌───────────┐
      │ PICKED_UP │
      └─────┬─────┘
            │
      ┌─────┼──────────────┐
      ▼     ▼              ▼
┌──────────┐  ┌────────────────┐
│ RETURNED │  │   CANCELLED    │
└──────────┘  │ (auto-cancel   │
              │  if not picked │
              │  up in 3 days) │
              └────────────────┘
```

**Who can do what:**
| Action | Who | From State | To State |
|--------|-----|------------|----------|
| Approve | tool owner | REQUESTED | APPROVED |
| Deny | tool owner | REQUESTED | DENIED |
| Cancel | borrower | REQUESTED, APPROVED | CANCELLED |
| Cancel | owner | APPROVED only | CANCELLED |
| Confirm pickup | borrower | APPROVED | PICKED_UP |
| Confirm return | borrower | PICKED_UP | RETURNED |
| Report damage | owner | RETURNED | (stays RETURNED, flags tool) |
| Force return | admin | PICKED_UP | RETURNED |
| Auto-cancel | system (scheduler) | APPROVED | CANCELLED |
| Auto-escalate | system (scheduler) | PICKED_UP | (sends overdue notification) |
| Auto force-return | system (scheduler) | PICKED_UP | RETURNED |

---

## 13. Background Scheduler

APScheduler runs three periodic jobs (`services/scheduler.py:41-272`):

### 1. auto_cancel_overdue_pickups (hourly) — `services/scheduler.py:85-128`
- Finds APPROVED reservations where `start_date < today - 3 days`
- Sets state to CANCELLED with `cancelled_by_type = "system"`
- Notifies borrower

### 2. auto_escalate_overdue_returns (hourly) — `services/scheduler.py:130-230`
Two-phase escalation:
- **Soft** (7 days overdue): sends RESERVATION_OVERDUE notification, deduped per user within 24h
- **Hard** (14 days overdue): force-returns the reservation (sets state to RETURNED, sets `force_resolved_at`)

### 3. cleanup_expired_tokens (daily) — `services/scheduler.py:232-273`
- Transitions SENT invites past their `expires_at` to EXPIRED
- Deletes unused tokens older than 30 days (email_verification, password_reset, invite)

**All timing is configurable via env vars:** `SCHEDULER_GRACE_PERIOD_DAYS`, `SCHEDULER_ESCALATION_DAYS`, `SCHEDULER_HARD_ESCALATION_DAYS`, `SCHEDULER_TOKEN_RETENTION_DAYS`, `SCHEDULER_NOTIFICATION_DEDUP_HOURS`

**Disabled in tests:** `DISABLE_SCHEDULER=true`

---

## 14. Photo Upload Pipeline

1. Route receives `UploadFile` via multipart form (`api/v1/tools.py`)
2. `ToolService.add_photos()` (`services/tool.py:85-124`) checks count (max 5)
3. `PhotoStorageService.validate_image()` (`services/photo_storage.py:62-102`):
   - Checks Content-Type header (JPEG, PNG, WebP, GIF)
   - Checks file size (≤5 MB)
   - **Magic-byte validation** — reads first 16 bytes, compares against known signatures:
     - JPEG: `FF D8 FF`
     - PNG: `89 50 4E 47 0D 0A 1A 0A`
     - GIF87a/GIF89a
     - WebP: `RIFF....WEBP`
   - Rejects mismatched content (e.g., renamed .exe)
4. Saves to `media/tool_photos/` with unique filename (UUID + extension) (`services/photo_storage.py:104-115`)
5. Creates `Photo` record with URL path (`models/photo.py:16-39`)

**StaticFiles mount:** `app.mount("/uploads", StaticFiles(directory="media/tool_photos"))` serves images at `/uploads/<filename>` (`main.py:119-121`)

---

## 15. Rate Limiting

In-memory, per-process rate limiting using a sliding-window counter (`core/rate_limit.py:20-70`, configured via `dependencies_rate_limit.py:55-96`):

| Endpoint | Default Limit | Window |
|----------|--------------|--------|
| `/auth/login` | 50 requests/IP | 60 seconds |
| `/auth/forgot-password` | 50 requests/IP | 60 seconds |
| `/auth/resend-verification` | 50 requests/IP | 60 seconds |
| `/auth/register` | 50 requests/IP | 3600 seconds |

**Key design:** Uses `request.client.host` (TCP connection address), NOT `X-Forwarded-For` header (which is spoofable). Behind a trusted proxy, start uvicorn with `--proxy-headers`.

---

## 16. Email Service

**Backend abstraction:**
- `_MailHogBackend` (`services/email.py:22-35`) — development: sends to localhost:1025 (MailHog)
- `_SMTPBackend` (`services/email.py:38-76`) — production: real SMTP with auto-detection (port 465 → implicit SSL, port 587 → STARTTLS)

**Email types:**
- Invite email (with registration link + token)
- Verification email (with verification link + token)
- Password reset email (with reset link + token)

**Fail-safe:** SMTP failures are logged as warnings, not raised. The operation continues (tokens are saved in DB, so manual recovery is possible).

---

## 17. Testing Architecture

- **Framework:** pytest + pytest-asyncio + httpx (ASGITransport)
- **Test DB:** `toolsharing_test` (separate from dev DB)
- **Session-scoped fixtures:** engine, db_session, client
- **Per-test:** transaction rollback (each test runs in a rolled-back transaction)
- **Test count:** 337 tests (unit + acceptance), 44 skipped, 13 xfailed

**Test organization:**
```
tests/
│   ├── conftest.py          # fixtures: engine, session, client, test env setup (tests/conftest.py)
├── factories.py         # test data factories
├── test_auth.py         # auth endpoint tests
├── test_tools.py        # tool endpoint tests
├── test_reservations.py # reservation lifecycle tests
├── test_reviews.py      # review endpoint tests
├── test_notifications.py
├── test_admin.py
├── test_config.py
└── acceptance/          # US01-US34 acceptance tests (one file per user story)
    ├── test_us01_register.py
    ├── test_us02_verify_email.py
    ├── ...
    └── test_us34_admin_all_reservations.py
```

**Key patterns:**
- Tests use `ASGITransport` (no real HTTP server)
- `DISABLE_SCHEDULER=true` prevents background jobs
- `reset_all_limiters()` clears rate limit state between tests
- Each test gets a fresh session that's rolled back after assertions

---

*Document prepared for R2 Demo — Code Walkthrough & DB Schema segment.*
