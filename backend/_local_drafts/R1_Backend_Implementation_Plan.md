# R1 Backend Implementation Plan

**Project:** ICS 613 — Neighborhood Tool Sharing Platform  
**Team:** Group 3  
**Scope:** Backend only, R1.A through R1.C  
**Source:** `Backend_Scaffolding_Blueprint.md`, `Technical_Design_Backend.md`, `Phasing_Plan_with_Roles.md`, and the latest v5 user stories.

---

## 1. Goal

Deliver a working R1 backend in three sequential phases:

1. **R1.A — Foundation:** invite-only registration, authentication, profile management, password reset, and base infrastructure.
2. **R1.B — Core demo path:** tool listings, photos, reservations, reviews, and the HST date/time utility.
3. **R1.C — Cross-cutting infrastructure:** JWT auth middleware, email service, notifications, APScheduler jobs, audit log, and health endpoint.

Each phase has its own file list, verification checklist, and stop condition. Do not start the next phase until the current one passes verification.

---

## 2. Before any phase

### 2.1 Prerequisites

- [ ] PostgreSQL 15 container running via `docker compose up -d`.
- [ ] Python 3.11, 3.12, or 3.13 installed.
- [ ] Virtual environment created and activated.
- [ ] Dependencies installed from updated `requirements.txt`.
- [ ] `.env` created from `.env.example` with correct `DATABASE_URL` and `TEST_DATABASE_URL`.

### 2.2 Files that exist once before R1.A starts

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Production image |
| `backend/docker-compose.yml` | Postgres service |
| `backend/docker-compose.override.yml` | Dev overrides |
| `backend/.env.example` | Env template |
| `backend/pyproject.toml` | ruff, mypy, pytest config |
| `backend/requirements.txt` | Dependencies |
| `backend/alembic.ini` | Migration runner config |

### 2.3 Updated `requirements.txt`

Make sure these are present:

```text
fastapi>=0.115,<0.120
uvicorn[standard]>=0.32,<0.40
sqlalchemy>=2.0,<2.1
asyncpg>=0.30,<1.0
psycopg2-binary>=2.9,<3.0
alembic>=1.14,<2.0
pydantic>=2.10,<3.0
pydantic-settings>=2.7,<3.0
email-validator>=2.2,<3.0
python-multipart>=0.0.20,<1.0
python-jose[cryptography]>=3.3,<4.0
bcrypt>=4.0,<5.0
python-dotenv>=1.0,<2.0
apscheduler>=3.10,<4.0
pytest>=8.3,<9.0
pytest-asyncio>=0.24,<1.0
httpx>=0.28,<1.0
factory-boy>=3.3,<4.0
ruff>=0.8,<1.0
mypy>=1.13,<2.0
```

---

## 3. Phase R1.A — Foundation

**Stories covered:** Admin Invites, US1 Register, US2 Verify Email, US3 Log In/Log Out, US4 Reset Password, US5 Set Up Profile, US6 Edit Profile, US7 Delete Account.

**Goal:** A backend that can create admins, send invites, register users, verify emails, log in/out, manage profiles, and delete accounts.

### 3.1 Create core infrastructure files

| # | File | What it must contain |
|---|------|---------------------|
| 1 | `src/app/__init__.py` | Empty package marker |
| 2 | `src/app/core/__init__.py` | Empty package marker |
| 3 | `src/app/core/exceptions.py` | `AppError` base, `NotFoundError`, `PermissionDeniedError`, `ConflictError`, `ValidationError`, `VerifyTokenError` with `resend_available` |
| 4 | `src/app/core/security.py` | `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token`, `TokenSubject` helper |
| 5 | `src/app/core/logging.py` | `get_logger()` returning a stdlib logger |
| 6 | `src/app/config.py` | `Settings` pydantic-settings class, production secret validator, timezone helper |
| 7 | `src/app/db/__init__.py` | Empty package marker |
| 8 | `src/app/db/base.py` | `DeclarativeBase`, `AsyncAttrs`, `UUIDMixin`, shared `metadata` |
| 9 | `src/app/db/session.py` | `async_engine`, `AsyncSessionLocal`, `get_db()` dependency |
| 10 | `src/app/dependencies.py` | `get_db`, `get_current_user`, `get_current_admin_user` (admin dependency is stub in R1.A, enforced in R1.C) |
| 11 | `src/app/main.py` | FastAPI app factory, CORS, exception handlers, scheduler mount point (scheduler added in R1.C) |

