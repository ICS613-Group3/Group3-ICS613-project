# R1 Presentation — Backend Lead Slides (Ivan Wu)

**Presentation Date:** July 7, 2026 (Tuesday)
### Time Allocations: Slide 2 = 60s, Slide 3 (BE portion) = ~40s (shared 120s with FE + DevOps)

> **Updated for R1 bugfix round (commits `b2323e8` + `c5c7b9e`):** suspended read-only login,
> 1-day rentals, damage reports with trust-score impact, profile validation, response field names,
> duplicate damage guard, account deletion preserving history. Test count: 151 → **191**.

---

## Slide 2: Domain Model & ER Diagram Overview (60 seconds)

### Visual: ER Diagram
Insert: `backend/_local_drafts/R1_presentation/er_diagram.png` (embedded directly on slide)
The ER diagram is the primary visual — 14 tables showing the full lifecycle of the tool-sharing platform.
Note: `listing_rules`, `allowed_rules`, and `prohibited_rules` columns have been removed from the User entity
per v5 scope reduction (US28 iceboxed — static category enum replaced configurable rules).

### Slide Title: Overview of the Domain Model and ER diagram

### Talking Points (60 seconds):

**1. Core Entities — The "What" (20s)**

"Our domain model has three core entities: **Users**, **Tools**, and **Reservations**.

- **Users** (22 columns) — members with trust scores, neighborhood, and 4 account states: EMAIL_PENDING → ACTIVE → SUSPENDED/DELETED. Suspended members can still log in read-only. Admins manage the platform.
- **Tools** (20 columns) — listings in 5 categories (HAND_TOOLS, POWER_TOOLS, GARDEN_TOOLS, CLEANING_TOOLS, OUTDOOR_GEAR), 5 conditions (NEW, LIKE_NEW, GOOD, FAIR, POOR), with lending rules, photos (1-5), and deactivation audit trail.
- **Reservations** (16 columns) — the central workflow. 6 states: REQUESTED → APPROVED → PICKED_UP → RETURNED, with DENIED and CANCELLED terminals (6 states total: REQUESTED, APPROVED, PICKED_UP, RETURNED, DENIED, CANCELLED). Double-booking is prevented at the database level with a PostgreSQL EXCLUDE GiST constraint. One-day rentals (start == end date) are supported."

**2. Supporting Entities — The "How" (20s)**

"Supporting these core entities:

- **Invite & Token tables** (3) — invite-only registration via admin-issued tokens; email verification and password reset with time-limited tokens.
- **Communication** (2) — **Messages** in reservation threads, **Notifications** for 14 event types: INVITE_SENT, EMAIL_VERIFIED, PASSWORD_RESET, RESERVATION_REQUESTED, RESERVATION_APPROVED, RESERVATION_DENIED, RESERVATION_CANCELLED, RESERVATION_PICKED_UP, RESERVATION_RETURNED, RESERVATION_OVERDUE, TOOL_DEACTIVATED, TOOL_REACTIVATED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED.
- **Trust & Safety** (3) — **Reviews** (1-5 rating, 24h edit window), **Listing Reports** (member flags inappropriate listings), **Suspension Records** (admin audit trail for account actions).
- **Admin & Config** (2) — **AdminAuditLog** (immutable — insert only, never updated), **ListingRules** (single-row config, ICEBOX for R1)."

**3. Key Design Decisions (20s)**

"Three architectural decisions worth highlighting:

1. **UUID4 primary keys** across all tables — prevents ID enumeration, easier to merge across services.
2. **PostgreSQL native ENUMs** for all state columns — type-safe at the DB level, self-documenting in `\d+`.
3. **EXCLUDE GiST constraint** on reservations — race-condition-proof double-booking prevention. The database itself rejects overlaps; no application-level locking needed."

### ER Diagram callouts on screen:
- Highlight the 3-core-entity cluster: users ← tools ← reservations
- Point to the EXCLUDE GiST annotation on reservations table
- Show the FK chain: invite_tokens → users → tools → reservations → reviews

---

## Slide 3: Major Accomplishments — Backend (40 seconds of 120s shared)

### Slide Title: Major Accomplishments

