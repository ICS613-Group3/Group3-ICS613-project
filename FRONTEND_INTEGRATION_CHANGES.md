# Frontend Integration Changes — Summary

This document records every change made to integrate the frontend (Yafei's
work in `frontend/`) with the backend (Ivan's work in `backend/`). It also
notes the one new file added to the backend directory. Nothing else in the
backend was modified.

---

## 1. Backend changes (minimal)

### New file: `backend/.env`

This file is **gitignored** and is required only for local development.
It is a copy of `backend/.env.example` with one extra line:

```dotenv
ENVIRONMENT=development
```

The `ENVIRONMENT=development` flag tells the backend's `Settings` class
to accept the placeholder `SECRET_KEY` shipped in `.env.example` for local
hacking. Without it, the backend refuses to start because the placeholder
key is rejected in production mode.

In production, the operator generates a real key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

and sets `SECRET_KEY=<that-value>` in their own `.env`, with
`ENVIRONMENT=production` (the default).

### What was NOT changed in the backend

- No Python source files in `backend/src/app/` were modified
- No Alembic migrations were created or modified
- No scripts in `backend/scripts/` were modified
- `backend/pyproject.toml`, `requirements.txt`, `Dockerfile`,
  `docker-compose.yml` — untouched
- `backend/Backend_Setup.md`, `README.md` — untouched
- `backend/_local_drafts/` — untouched

You can verify with:

```bash
cd Group3-ICS613
git diff backend/        # should be empty
git status backend/      # should only show the new untracked .env
```

---

## 2. Frontend changes (substantial)

The frontend went from a "mock data only" prototype to a fully
backend-integrated SPA with an optional mock mode for offline UI work.
Every change is in `frontend/`.

### 2.1 New files

| File | Purpose |
|---|---|
| `frontend/src/api/client.ts` | Fetch wrapper with Bearer auth, 401 → refresh → retry, `ApiRequestError` class |
| `frontend/src/api/auth.ts` | `/auth/*` endpoints (login, register, logout, me, refresh, etc.) |
| `frontend/src/api/tools.ts` | `/tools/*` endpoints (list, get, create, update, delete, deactivate, reactivate, photos) |
| `frontend/src/api/reservations.ts` | `/reservations/*` endpoints (CRUD + state transitions) |
| `frontend/src/api/reviews.ts` | `/reservations/:id/review` and `/reviews/:id` |
| `frontend/src/api/notifications.ts` | `/notifications/*` endpoints |
| `frontend/src/api/admin.ts` | `/admin/*` endpoints (audit log, user management) |
| `frontend/src/types/api.ts` | TypeScript types matching backend Pydantic schemas (snake_case) |
| `frontend/src/context/authContextValue.ts` | Auth context instance + `AuthState` type (split out for `react-refresh` rule) |
| `frontend/src/context/AuthContext.tsx` | `<AuthProvider>` — token persistence, `/auth/me`, login/logout |
| `frontend/src/context/useAuth.ts` | `useAuth()` hook |
| `frontend/src/mocks/fixtures.ts` | Typed in-browser mock data (3 users, 4 tools, 4 reservations, 3 notifications) |
| `frontend/src/mocks/handlers.ts` | Per-endpoint mock dispatch — returns the same JSON shapes the backend does |
| `frontend/.env.example` | Documents `VITE_API_BASE_URL` and `VITE_USE_MOCKS` |
| `frontend/.env.mock` | Pre-set `VITE_USE_MOCKS=true` for the `dev:mock` script |

### 2.2 Modified files

| File | Change |
|---|---|
| `frontend/src/main.tsx` | Wrap app in `<AuthProvider>` |
| `frontend/src/routes/AppRoutes.tsx` | Add `<RequireAuth>` around all non-public pages (dashboard, tools, reservations) |
| `frontend/src/components/AppLayout.tsx` | Show real logged-in user + Logout button (replaces static Login/Register links when authenticated) |
| `frontend/src/pages/LoginPage.tsx` | Real `POST /auth/login` via the new `authApi.login()`. Error handling for 401, 422, 429 |
| `frontend/src/pages/RegisterPage.tsx` | Real `POST /auth/register` with all required fields (email, password, full_name, invite_token) |
| `frontend/src/pages/BrowseToolsPage.tsx` | Real `GET /tools` with category, search, and date-range filters. Pagination metadata from `PaginatedResponse` |
| `frontend/src/pages/ToolDetailPage.tsx` | Real `GET /tools/:id`. Owner detection, `POST /reservations` to create a request |
| `frontend/src/pages/ReservationsPage.tsx` | Real `GET /reservations` with role filter (borrower/owner). Status badges for all 6 states |
| `frontend/src/pages/ReservationDetailPage.tsx` | Real `GET /reservations/:id` + state transitions (approve, deny, cancel, mark-picked-up, mark-returned) with role/state-gated button visibility |
| `frontend/src/pages/DashboardPage.tsx` | Real counts from `/tools`, `/reservations`, `/notifications` (parallel `Promise.all` for speed). "Mock mode" banner when running against fixtures |
| `frontend/vite.config.ts` | Proxy `/api` and `/uploads` to `http://localhost:8000` (configurable via `VITE_API_TARGET` env var) |
| `frontend/package.json` | Added `dev:mock` script (`vite --mode mock`) |

### 2.3 Removed files

| File | Why |
|---|---|
| `frontend/src/data/mockData.ts` | Replaced by the typed `src/mocks/fixtures.ts` + `src/mocks/handlers.ts` pair, which use the same TypeScript types as the real API. The old file used incompatible field names (camelCase + invented fields) and would not survive any backend schema change. |

### 2.4 Bug fix included in the integration

While testing mock mode I caught a latent bug in `buildUrl()` in
`src/api/client.ts`. When the caller passed a path that started with `/`
(which all our paths do), the original implementation returned just
`API_BASE` and dropped the path. The earlier real-backend tests worked
only because the Vite dev proxy is configured at the `/api` prefix and
forwards the leftover path to the backend. The mock branch exposed it
because it routes by exact path string. `buildUrl()` now correctly
preserves the caller's path.

---

## 3. How the integration works

```
Browser (http://localhost:5173)
  → Vite dev server
  → /api/* proxy (configured in vite.config.ts)
  → FastAPI (http://localhost:8000)
  → asyncpg
  → Postgres (Docker: tool-share-db-1, port 5432)
```

When `VITE_USE_MOCKS=true`, the request layer in `src/api/client.ts`
short-circuits the network and returns canned data from
`src/mocks/handlers.ts`. The `fetch()` call is never made, so the rest of
the UI code is identical in both modes.

---

## 4. Two ways to run the frontend

| Mode | Command | Backend required? | Use case |
|---|---|---|---|
| Real backend | `npm run dev` | Yes (port 8000) | E2E testing, demos, integration with backend changes |
| Mock mode | `npm run dev:mock` | No | UI work without setting up Postgres/Docker, demos without live data |

The `dev:mock` script uses `--mode mock` which causes Vite to load
`frontend/.env.mock` (containing `VITE_USE_MOCKS=true`).

---

## 5. Files affected — at a glance

```
backend/
  .env                              NEW (gitignored, local-only)

frontend/
  package.json                      MODIFIED (+ "dev:mock" script)
  vite.config.ts                    MODIFIED (+ /api proxy)
  .env.example                      NEW
  .env.mock                         NEW
  src/main.tsx                      MODIFIED (AuthProvider wrap)
  src/App.tsx                       UNCHANGED
  src/api/                          NEW (7 files: client + 6 domains)
  src/types/api.ts                  NEW
  src/context/                      NEW (3 files: AuthContext, authContextValue, useAuth)
  src/mocks/                        NEW (2 files: fixtures, handlers)
  src/components/AppLayout.tsx      MODIFIED (auth-aware nav + logout)
  src/routes/AppRoutes.tsx          MODIFIED (RequireAuth guard)
  src/pages/LoginPage.tsx           MODIFIED (real /auth/login)
  src/pages/RegisterPage.tsx        MODIFIED (real /auth/register)
  src/pages/DashboardPage.tsx       MODIFIED (real counts, mock banner)
  src/pages/BrowseToolsPage.tsx     MODIFIED (real /tools, filters)
  src/pages/ToolDetailPage.tsx      MODIFIED (real /tools/:id, /reservations POST)
  src/pages/ReservationsPage.tsx    MODIFIED (real /reservations)
  src/pages/ReservationDetailPage.tsx  MODIFIED (real /reservations/:id, state transitions)
  src/pages/NotFoundPage.tsx        UNCHANGED
  src/data/mockData.ts              REMOVED (replaced by src/mocks/*)
```

---

## 6. Verification performed

| Check | Result |
|---|---|
| Frontend `tsc -b --force` | clean |
| Frontend `npm run lint` | 0 errors, 0 warnings |
| Frontend `npm run build` | 41 modules, 271 kB JS, builds in <200ms |
| Backend `pytest src/app/tests/` | 129 passed |
| `GET /api/v1/health` (via Vite proxy) | 200, `{"status":"ok"}` |
| Login (member01) via proxy | 200, JWT pair returned |
| `/auth/me` | returns Demo Owner, status ACTIVE |
| `/tools` | returns 12 seeded tools |
| `/tools?category=POWER_TOOLS` | returns 2 tools |
| `POST /reservations` (REQUESTED) | 201, id returned |
| `POST /reservations/:id/approve` | 200, state=APPROVED |
| `POST /reservations/:id/mark-picked-up` | 200, state=PICKED_UP, timestamp set |
| `POST /reservations/:id/mark-returned` | 200, state=RETURNED, timestamp set |
| `POST /reservations/:id/review` (rating=5) | 201 |
| Tool rating recomputed | avg_rating=5.0, rating_count=1 |
| `/notifications` | returns unread notifications |
| `POST /notifications/:id/read` | 200, read_at set |
| Unauthenticated `/tools` | 401 |
| Mock mode (browser) | all 4 tools render, login works, no console errors |
| Real backend mode (browser) | dashboard shows real counts, 12 tools load, 3 reservations load, no console errors |

---

## 7. What was deliberately NOT added

To keep the change set focused on the existing frontend pages, I did not
add any new user-story functionality:

- No admin UI (admin endpoints wired in `src/api/admin.ts` but no page)
- No forgot-password or reset-password page
- No verify-email page
- No profile-edit or profile-setup page
- No tool create/edit page
- No damage-report form (button on ReservationDetailPage calls the API,
  but the multi-field form is not built)
- No review form (endpoint wired in `src/api/reviews.ts` but no page)
- No notification list page (unread count shown on Dashboard only)

Adding those would be net-new work; the integration is the foundation
they'll plug into.
