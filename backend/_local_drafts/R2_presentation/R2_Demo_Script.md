# R2 Backend — 2-3 Minute Live Demo Script

## Code Walkthrough & DB Schema

**Speaker:** Ivan Wu, BE Lead

---

## Pre-Demo Setup (run once before presentation)

```bash
cd backend
docker compose down -v
docker compose up -d
docker compose ps   # wait for both db (healthy) and pgadmin (running)

# Seed the database
source venv/bin/activate
python scripts/init_db.py
SEED_PASSWORD=devpass123 python scripts/seed_dev.py

# Start backend
python run.py --port 8000
```

Open in browser:
- `http://localhost:8000/docs` — Swagger UI
- `http://localhost:5050` — pgAdmin
  - Login: `admin@example.com` / `devpass123`
  - Server is pre-configured — just click on it in the left panel

---

## Demo Flow (3 segments, ~1 min each)

---

## Segment 1: Show the Database (60 seconds)

### Step 1.1 — pgAdmin: Tables overview (20s)

Open pgAdmin at `http://localhost:5050`. Click on the "Toolsharing (Docker)" server → Databases → toolsharing → Schemas → public → Tables.

**Say:**
"This is our Postgres database. You can see all 13 tables: users, tools, photos, reservations, reviews, notifications, messages, categories, listing_reports, admin_audit_log, invite_tokens, and verification tokens. Each table represents a direct mapping from our ORM models: users (`models/user.py:24-124`), tools (`models/tool.py:20-91`), reservations (`models/reservation.py:29-151`), reviews (`models/review.py:24-74`), photos (`models/photo.py:16-39`), notifications (`models/notification.py:34-74`), messages (`models/message.py:22-57`), tool_categories (`models/category.py:16-48`), listing_reports (`models/listing_report.py:25-89`), admin_audit_log (`models/admin_audit_log.py:17-57`), invite_tokens (`models/invite.py:24-70`), email_verification_tokens (`models/email_verification.py:22-61`), and password_reset_tokens (`models/password_reset.py:22-61`)."

Scroll through the table list. Click on `reservations`.

### Step 1.2 — pgAdmin: Show the GiST constraint (20s)

Right-click `reservations` → Properties → Constraints.

**Say:**
"The reservations table has a GiST EXCLUDE constraint (`models/reservation.py:51-59`). This is the most important piece — it prevents two reservations from overlapping on the same tool at the database level. No application-layer race condition can bypass it."

Show the constraint: `EXCLUDE USING gist (tool_id WITH =, daterange(start_date, end_date, '[]') WITH &&)` — defined in `models/reservation.py:53-59`

### Step 1.3 — pgAdmin: Run a live query (20s)

Open the Query Tool. Run:

```sql
-- Show all active reservations for a specific tool
SELECT r.state, r.start_date, r.end_date, u.full_name AS borrower
FROM reservations r
JOIN users u ON r.borrower_id = u.id
WHERE r.state IN ('REQUESTED', 'APPROVED', 'PICKED_UP')
ORDER BY r.start_date;
```

Run:

```sql
-- Show admin audit log (most recent 5 actions)
SELECT action_type, target_type, reason, created_at
FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 5;
```

Run:

```sql
-- Show categories with count of active listings
SELECT c.name, COUNT(t.id) AS active_listings
FROM tool_categories c
LEFT JOIN tools t ON t.category = c.name AND t.is_active = true
GROUP BY c.name
ORDER BY c.name;
```

**If instructor asks:** "How do you handle overlapping dates?" → Show the GiST constraint again and explain.

**If instructor asks:** "What happens when a listing is reported?" → Show the `listing_reports` table, then the trigger logic in the code.

---

## Segment 2: Code Walkthrough (60 seconds)

### Step 2.1 — Show the ORM model (20s)

Open `backend/src/app/models/reservation.py` in VS Code or terminal.

**Say:**
"Here's the reservation ORM model (`models/reservation.py:29-151`). The GiST constraint is defined in `__table_args__` at `models/reservation.py:37-60` (specifically lines 51-59). Every relationship uses `lazy='selectin'` — no N+1 queries, no MissingGreenlet errors."

Scroll to show the constraint and the relationship to `tool` and `borrower`.

### Step 2.2 — Show the API route + Swagger (20s)

Open `http://localhost:8000/docs` in browser.