### On-Slide Content (Backend section):
- **Backend** heading
- **46 Endpoints / 7 Routers — Fully Implemented & Tested**
- Comprehensive coverage of core services ensuring robust data layers and business logic.
- **Endpoint Breakdown:**
  - Auth: 13 endpoints
  - Tools: 11 endpoints
  - Reservations: 10 endpoints
  - Reviews: 5 endpoints
  - Admin: 4 endpoints
  - Notifications & Health: 3 endpoints
- **Infrastructure Highlights**
  - JWT Security: Access & refresh tokens with automatic rotation.
  - Rate Limiting: Configurable active protection on all auth endpoints.
  - Double-Booking Guard: GiST EXCLUDE at DB level + app-level overlap check before approval.
  - APScheduler: Automated stale cancels, escalations, and cleanups.
  - Photo Uploads: Magic-byte validated with a 5 MB disk limit.

### Talking Points (BE Lead — ~40s):

**1. Complete API Surface (15s)**

"We shipped **46 API endpoints** across 7 route modules under `/api/v1`:

- Auth (13) — register, login, refresh, logout, email verify, password reset, admin invites
- Tools (11) — CRUD, photo upload, deactivate/reactivate with audit
- Reservations (10) — full state machine lifecycle, overlap rejection (409), admin force-return
- Reviews (5) — per-reservation CRUD, rating aggregation
- Admin (4) — user/tool moderation, audit-log queries
- Notifications & Health (3) — in-app notification list, mark-read, health ping

Every endpoint is backed by Pydantic v2 schemas for request validation and returns consistent JSON responses."

**2. Infrastructure Highlights (15s)**

"Five key infrastructure decisions on screen:

- **JWT access + refresh tokens** with automatic rotation — 15-minute access, 7-day refresh, password-change invalidation
- **Rate limiting** on all auth endpoints — login 50/min, register 50/hr, configurable per environment
- **Double-booking prevention** at two layers — GiST EXCLUDE constraint at the database level plus an app-level overlap check before approval; defense-in-depth with a clean 409 response
- **APScheduler** for background tasks — auto-cancel overdue pickups, auto-escalate late returns, token cleanup
- **Photo validation** — magic-byte verified, 5 MB cap, up to 5 per listing"

**3. Testing & Architecture (10s)**

"**191 automated tests** all passing, running against a real PostgreSQL database — no mocks at the data layer. 40 new acceptance tests added for R1 bugfix round covering suspended login, damage reports, 1-day rentals, admin suspend/reactivate, and HST timezone normalization. N-Tier architecture: Routes → Services → Repositories → Models. SQLAlchemy 2.0, Alembic migrations, bcrypt for password hashing."

### On-screen during BE portion:
- Endpoint count: **46** across 7 routers
- Test count: **191 passing** (151 unit + 40 acceptance)
- Infrastructure highlights: JWT, rate limiting, double-booking guard (DB + app), APScheduler, photo validation

### Transition to FE Lead / DevOps Lead:
"With 46 endpoints and a fully-tested backend, the API surface is ready for the frontend to integrate — Yafei will walk through the frontend accomplishments next."

---

## Speech Script

### Slide 2 — Domain Model & ER Diagram (60 seconds)

---

"Hi everyone, I'm Ivan, the backend lead. I'll walk you through our domain model — 10 tables covering the full lifecycle of a neighborhood tool-sharing platform.

**[Point to ER diagram — core cluster]**

At the center, we have three core entities. **Users** are our members — they register via admin-issued invites and verify their email. Each account has four states: email pending, active, suspended, or deleted. Suspended members can still log in to view tools and their history. Each user can list **Tools** in one of five categories — hand tools, power tools, garden tools, cleaning tools, and outdoor gear — with up to five photos. When a member wants to borrow, they create a **Reservation**. This is a six-state workflow: requested, approved, picked up, returned, plus denied and cancelled. We prevent double-booking at the database level with a PostgreSQL EXCLUDE GiST constraint, so no two borrowers can reserve the same tool for overlapping dates. One-day rentals are supported — start and end on the same day.

**[Move to supporting tables]**

Around that core, we have supporting tables. Three token tables for invite-only registration, email verification, and password reset — all with time-limited tokens. Notifications for 14 event types — INVITE_SENT, EMAIL_VERIFIED, PASSWORD_RESET, RESERVATION_REQUESTED, RESERVATION_APPROVED, RESERVATION_DENIED, RESERVATION_CANCELLED, RESERVATION_PICKED_UP, RESERVATION_RETURNED, RESERVATION_OVERDUE, TOOL_DEACTIVATED, TOOL_REACTIVATED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED — including reservation state changes and tool/admin alerts. One-to-five star reviews, damage reports, and an immutable admin audit log — insert only, never updated, so every moderation action is traceable.