### 3.2 Create R1.A models

| # | File | What it must contain |
|---|------|---------------------|
| 12 | `src/app/models/__init__.py` | Import all models so Alembic can discover them |
| 13 | `src/app/models/enums.py` | `UserStatus`, `InviteStatus`, and any enums needed for R1.A tokens |
| 14 | `src/app/models/user.py` | `User` model: UUID PK, email unique indexed, hashed_password, full_name, bio, neighborhood, photo_url, status, is_admin, trust_score, damage_reported, violation_count, password_changed_at, deleted_at |
| 15 | `src/app/models/invite.py` | `InviteToken` model: UUID PK, token unique, email, status, created_by FK, expires_at, used_at |
| 16 | `src/app/models/email_verification.py` | `EmailVerificationToken` model: UUID PK, token unique, FK user CASCADE, expires_at, used_at |
| 17 | `src/app/models/password_reset.py` | `PasswordResetToken` model: UUID PK, token unique, FK user CASCADE, expires_at, used_at |

### 3.3 Create R1.A schemas

| # | File | What it must contain |
|---|------|---------------------|
| 18 | `src/app/schemas/__init__.py` | Empty or re-exports |
| 19 | `src/app/schemas/common.py` | `MessageResponse`, `ErrorResponse` |
| 20 | `src/app/schemas/auth.py` | `InviteCreate`, `InviteResponse`, `RegisterRequest`, `VerifyEmailRequest`, `ResendRequest`, `LoginRequest`, `TokenPairResponse`, `RefreshRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest` |
| 21 | `src/app/schemas/user.py` | `UserCreate`, `UserUpdate`, `UserPublic`, `UserProfile` |

### 3.4 Create R1.A services

| # | File | What it must contain |
|---|------|---------------------|
| 22 | `src/app/services/__init__.py` | Empty package marker |
| 23 | `src/app/services/auth.py` | `AuthService` with methods: create_invite, register, verify_email, resend_verification, login, refresh, logout, get_me, update_me, delete_me, forgot_password, reset_password |
| 24 | `src/app/services/user.py` | `UserService` profile helpers |
| 25 | `src/app/services/email.py` | Email abstraction: SMTP/MailHog sending, verification email, reset email, invite email |

### 3.5 Create R1.A API router

| # | File | What it must contain |
|---|------|---------------------|
| 26 | `src/app/api/__init__.py` | Empty package marker |
| 27 | `src/app/api/v1/__init__.py` | `api_router` aggregating routers |
| 28 | `src/app/api/v1/auth.py` | All `/auth` endpoints listed in the blueprint |

### 3.6 Create first Alembic migration

| # | Task | Command / file |
|---|------|----------------|
| 29 | Initialize Alembic async env | `alembic init -t async alembic` (only if not already present) |
| 30 | Write `alembic/env.py` | Async connection, target metadata from `app.db.base` and `app.models` |
| 31 | Generate migration | `alembic revision --autogenerate -m "r1a_users_invites_tokens"` |
| 32 | Apply migration | `alembic upgrade head` |

### 3.7 Create R1.A tests

| # | File | What it must contain |
|---|------|---------------------|
| 33 | `src/app/tests/__init__.py` | Empty package marker |
| 34 | `src/app/tests/conftest.py` | Async engine, drop/create tables per session, async client fixture, auth header helper |
| 35 | `src/app/tests/factories.py` | `UserFactory`, `InviteFactory`, `VerificationTokenFactory`, `ResetTokenFactory` |
| 36 | `src/app/tests/test_auth.py` | Tests for all auth flows |

### 3.8 Update helper scripts

| # | File | What it must contain |
|---|------|---------------------|
| 38 | `scripts/check_db.py` | Async version using `asyncpg`/`create_async_engine` |
| 39 | `scripts/seed_dev.py` | Deterministic seed data for manual testing |

### 3.9 R1.A verification checklist

Run each command and confirm it passes.

- [ ] `docker compose ps` shows `db` Up.
- [ ] `python scripts/check_db.py` prints all green checks.
- [ ] `alembic upgrade head` completes without errors.
- [ ] `alembic downgrade -1` and `alembic upgrade head` both work.
- [ ] `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload` starts.
- [ ] OpenAPI docs load at `http://127.0.0.1:8000/docs`.
- [ ] `pytest src/app/tests/test_auth.py -q` passes.
- [ ] `ruff check src` reports zero errors.
- [ ] `mypy src` reports zero errors on R1.A files.