**Say:**
"This is the live Swagger UI. Every endpoint is documented with request and response schemas. Let me show you the reservation approve endpoint."

Click POST `/api/v1/reservations/{reservation_id}/approve` — handled by `api/v1/reservations.py`.

**Say:**
"It requires the tool owner's authorization. The request body is empty — you just click execute. The response shows the updated reservation with APPROVED status."

Scroll to show the full list of endpoints — reservations, tools, admin, categories, reports.

### Step 2.3 — Show service layer (20s)

Open `backend/src/app/services/reservation.py`, scroll to the `approve` method (`services/reservation.py:188-234`).

**Say:**
"The business logic lives in the service layer. Approve (`services/reservation.py:188-234`) checks that the reservation is REQUESTED (`_require_state` at line 197), verifies no overlapping dates (`_check_overlap` at line 210), transitions the state to APPROVED (line 218), fires a notification to the borrower (`NotificationService().create` at line 226), and returns the updated reservation. This pattern — check, transition, notify — is repeated across all 14 reservation endpoints."

---

## Segment 3: Quality & Tests (30 seconds)

### Step 3.1 — Run the test suite (15s)

```bash
cd backend
source venv/bin/activate
pytest src/app/tests/ -q
```

**Say:**
"337 tests pass with zero failures. Each user story has its own test file with scenarios that match the requirements document. 13 known gaps are marked as xfail — things like notification coverage that are documented but not yet implemented."

### Step 3.2 — Security highlights (10s)

**Say:**
"Every admin endpoint uses `get_current_admin_user` (`dependencies.py:101-107`). Password resets invalidate all tokens via `password_changed_at` (`models/user.py:58-61`) — both access tokens (checked in `dependencies.py:52-60`) and refresh tokens (checked in `services/auth.py:332-337`). Rate limiting on auth endpoints via `dependencies_rate_limit.py:55-96` — 50 requests per minute per IP."

### Step 3.3 — Frontend (5s)

```bash
cd frontend
npx tsc --noEmit
```

**Say:**
"TypeScript compiles clean across the entire frontend."

---

## Instructor Q&A Prep

| Question | Answer |
|----------|--------|
| "How do you prevent double booking?" | Show GiST EXCLUDE constraint in pgAdmin (`models/reservation.py:51-59`) |
| "Show me the tables" | pgAdmin → toolsharing → Schemas → Tables (all 13 models in `models/` directory) |
| "How does reporting work?" | Walk through `listing_reports` (`models/listing_report.py:25-89`) → admin resolves (`services/listing_report.py:102-236`) → auto-deactivate + auto-cancel reservations |
| "Where's the audit trail?" | Show admin_audit_log table (`models/admin_audit_log.py:17-57`) + query (recorded by `AdminService._audit()` at `services/admin.py:435-456`) |
| "How many endpoints?" | Count in Swagger: ~50+ across auth (`api/v1/auth.py`), tools (`api/v1/tools.py`), reservations (`api/v1/reservations.py`), reviews (`api/v1/reviews.py`), notifications (`api/v1/notifications.py`), admin (`api/v1/admin.py`), categories (`api/v1/categories.py`), reports (`api/v1/reports.py`), messages (`api/v1/messages.py`) |
| "How do you handle auth?" | JWT + refresh tokens (`core/security.py:34-82`), `password_changed_at` check (`dependencies.py:52-60` + `services/auth.py:332-337`), rate limiting (`core/rate_limit.py:20-70` via `dependencies_rate_limit.py:55-96`) |
| "How do you test?" | Show pytest output (`tests/conftest.py` for fixtures), organized by user story (`tests/acceptance/`) |
| "What's the most complex query?" | GiST EXCLUDE constraint (`models/reservation.py:51-59`) or the reservation overlap check (`_check_overlap` at `services/reservation.py:188-234`) |

---

## Timing Breakdown

| Segment | Content | Time |
|---------|---------|------|
| 1.1 | pgAdmin: tables overview | 20s |
| 1.2 | pgAdmin: GiST constraint | 20s |
| 1.3 | pgAdmin: live queries | 20s |
| 2.1 | ORM model + constraint | 20s |
| 2.2 | Swagger /docs | 20s |
| 2.3 | Service layer | 20s |
| 3.1 | Test suite | 15s |
| 3.2 | Security | 10s |
| 3.3 | Frontend compile | 5s |
| **Total** | | **~2 min 50s** |