**[Wrap up]**

Three design decisions: UUID4 primary keys to prevent ID enumeration. PostgreSQL native enums so the database itself enforces valid states. And the GiST exclusion constraint — it's race-condition-proof. Even if two borrowers click 'reserve' at the exact same millisecond, the database rejects the second one.

That's the domain model — over to the major accomplishments."

---

### Slide 3 — Major Accomplishments, Backend Portion (~40 seconds)

---

"For the backend, R1 is fully delivered. We shipped **46 API endpoints** across seven route modules — auth, tools, reservations, reviews, admin, notifications, and health — all under `/api/v1`. Every endpoint uses Pydantic v2 schemas and returns consistent JSON.

Six infrastructure highlights on screen: JWT with automatic token rotation — 15-minute access, 7-day refresh. Rate limiting on all auth endpoints with configurable thresholds. Double-booking prevention at two layers — the GiST EXCLUDE constraint rejects overlaps at the database level, race-condition-proof, plus an application-level overlap check before approval for defense-in-depth and a clean 409 response. APScheduler handles background tasks like auto-cancelling overdue pickups. Photo uploads are magic-byte validated with a 5 MB cap. And damage reports that lower the borrower's trust score.

Latest fixes on top: suspended members can log in read-only. One-day rentals work. Profile names can't be blank. Response fields include tool name and borrower name. Duplicate damage reports are blocked. Account deletion preserves past reservation history.

The test suite has **191 automated tests** — 151 unit plus 40 acceptance — all passing against a real PostgreSQL database. We follow strict N-tier: routes call services, services use repositories. The API is stable and ready — let me hand it over to Yafei for the frontend accomplishments."

---

### Timing Notes:
|| Slide | Section | Target | Words | Est. Time |
||-------|---------|--------|-------|-----------|
|| 2 | Full script | 60s | ~230 | ~55s @ 150 wpm |
|| 3 | BE portion | 40s | ~135 | ~35s @ 150 wpm |

Practice tip: speak at a relaxed pace (~140-150 wpm). The GiST constraint explanation is the densest part — slow down there. The infrastructure highlights on slide 3 give natural pacing — one sentence per bullet.

### Q8: \"What happened to the listing_rules columns? They were in the earlier ER diagram.\"

**Spoken answer (~30s):**

"The `listing_rules`, `allowed_rules`, and `prohibited_rules` columns were part of the original v4 user stories — US28, 'Admin Manages Tool Categories,' allowed admins to configure per-listing allow/prohibit rules. 

During the v4→v5 requirement revision, US28 was deprioritized to ICEBOX. Instead of a configurable admin-managed rules system, we simplified to a static 5-category enum hardcoded in `models/enums.py`: HAND_TOOLS, POWER_TOOLS, GARDEN_TOOLS, CLEANING_TOOLS, OUTDOOR_GEAR. Every member sees the same dropdown — no admin can change it in R1, and no per-listing rule customization is needed.

It appears in the ER diagram as a forward-looking design note but has no model file, no API, and no implementation. The FK `updated_by_admin_id` exists in the diagram definition but the PlantUML relationship line was simply never drawn. If we implement it in R2, it would connect to users and link to the tools table's category enum."

**Files to show on screen:**
|- `src/app/models/enums.py:20-25` — static ToolCategory enum (the simplified replacement)
|- `backend/_local_drafts/Phasing_Plan_with_Roles.md:45` — US28 marked as Icebox

---

## ER Table Reference (for Q&A)

10 tables total. All PKs are UUIDv4.

### 1. users
- **PK:** id
- **FKs:** (none)
- **Fields:** id (UUID PK), email (str, unique), hashed_password (str), full_name (str?), bio (text?), neighborhood (str?), photo_url (str?), status (enum: EMAIL_PENDING / ACTIVE / SUSPENDED / DELETED), is_admin (bool), trust_score (float), damage_reported (int), violation_count (int), password_changed_at (datetime?), deleted_at (datetime?), created_at (datetime), updated_at (datetime)