**Stop condition:** All checklist items pass. Only then start R1.B.

---

## 4. Phase R1.B — Core demo path

**Stories covered:** US8 Create Tool, US9 Edit Tool and Photos, US10 Delete/Deactivate Tool, US11 Admin Listing Controls, US12 Browse/Search, US13 Submit Reservation, US14 Approve/Deny, US15 Cancel as Borrower, US16 Cancel as Owner, US17 Confirm Pickup, US18 Auto-Cancel, US19 Timezone/Date Normalization, US20 Confirm Return, US21 View Reservation History, US24 Leave Review, US25 View Review History.

**Goal:** A backend that supports the full tool-lending demo path: list tool → request → approve → pickup → return → review, plus owner/admin tool management and the HST date utility.

### 4.1 Add R1.B models

| # | File | What it must contain |
|---|------|---------------------|
| 1 | Update `src/app/models/enums.py` | Add `ToolCategory`, `ToolCondition`, `ReservationState`, `DeactivationActor` |
| 2 | `src/app/models/tool.py` | `Tool` model |
| 3 | `src/app/models/photo.py` | `Photo` model |
| 4 | `src/app/models/reservation.py` | `Reservation` model with EXCLUDE constraint |
| 5 | `src/app/models/review.py` | `Review` model |

### 4.2 Add R1.B schemas

| # | File | What it must contain |
|---|------|---------------------|
| 6 | `src/app/schemas/tool.py` | `ToolCreate`, `ToolUpdate`, `ToolListItem`, `ToolDetail`, `ToolAvailabilityFilter`, `PhotoResponse` |
| 7 | `src/app/schemas/reservation.py` | `ReservationCreate`, `ReservationResponse`, `ReservationAction`, `DamageReportCreate` |
| 8 | `src/app/schemas/review.py` | `ReviewCreate`, `ReviewUpdate`, `ReviewResponse` |
| 9 | Update `src/app/schemas/common.py` | `PaginatedResponse[T]` |

### 4.3 Add R1.B services

| # | File | What it must contain |
|---|------|---------------------|
| 10 | `src/app/services/tool.py` | `ToolService`: CRUD, photo upload/delete/reorder, deactivate/reactivate, availability filter |
| 11 | `src/app/services/photo_storage.py` | Save/delete files, validate MIME/size, generate `/uploads/` URLs |
| 12 | `src/app/services/reservation.py` | `ReservationService`: create, approve/deny/cancel, mark-picked-up, mark-returned, damage report, admin force-return |
| 13 | `src/app/services/review.py` | `ReviewService`: create/update/delete, 24h edit, 30-day create window, recalculate aggregates |
| 14 | `src/app/services/timezone.py` | `normalize_hst()`, `utc_to_hst()`, HST constants |
| 15 | Update `src/app/services/scheduler.py` | Stub file; full APScheduler integration is R1.C |

### 4.4 Add R1.B routers

| # | File | What it must contain |
|---|------|---------------------|
| 16 | `src/app/api/v1/tools.py` | All `/tools` endpoints |
| 17 | `src/app/api/v1/reservations.py` | All `/reservations` endpoints |
| 18 | `src/app/api/v1/reviews.py` | All review endpoints |
| 19 | Update `src/app/api/v1/__init__.py` | Include new routers |
| 20 | Update `src/app/main.py` | Mount `StaticFiles` at `/uploads` |

### 4.5 Add R1.B Alembic migration

| # | Task | Command |
|---|------|---------|
| 21 | Generate migration | `alembic revision --autogenerate -m "r1b_tools_reservations_reviews"` |
| 22 | Verify EXCLUDE constraint | Inspect `reservations` table; confirm GiST EXCLUDE exists |
| 23 | Apply migration | `alembic upgrade head` |

### 4.6 Add R1.B tests