### 2. tools
- **PK:** id
- **FK:** owner_id → users.id
- **Fields:** id (UUID PK), owner_id (UUID FK), name (str), description (text?), category (enum: HAND_TOOLS / POWER_TOOLS / GARDEN_TOOLS / CLEANING_TOOLS / OUTDOOR_GEAR), condition (enum: NEW / LIKE_NEW / GOOD / FAIR / POOR), is_active (bool), deactivated_by (enum?), deactivated_at (datetime?), deactivation_reason (text?), avg_rating (float), rating_count (int), deleted_at (datetime?), created_at (datetime), updated_at (datetime)

### 3. photos
- **PK:** id
- **FK:** tool_id → tools.id
- **Fields:** id (UUID PK), tool_id (UUID FK), url (str), display_order (int), created_at (datetime)

### 4. reservations
- **PK:** id
- **FKs:** tool_id → tools.id, borrower_id → users.id, force_resolved_by → users.id (nullable)
- **Fields:** id (UUID PK), tool_id (UUID FK), borrower_id (UUID FK), state (enum: REQUESTED / APPROVED / PICKED_UP / RETURNED / DENIED / CANCELLED), start_date (date), end_date (date), cancelled_by_type (str?), cancelled_reason (text?), denied_reason (text?), picked_up_at (datetime?), returned_at (datetime?), damage_reported (bool), damage_description (text?), damage_reported_at (datetime?), force_resolved_by (UUID FK?), force_resolved_at (datetime?), force_resolution_reason (text?), created_at (datetime), updated_at (datetime)

### 5. reviews
- **PK:** id
- **FKs:** reservation_id → reservations.id, reviewer_id → users.id, reviewee_id → users.id
- **Fields:** id (UUID PK), reservation_id (UUID FK), reviewer_id (UUID FK), reviewee_id (UUID FK), rating (int, 1-5), comment (text?), created_at (datetime), updated_at (datetime)

### 6. invite_tokens
- **PK:** id
- **FK:** created_by → users.id (nullable)
- **Fields:** id (UUID PK), token (str, unique), email (str), status (enum: SENT / USED / EXPIRED), created_by (UUID FK?), expires_at (datetime), used_at (datetime?), created_at (datetime)

### 7. email_verification_tokens
- **PK:** id
- **FK:** user_id → users.id
- **Fields:** id (UUID PK), token (str, unique), user_id (UUID FK), expires_at (datetime), used_at (datetime?), created_at (datetime)

### 8. password_reset_tokens
- **PK:** id
- **FK:** user_id → users.id
- **Fields:** id (UUID PK), token (str, unique), user_id (UUID FK), expires_at (datetime), used_at (datetime?), created_at (datetime)

### 9. notifications
- **PK:** id
- **FK:** user_id → users.id
- **Fields:** id (UUID PK), user_id (UUID FK), type (enum: 14 event types — INVITE_SENT, EMAIL_VERIFIED, PASSWORD_RESET, RESERVATION_REQUESTED, RESERVATION_APPROVED, RESERVATION_DENIED, RESERVATION_CANCELLED, RESERVATION_PICKED_UP, RESERVATION_RETURNED, RESERVATION_OVERDUE, TOOL_DEACTIVATED, TOOL_REACTIVATED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED), title (str), body (text), payload (JSONB?), read_at (datetime?), created_at (datetime)

### 10. admin_audit_log
- **PK:** id
- **FK:** actor_id → users.id (nullable)
- **Fields:** id (UUID PK), actor_id (UUID FK?), action_type (str), target_type (str), target_id (UUID), reason (text), metadata (JSONB?), created_at (datetime)

---

## Code Walkthrough Preparation — Backend Lead

### Instructor Q&A Cheat Sheet

Six topics the instructor is most likely to probe. Each has a **30-60s spoken answer** and exact **file:line** references for live code walkthrough.

---

### Q1: "Walk us through your architecture"

**Spoken answer (~45s):**

"We follow a strict N-tier pattern. At the top, `main.py:80` is the app factory — it creates the FastAPI instance, registers CORS, mounts exception handlers, and includes the v1 API router. The router aggregation happens in `api/v1/__init__.py:13` — seven route modules registered under `/api/v1` with prefixes like `/auth`, `/tools`, `/reservations`.

Each route endpoint calls a service. Services contain the business logic — for example, `services/reservation.py:31` has the `create_reservation` method that validates dates, checks the tool exists and is active, prevents self-borrowing, then flushes to the DB. Services use SQLAlchemy async sessions from `db/session.py:79`, which is a FastAPI dependency that auto-commits on success and rolls back on error.

Our domain exceptions — NotFoundError, ConflictError, PermissionDeniedError — are caught by a single handler in `main.py:45` that maps them to HTTP status codes. So every error has a consistent JSON shape: `{detail, error_code, ...}`."

**Files to show on screen:**
- `src/app/main.py:28-43` — lifespan (startup/shutdown hooks)
- `src/app/main.py:45-77` — exception handler mapping
- `src/app/main.py:80-121` — `create_application()` factory
- `src/app/api/v1/__init__.py:1-21` — router aggregation
- `src/app/db/session.py:79-94` — `get_db()` dependency

---

### Q2: "How does authentication work?"

**Spoken answer (~45s):**

"Authentication is JWT-based with HS256. `core/security.py:34` creates access tokens — 60-minute expiry by default with `sub`, `type`, `iat`, `exp`, `jti`, `aud`, and `iss` claims. Refresh tokens at line 61 live 7 days. The `aud` and `iss` claims bind tokens to this service — even if another service shares the same secret key, it can't replay tokens here.

The `dependencies.py:25` function `get_current_user` is used as a FastAPI dependency on protected endpoints. It extracts the Bearer token, decodes it, validates the `type` must be `access`, looks up the user by UUID, and crucially — checks if the token was issued before the last password change at line 56. If someone changes their password, all existing tokens become invalid immediately.

For admin-only endpoints, `get_current_admin_user` at line 87 chains off `get_current_member` which chains off `get_current_user` — so it validates the token first, then checks `is_active`, then checks `is_admin`. Three layers of checks in a three-line dependency chain."

**Files to show on screen:**
- `src/app/core/security.py:34-58` — `create_access_token()`
- `src/app/core/security.py:61-82` — `create_refresh_token()`
- `src/app/core/security.py:85-106` — `decode_token()` with aud/iss validation
- `src/app/dependencies.py:25-62` — `get_current_user()` with password-change invalidation
- `src/app/dependencies.py:78-93` — `get_current_member()` and `get_current_admin_user()`

---

### Q3: "Explain the reservation state machine"

**Spoken answer (~50s):**

"The reservation has six states defined in `models/enums.py:36`: REQUESTED, APPROVED, PICKED_UP, RETURNED, plus DENIED and CANCELLED as terminals.

The normal flow at `services/reservation.py:188` — `approve()` checks that the caller is the tool owner and the reservation is in REQUESTED state. It also does a defense-in-depth overlap check before transitioning to APPROVED. Then `mark_picked_up()` at line 322 requires the borrower, APPROVED state, and won't allow pickup before the start date. `mark_returned()` at line 359 transitions PICKED_UP to RETURNED.

Rejection paths: `deny()` at line 233 only works from REQUESTED. `cancel()` at line 264 handles both REQUESTED and APPROVED — but with different rules per actor. A borrower can cancel REQUESTED or APPROVED. An owner can only cancel APPROVED — for REQUESTED they must use deny. The code enforces this at line 291 with a clear error message.

Every state transition creates a notification for the other party. Every action is timestamped in UTC. The cancellation audit at lines 297-300 records who cancelled and why."

**Files to show on screen:**
- `src/app/models/enums.py:36-42` — ReservationState enum
- `src/app/services/reservation.py:31-92` — `create_reservation()` with validation
- `src/app/services/reservation.py:188-231` — `approve()` with overlap check
- `src/app/services/reservation.py:264-320` — `cancel()` with per-actor rules
- `src/app/services/reservation.py:322-357` — `mark_picked_up()` with date guard

---

### Q4: "How do you prevent double-booking?"

**Spoken answer (~40s):**

"This is handled at the database level with a PostgreSQL GiST EXCLUDE constraint — the strongest possible guarantee. In `models/reservation.py:52-58`, the constraint says: for the same tool_id, no two rows can have overlapping date ranges where the state is REQUESTED, APPROVED, or PICKED_UP. The `tsrange(start_date, end_date, '[]')` uses inclusive bounds on both ends, so `Jan 1-3` and `Jan 3-5` are allowed — they touch but don't overlap.