| # | File | What it must contain |
|---|------|---------------------|
| 24 | Update `src/app/tests/factories.py` | `ToolFactory`, `PhotoFactory`, `ReservationFactory`, `ReviewFactory` |
| 25 | `src/app/tests/test_tools.py` | CRUD, photos, deactivate, search, availability |
| 26 | `src/app/tests/test_reservations.py` | Lifecycle, overlap 409, state-machine blocks, pickup/return windows |
| 27 | `src/app/tests/test_reviews.py` | Create, edit/delete window, one-per-reservation |
| 28 | `src/app/tests/test_timezone.py` | HST normalization edge cases |

### 4.7 R1.B verification checklist

- [ ] `alembic upgrade head` applies cleanly.
- [ ] `psql` or `\d reservations` shows the GiST EXCLUDE constraint.
- [ ] OpenAPI docs show `/tools`, `/reservations`, `/reviews` endpoints.
- [ ] Manual smoke test: create user → create tool → request → approve → pickup → return → review via `/docs`.
- [ ] `pytest src/app/tests/test_tools.py src/app/tests/test_reservations.py src/app/tests/test_reviews.py -q` passes.
- [ ] Overlapping reservation returns HTTP 409.
- [ ] Editing tool while `PICKED_UP` is blocked.
- [ ] Review outside 30-day window is blocked.
- [ ] `ruff check src` zero errors.
- [ ] `mypy src` zero errors on R1.B files.

**Stop condition:** All checklist items pass. Only then start R1.C.

---

## 5. Phase R1.C — Cross-cutting infrastructure

**Infrastructure items:** JWT auth middleware, email service, notification subsystem, job runner (APScheduler), HST timezone utility (already in R1.B), Postgres EXCLUDE constraint (already in R1.B), audit log table.

**Goal:** Secure the API with JWT middleware, wire up real/dev email, add notifications, enable scheduler jobs, and record admin actions in an immutable audit log.

### 5.1 Enforce JWT auth middleware

| # | File | What it must contain |
|---|------|---------------------|
| 1 | `src/app/dependencies.py` | Full `get_current_user`, `get_current_admin_user` dependencies using JWT |
| 2 | Update all routers | Apply `Depends(get_current_user)` and `Depends(get_current_admin_user)` where required |
| 3 | Update `src/app/core/security.py` | Confirm token invalidation works against `password_changed_at` |

### 5.2 Email service

| # | File | What it must contain |
|---|------|---------------------|
| 4 | `src/app/services/email.py` | SMTP prod sender, MailHog dev sender, send methods for verification/reset/invite |
| 5 | Update `docker-compose.yml` / `docker-compose.override.yml` | Optional `mailhog` service on ports 1025/8025 |
| 6 | Update `.env.example` | `SMTP_*` and `MAILHOG_*` variables |
| 7 | Update tests | Mock email sending so tests stay offline |

### 5.3 Notification subsystem

| # | File | What it must contain |
|---|------|---------------------|
| 8 | `src/app/models/enums.py` | Add `NotificationType` ENUM |
| 9 | `src/app/models/notification.py` | `Notification` model |
| 10 | `src/app/schemas/notification.py` | `NotificationResponse`, `NotificationList` |
| 11 | `src/app/services/notification.py` | `NotificationService`: create on status changes, list, mark-read |
| 12 | `src/app/api/v1/notifications.py` | `GET /notifications`, `POST /notifications/{id}/read` |
| 13 | Update services | Call `NotificationService.create(...)` on reservation state changes and tool deactivation |

### 5.4 APScheduler job runner

| # | File | What it must contain |
|---|------|---------------------|
| 14 | `src/app/services/scheduler.py` | `SchedulerService`: `auto_cancel_overdue_pickups()`, `escalate_overdue_returns()`, HST-aware |
| 15 | Update `src/app/main.py` | Start scheduler on startup, shut down on shutdown, respect `TOOLSHARING_DISABLE_SCHEDULER` |
| 16 | Add scheduler tests | Verify job logic in isolation |

### 5.5 Audit log

| # | File | What it must contain |
|---|------|---------------------|
| 17 | `src/app/models/admin_audit_log.py` | `AdminAuditLog` model |
| 18 | `src/app/services/admin.py` | `AdminService`: user/tool deactivate/reactivate, audit-log inserts, queries |
| 19 | `src/app/schemas/admin.py` | `AdminActionRequest`, `AuditLogFilter`, `AuditLogResponse` |
| 20 | `src/app/api/v1/admin.py` | Admin endpoints (initial set from R1.B plus full audit-log endpoint) |
| 21 | Update `src/app/services/tool.py` | Insert audit-log rows on deactivate/reactivate |