This is race-condition-proof because PostgreSQL checks it at the row level during INSERT or UPDATE. Even if two borrowers click at the exact same millisecond, the second transaction gets a constraint violation. The service layer catches this `IntegrityError` at `services/reservation.py:69` and raises a user-friendly ConflictError with HTTP 409.

We also have an application-level overlap check at line 210 during approve — this is defense-in-depth. It provides a clearer error message and guards against any future code path that might bypass the constraint."

**Files to show on screen:**
- `src/app/models/reservation.py:36-58` — `__table_args__` with GiST EXCLUDE
- `src/app/services/reservation.py:67-73` — IntegrityError catch → ConflictError
- `src/app/services/reservation.py:199-216` — defense-in-depth overlap check on approve

---

### Q5: "How is your test suite structured?"

**Spoken answer (~40s):**

"We have 151 tests across 7 files, all in `src/app/tests/`. Tests run against a real PostgreSQL database — not SQLite, not mocks. `conftest.py` provides the `client` fixture: it overrides the database URL to a test database, creates all tables, then drops them after each test file. Every test gets a clean state.

`factories.py` provides factory functions — `create_user()`, `create_tool()`, `create_reservation()` — that insert real rows and return ORM objects. Tests never manually construct rows; they call factories.

Our heavy coverage is reservations with 44 tests: every state transition is tested, plus edge cases like trying to cancel a DENIED reservation, picking up before the start date, and the overlap rejection flow. Tools have 42 tests covering CRUD, photo upload limits, deactivation, and admin operations. Auth has 23 tests covering the full register → verify → login → refresh → logout cycle, plus password reset and invite flows.

The `get_current_user` dependency is bypassed in tests via a `test_auth_headers` fixture that creates real users and returns their Bearer tokens — so the full auth stack is exercised, not mocked."

**Files to show on screen:**
- `src/app/tests/conftest.py` — test fixtures (DB setup, client, auth headers)
- `src/app/tests/factories.py` — factory functions
- `src/app/tests/test_reservations.py` — 44 tests (state machine, edge cases)
- `src/app/tests/test_tools.py` — 42 tests (CRUD, photos, admin ops)

---

### Q6: "How do you manage the database schema?"

**Spoken answer (~35s):**

"We use Alembic for schema migrations, with four migration files under `alembic/versions/`. R1a created users, invite tokens, email verification tokens, and password reset tokens. R1b added tools, photos, and reservations — including that GiST EXCLUDE constraint. R1c added notifications and the admin audit log. R1d added CHECK constraints and cleaned up ENUM types.

The database runs in Docker — `docker-compose.yml` launches a PostgreSQL 15 container. The app connects via asyncpg. For local dev, we use MailHog to catch emails. The test database is created by an init script on first boot — so pytest always has a fresh database.

All enums are PostgreSQL-native — defined in `models/enums.py` and mapped via SQLAlchemy's `ENUM` type. This means the database itself enforces valid states, and `\d+` in psql shows human-readable enum values instead of opaque integers."

**Files to show on screen:**
- `alembic/versions/` — 4 migration files (R1a → R1d)
- `docker-compose.yml` — PostgreSQL 15 container
- `src/app/models/enums.py:1-89` — all PostgreSQL-native ENUMs

---

### Quick-Reference: Key Files Map

| File | What it does |
|------|-------------|
| `src/app/main.py:80` | App factory (`create_application`) |
| `src/app/main.py:45` | Exception → HTTP status mapping |
| `src/app/api/v1/__init__.py:13` | Router aggregation (7 modules) |
| `src/app/dependencies.py:25` | `get_current_user()` JWT validation |
| `src/app/core/security.py:34` | JWT access token creation |
| `src/app/db/session.py:79` | `get_db()` async session dependency |
| `src/app/config.py:10` | pydantic-settings from `.env` |
| `src/app/models/enums.py` | All PostgreSQL-native ENUMs |
| `src/app/models/reservation.py:52` | GiST EXCLUDE constraint |
| `src/app/services/reservation.py:31` | Reservation state machine |
| `src/app/services/scheduler.py:84` | Auto-cancel overdue pickups |
| `src/app/services/scheduler.py:129` | Auto-escalate overdue returns |
| `src/app/tests/conftest.py` | Test fixtures |
| `alembic/versions/` | Schema migrations |

---

### Q7: "Why does User have a DELETED status instead of just deleting the row?"

**Spoken answer (~35s):**

"It's a soft delete with PII anonymization — the row stays, the person is scrubbed. In `services/user.py:93`, `soft_delete()` does three things: calls `_anonymize_user()` which replaces email with `deleted+<uuid>@example.com`, clears the password hash, and sets the name to 'Deleted User'; then sets status to DELETED; then stamps `deleted_at`.

The reason we don't hard-delete: the user's `id` is a foreign key in 11 other tables — tools, reservations, reviews, messages, notifications, admin audit log, invite tokens, suspension records, and listing reports. Hard-deleting would either cascade-delete all that history or leave orphaned foreign keys. By keeping the row but scrubbing PII, we preserve referential integrity for past reservations, reviews, and the immutable admin audit log.

There's also a guard rail at line 100: you can't soft-delete if you have active reservations (REQUESTED/APPROVED/PICKED_UP). Return or cancel those first."

**Files to show on screen:**
- `src/app/services/user.py:15-28` — `_anonymize_user()` PII scrubbing
- `src/app/services/user.py:93-125` — `soft_delete()` with active-reservation guard
- `src/app/models/user.py:62-65` — `deleted_at` column
- `src/app/models/enums.py:10` — `DELETED = "DELETED"`

---

### Q8: "What is the listing_rules table? It has no relationships drawn."

**Spoken answer (~30s):**

"The `listing_rules` table was planned for US28 — 'Admin Manages Tool Categories.' The idea was that admins could add or remove categories from the allowed list, so members could only list tools in approved categories.

It was deprioritized to ICEBOX per the v5 requirement revision. Instead of a configurable admin-managed list, we use a static 5-category enum hardcoded in `models/enums.py:20-25`: HAND_TOOLS, POWER_TOOLS, GARDEN_TOOLS, CLEANING_TOOLS, OUTDOOR_GEAR. Every member sees the same dropdown — no admin can change it in R1.

It appears in the ER diagram as a forward-looking design note but has no model file, no API, and no implementation. The FK `updated_by_admin_id` exists in the diagram definition but the PlantUML relationship line was simply never drawn. If we implement it in R2, it would connect to users and link to the tools table's category enum."

**Files to show on screen:**
|- `src/app/models/enums.py:20-25` — static ToolCategory enum (the simplified replacement)
|- `backend/_local_drafts/Phasing_Plan_with_Roles.md:45` — US28 marked as Icebox

---

### Q9: "What is automatic rotation?"

**Spoken answer (~30s):**

"It's our two-token JWT system in `core/security.py`. When you log in, the server issues two tokens: an **access token** that lives 15 minutes and goes in every API request's `Authorization` header, and a **refresh token** that lives 7 days and is only used to get a new pair. When the access token expires, the frontend gets a 401 and automatically calls `POST /auth/refresh` with the refresh token. The server validates it, then issues a **brand new access token AND a brand new refresh token** — the old pair is discarded on the client. This is 'automatic rotation': each refresh produces fresh credentials, the user never sees it happening, and a stolen token has a limited window of usefulness."

**Files to show on screen:**
- `src/app/core/security.py:34-58` — `create_access_token()` (15-min expiry)
- `src/app/core/security.py:61-80` — `create_refresh_token()` (7-day expiry)
- `src/app/api/v1/auth.py:119-127` — `POST /auth/refresh` endpoint
- `src/app/services/auth.py:266-293` — `refresh()` rotation logic

---

### Q10: "What is PII security?"

**Spoken answer (~30s):**

"PII stands for **Personally Identifiable Information** — data that can identify a specific person. In our app, that's the user's email, full name, neighborhood, and profile photo.

When a member deletes their account, we don't hard-delete the row — that would break foreign keys in reservations, reviews, and the audit log. Instead, `services/user.py:140` calls `_anonymize_user()` which scrubs the PII: email becomes `deleted+<uuid>@example.com`, the password hash is cleared so no one can log in, and the full name becomes 'Deleted User'. The row stays, the person is gone.

There's also an active-reservation guard at line 100: you cannot delete if you have active borrows or tools currently out on loan. This prevents data integrity issues at the application level."

**Files to show on screen:**
- `src/app/services/user.py:15-28` — `_anonymize_user()` PII scrubbing
- `src/app/services/user.py:95-145` — `soft_delete()` with active-reservation guard