### 5.6 Health endpoint

| # | File | What it must contain |
|---|------|---------------------|
| 22 | `src/app/api/v1/health.py` | `GET /api/v1/health` returning `{"status": "ok"}` |

### 5.7 R1.C Alembic migration

| # | Task | Command |
|---|------|---------|
| 23 | Generate migration | `alembic revision --autogenerate -m "r1c_notifications_audit_log_scheduler"` |
| 24 | Apply migration | `alembic upgrade head` |

### 5.8 R1.C tests

| # | File | What it must contain |
|---|------|---------------------|
| 25 | Update `src/app/tests/conftest.py` | Ensure scheduler is disabled during tests |
| 26 | `src/app/tests/test_notifications.py` | Notification creation on state change, mark-read |
| 27 | `src/app/tests/test_scheduler.py` | Auto-cancel after 3-day grace, escalation after 7 days |
| 28 | `src/app/tests/test_admin.py` | Admin user/tool actions, audit-log entries |
| 29 | `src/app/tests/test_health.py` | Health endpoint |
| 30 | Update `src/app/tests/test_auth.py` | Email mocked, admin invite endpoint guarded |

### 5.9 R1.C verification checklist

- [ ] `alembic upgrade head` applies cleanly.
- [ ] All routers require valid JWT where specified.
- [ ] Admin-only endpoints return 403 for non-admin users.
- [ ] MailHog catches verification/reset/invite emails in dev.
- [ ] Notifications are created on reservation state changes.
- [ ] Scheduler auto-cancels an APPROVED reservation after 3-day grace.
- [ ] Scheduler escalates an overdue PICKED_UP reservation after 7 days.
- [ ] Audit-log rows are inserted on every admin/owner deactivate and reactivate.
- [ ] `GET /api/v1/health` returns `{"status": "ok"}`.
- [ ] `pytest src/app/tests -q` passes.
- [ ] `ruff check src` zero errors.
- [ ] `mypy src` zero errors.

**Stop condition:** All checklist items pass. R1 is complete.

---

## 6. Post-R1 tasks (before R2 starts)

These are not part of R1.C, but they should happen before R2 begins:

- [ ] Review the R1 implementation against every v5 R1 acceptance criterion.
- [ ] Run the E2E smoke path: invite → register → verify → login → create tool → request → approve → pickup → return → review.
- [ ] Generate a test coverage report: `pytest --cov=app --cov-report=term-missing`.
- [ ] Fill coverage gaps if any core module is below 70%.
- [ ] Update `SETUP.md` with any new commands or env variables.
- [ ] Tag or note the R1 completion commit.

---

## 7. What is intentionally out of scope for R1

These R2 stories are not touched:

- US22 Reservation Messaging
- US23 Notification Center UI (backend endpoint exists; UI is frontend scope)
- US26 Member Reports Listing
- US27 Admin Reviews Reports
- US29 Admin Tracks Violations
- US30 Admin Suspends Member
- US31 Admin Reactivates Suspended Member
- US32 Admin Moderation History (audit log schema exists; full admin history UI is R2)
- US34 Admin Views All Active Reservations
- Icebox US28 and US33

---

## 8. Risk reminders

| Risk | Mitigation in this plan |
|------|------------------------|
| Double-booking race | Build the EXCLUDE GiST constraint in R1.B, test concurrent overlap in R1.B tests. |
| Email delivery failure | Use MailHog in R1.C; mock in tests. |
| Default secret in production | `Settings` validator rejects the dev default when `ENVIRONMENT=production`. |
| Scheduler running during tests | `TOOLSHARING_DISABLE_SCHEDULER=true` in test config. |
| ENUM migration pain | Define all R1 ENUMs early in R1.A and R1.B so R1.C only adds `NotificationType`. |

---

## 9. Summary

| Phase | Main outputs | Verification |
|-------|-------------|--------------|
| R1.A | Users, invites, auth, profile, tokens, base infra | Auth tests pass, migrations work, server starts |
| R1.B | Tools, photos, reservations, reviews, HST utility | Full demo path works, overlap returns 409, tests pass |
| R1.C | JWT middleware, email, notifications, scheduler, audit log, health | Full test suite passes, admin/owner actions logged, jobs run |

Follow the checklist at the end of each phase. Do not begin the next phase until the current one is verified.
