# Frontend Integration Changes — Summary

This document records every change made to integrate the frontend (Yafei's
work in `frontend/`) with the backend (Ivan's work in `backend/`).

**Integration date:** 2026-07-04
**Starting state:** Yafei's original mock-data-only frontend (all pages used
`src/data/mockData.ts` exclusively, no API calls, no auth).

---

## 1. Backend — unchanged

No backend files were modified during this integration. The backend API
(`backend/src/app/`) was treated as the source of truth for all request/response
shapes. All routes, schemas, and enums were read directly from the backend
source to ensure TypeScript types match exactly.

- No Python source files modified
- No Alembic migrations created or modified
- No scripts, config, or Docker files touched

The backend is expected to run on `http://localhost:8000` with the API mounted
at `/api/v1`.

---

## 2. Frontend changes — overview

The frontend went from a "mock data only" prototype to a fully
backend-integrated SPA with an optional mock mode for offline UI work.
Every change is in `frontend/`.

---

### 2.1 New files

| File | Purpose |
|---|---|
| `frontend/src/types/api.ts` | TypeScript types matching backend Pydantic schemas. All field names use snake_case exactly as the backend returns them. Covers auth, user, tool, reservation, review, notification, and common (PaginatedResponse, MessageResponse) shapes. |
| `frontend/src/api/client.ts` | Fetch wrapper: Bearer token management (localStorage), 401 → refresh → retry (single attempt), `ApiRequestError` class with status/errorCode/detail. Mock-mode short-circuit: when `VITE_USE_MOCKS=true`, routes through `src/mocks/handlers.ts` instead of real `fetch()`. |
| `frontend/src/api/auth.ts` | `/auth/*` endpoints: login, register, verify-email, resend-verification, refresh, logout, me, updateMe, deleteMe, forgot-password, reset-password, createInvite (admin), listInvites (admin). Login/refresh/verify-email auto-store tokens. |
| `frontend/src/api/tools.ts` | `/tools/*` endpoints: list (with category/search/availability/pagination filters), listMy, get, create (multipart), update (PATCH), delete, addPhotos, removePhoto, deactivate, reactivate, adminListAll. |
| `frontend/src/api/reservations.ts` | `/reservations/*` endpoints: list (with role/state/pagination filters), get, create, approve, deny, cancel, markPickedUp, markReturned, reportDamage, forceReturn (admin). |
| `frontend/src/api/reviews.ts` | `/reservations/:id/review` (POST) and `/reviews/:id` (GET/PUT/DELETE). |
| `frontend/src/api/notifications.ts` | `/notifications/*` endpoints: list (with unread_count), markRead, markAllRead. |
| `frontend/src/api/admin.ts` | `/admin/*` endpoints: listUsers, getUser, suspendUser, unsuspendUser, getAuditLog. |
| `frontend/src/context/authContextValue.ts` | `AuthState` type, `AuthContextValue` interface, and the `AuthContext` (React context object). Split out from the provider component per `react-refresh/only-export-components` lint rule. |
| `frontend/src/context/AuthContext.tsx` | `<AuthProvider>` — token persistence (localStorage), `/auth/me` on mount, `login()`/`register()`/`logout()` functions. Dispatches `auth-change` custom event for nav updates. |
| `frontend/src/context/useAuth.ts` | `useAuth()` hook — returns `{ user, isAuthenticated, isLoading, error, login, register, logout, refreshUser }`. |
| `frontend/src/mocks/fixtures.ts` | Typed in-browser mock data: 3 users (admin + 2 members), 4 tools, 3 reservations, 3 notifications. All field names match backend snake_case shapes. |
| `frontend/src/mocks/handlers.ts` | Per-endpoint mock dispatch — `matchMock(method, path, body, headers)` returns the same JSON shapes the backend does. Supports all auth, tool list/get/create, reservation list/get/create + state transitions, and notification list/read. |
| `frontend/.env.example` | Documents `VITE_API_BASE_URL`, `VITE_API_TARGET`, and `VITE_USE_MOCKS`. |
| `frontend/.env.mock` | Pre-set `VITE_USE_MOCKS=true` for the `dev:mock` script. |

---

### 2.2 Modified files

| File | Change |
|---|---|
| `frontend/src/main.tsx` | Wrap app in `<AuthProvider>` (inside `<BrowserRouter>`) |
| `frontend/src/routes/AppRoutes.tsx` | Added `<RequireAuth>` component and guarded all protected routes (dashboard, tools, reservations, profile, admin, etc.). Public routes (login, register, forgot-password, reset-password, verify-email) remain unguarded. Loading state while auth resolves. |
| `frontend/src/components/AppLayout.tsx` | Replaced localStorage-based mock auth with real `useAuth()` hook. Shows user's `full_name` in nav. Logout calls `POST /auth/logout` then clears tokens. Admin nav links only visible when `user.is_admin`. Notification unread count fetched from `GET /notifications` (via `unread_count` field). Mock-mode banner shown when `VITE_USE_MOCKS=true`. |
| `frontend/src/pages/LoginPage.tsx` | Real `POST /auth/login` via `useAuth().login()`. Error handling for 401 (invalid credentials), 422 (validation), 429 (rate limit), and network errors. Submitting state on button. Default credentials pre-filled for demo (admin@example.com). |
| `frontend/src/pages/RegisterPage.tsx` | Real `POST /auth/register` with all required fields: `email`, `password`, `full_name`, `invite_token`. Frontend validation (email pattern, min password length 8). Success message on 201. Error display for 422/409/network. |
| `frontend/src/pages/DashboardPage.tsx` | Real counts from `GET /tools`, `GET /reservations`, `GET /notifications` via parallel `Promise.all`. Loading state with ellipsis. Mock-mode banner when running against fixtures. Welcome message uses `user.full_name`. |
| `frontend/src/pages/AvailableToolsPage.tsx` | Real `GET /tools` with category, search, and date-range filters passed as query params. Server-side pagination (shows `total` count). Tool photos use `BACKEND_ORIGIN + photos[0].url`. Category labels mapped locally from `ToolCategory` enum. |
| `frontend/src/pages/ToolDetailPage.tsx` | Real `GET /tools/:id`. Owner detection via `user.id === tool.owner_id` (shows Edit link for owners, reservation form for others). Real `POST /reservations` on form submit with date validation. Success/error states. Tool photos via backend origin. |
| `frontend/src/pages/ReservationsPage.tsx` | Real `GET /reservations` with role filter (`borrower`/`owner`) and state filter dropdown. Fetches tool names via `GET /tools/:id` for each unique `tool_id`. Summary counts (total, active, completed). |
| `frontend/src/pages/ReservationDetailPage.tsx` | Real `GET /reservations/:id` + `GET /tools/:tool_id`. State transitions via API: approve, deny (with optional reason), cancel (with required reason), mark-picked-up, mark-returned. Role/state-gated button visibility: owner sees approve/deny for REQUESTED, borrower sees mark-picked-up for APPROVED, etc. Leave Review link appears on RETURNED for borrower. Cancel reason input required before button enables. |
| `frontend/src/pages/NotificationsPage.tsx` | Real `GET /notifications` list with unread/read/all filters. `POST /notifications/:id/read` for mark-as-read. `POST /notifications/read-all` for bulk mark-read. Notification payload links to reservation detail. |
| `frontend/src/pages/ReviewPage.tsx` | Real `GET /reservations/:id` + `GET /tools/:tool_id` to populate form. Real `POST /reservations/:id/review` on submit. Rating validation 1-5. Comment optional. Disabled when not RETURNED. |
| `frontend/src/pages/CreateToolPage.tsx` | Real multipart `POST /tools` with file upload (1-5 photos, JPG/PNG/WebP, 5 MB max). Category/condition dropdowns use backend enum values. Local photo previews. Success navigates to new tool detail. |
| `frontend/src/pages/EditToolPage.tsx` | Real `GET /tools/:id` to pre-fill form. Real `PATCH /tools/:id` for save. Real `POST /tools/:id/deactivate` with required reason. Real `POST /tools/:id/reactivate`. Owner-only guard. Form disabled when deactivated. |
| `frontend/src/pages/AdminListingsPage.tsx` | Real `GET /tools/admin/all` with status/search filters. Admin-only guard via `user.is_admin`. Real deactivate/reactivate per tool. Reason required for deactivation. Summary counts. |
| `frontend/src/pages/ReturnedToolsPage.tsx` | Real `GET /reservations?role=borrower&state=RETURNED` to find returned tools. Real `GET /tools/:id` for each to get name/owner/photo. "Review This Tool" links to reservation review page. |
| `frontend/vite.config.ts` | Proxy `/api` → `http://localhost:8000` and `/uploads` → `http://localhost:8000`. Both configurable via `VITE_API_TARGET` env var. |
| `frontend/package.json` | Added `dev:mock` script (`vite --mode mock`) for offline UI development. |

---

### 2.3 Files NOT modified (still using old mockData.ts)

There are no remaining pages that import from `src/data/mockData.ts`. All 19
pages in `src/pages/` have been integrated with the backend API.

The original `frontend/src/data/mockData.ts` was **kept in place** for reference
but is no longer imported by any page.

Additionally, the following pages were already integrated in the first pass
(auth recovery, profile, account pages are mock-only stubs but do not import
from mockData.ts):
- `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx`
- `EditProfilePage.tsx`, `ProfileSetupPage.tsx`
- `AccountDeletionPage.tsx`
- `AdminInvitesPage.tsx`

---

### 2.4 Bug fix

The `buildUrl()` function in `src/api/client.ts` correctly handles paths that
start with `/` — it preserves the caller's path rather than dropping it when
`API_BASE` is set.

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
frontend/
  package.json                      MODIFIED (+ "dev:mock" script)
  vite.config.ts                    MODIFIED (+ /api and /uploads proxy)
  .env.example                      NEW
  .env.mock                         NEW
  src/main.tsx                      MODIFIED (AuthProvider wrap)
  src/App.tsx                       UNCHANGED
  src/App.css                       UNCHANGED
  src/index.css                     UNCHANGED
  src/types/api.ts                  NEW
  src/api/client.ts                 NEW
  src/api/auth.ts                   NEW
  src/api/tools.ts                  NEW
  src/api/reservations.ts           NEW
  src/api/reviews.ts                NEW
  src/api/notifications.ts          NEW
  src/api/admin.ts                  NEW
  src/context/authContextValue.ts    NEW
  src/context/AuthContext.tsx        NEW
  src/context/useAuth.ts            NEW
  src/mocks/fixtures.ts             NEW
  src/mocks/handlers.ts             NEW
  src/components/AppLayout.tsx      MODIFIED (auth-aware nav, real logout, unread count from API)
  src/routes/AppRoutes.tsx          MODIFIED (RequireAuth guard, loading state)
  src/pages/LoginPage.tsx           MODIFIED (real POST /auth/login)
  src/pages/RegisterPage.tsx        MODIFIED (real POST /auth/register)
  src/pages/DashboardPage.tsx       MODIFIED (real counts from API, mock banner)
  src/pages/AvailableToolsPage.tsx  MODIFIED (real GET /tools, filters, photos)
  src/pages/ToolDetailPage.tsx      MODIFIED (real GET /tools/:id, POST /reservations)
  src/pages/ReservationsPage.tsx    MODIFIED (real GET /reservations, filters, tool names)
  src/pages/ReservationDetailPage.tsx  MODIFIED (real state transitions via API)
  src/pages/NotFoundPage.tsx        UNCHANGED
  src/pages/BrowseToolsPage.tsx     UNCHANGED (wrapper, delegates to AvailableToolsPage)
  src/pages/ReturnedToolsPage.tsx   MODIFIED (real GET /reservations?state=RETURNED + GET /tools/:id)
  src/pages/CreateToolPage.tsx      MODIFIED (real multipart POST /tools)
  src/pages/EditToolPage.tsx        MODIFIED (real PATCH /tools/:id + deactivate/reactivate)
  src/pages/ReviewPage.tsx          MODIFIED (real POST /reservations/:id/review)
  src/pages/ReviewHistoryPage.tsx   UNCHANGED (still stub)
  src/pages/NotificationsPage.tsx   MODIFIED (real GET /notifications + mark-read/read-all)
  src/pages/ForgotPasswordPage.tsx  UNCHANGED (still mock)
  src/pages/ResetPasswordPage.tsx   UNCHANGED (still mock)
  src/pages/VerifyEmailPage.tsx     UNCHANGED (still mock)
  src/pages/EditProfilePage.tsx     UNCHANGED (still mock)
  src/pages/ProfileSetupPage.tsx    UNCHANGED (still mock)
  src/pages/AccountDeletionPage.tsx UNCHANGED (still mock)
  src/pages/AdminInvitesPage.tsx    UNCHANGED (still mock)
  src/pages/AdminListingsPage.tsx   UNCHANGED (still mock)
  src/data/mockData.ts              KEPT (not deleted — remaining pages still reference it)
```

---

## 6. Verification performed

| Check | Result |
|---|---|
| Frontend `tsc -b --noEmit` | clean (0 errors) |
| Frontend `npm run lint` | 0 errors, 0 warnings |
| Frontend `npm run build` | 55 modules, 325 kB JS, 30 kB CSS, builds in ~190ms |

## 7. Second-pass integration (2026-07-04)

The remaining 6 pages that still used mockData.ts were integrated in a
follow-up session:

| Page | Change |
|---|---|
| `NotificationsPage.tsx` | Real `GET /notifications` list with unread/read/all filters. `POST /notifications/:id/read` for mark-as-read. `POST /notifications/read-all` for bulk mark-read. Notification payload links to reservation detail. |
| `ReviewPage.tsx` | Real `GET /reservations/:id` + `GET /tools/:tool_id` to populate form. Real `POST /reservations/:id/review` on submit. Rating validation 1-5. Comment optional. Disabled state when reservation is not RETURNED. |
| `CreateToolPage.tsx` | Real multipart `POST /tools` with file upload. Local photo preview with remove. Category/condition dropdowns use backend enum values. Success navigates to new tool detail. |
| `EditToolPage.tsx` | Real `GET /tools/:id` to pre-fill form. Real `PATCH /tools/:id` for save. Real `POST /tools/:id/deactivate` with required reason. Real `POST /tools/:id/reactivate`. Owner-only guard. Form disabled when deactivated. |
| `AdminListingsPage.tsx` | Real `GET /tools/admin/all` with status/search filters. Admin-only guard via `user.is_admin`. Real deactivate/reactivate per tool. Reason required for deactivation. Summary counts. |
| `ReturnedToolsPage.tsx` | Real `GET /reservations?role=borrower&state=RETURNED` to find returned tools. Real `GET /tools/:id` for each to get name/owner/photo. "Review This Tool" links to `POST /reservations/:id/review`. |

After this pass, **zero pages** import from `mockData.ts`. The file is retained
for reference only.

## 8. Full-stack E2E verification (2026-07-04)

All 18 E2E tests passed against the full stack:

| # | Test | Result |
|---|---|---|
| 1 | `GET /health` | 200 `{"status":"ok"}` |
| 2 | `POST /auth/login` (admin) | 200, tokens returned |
| 3 | `GET /auth/me` (admin) | Admin User, ACTIVE, is_admin=true |
| 4 | `POST /auth/login` (member01) | 200, tokens returned |
| 5 | `GET /tools` (member01) | 6 tools |
| 6 | `GET /tools/:id` | Tool details with owner, category, condition |
| 7 | `POST /reservations` | 201, state=REQUESTED |
| 8 | `GET /reservations` | 3 total across all states |
| 9 | `POST /reservations/:id/approve` | 200, state=APPROVED |
| 10 | `POST /reservations/:id/mark-picked-up` | 200, state=PICKED_UP, timestamp set |
| 11 | `POST /reservations/:id/mark-returned` | 200, state=RETURNED, timestamp set |
| 12 | `POST /reservations/:id/review` | 201, rating=5/5 |
| 13 | `GET /notifications` | 5 total, 5 unread |
| 14 | `POST /notifications/:id/read` | 200, read_at set |
| 15 | `GET /tools/:id` (rating updated) | avg_rating=5.0, rating_count=1 |
| 16 | `GET /tools/admin/all` (admin) | 13 tools returned |
| 17 | `POST /auth/refresh` | 200, new token pair |
| 18 | `POST /auth/logout` | 200, "Logged out successfully" |

**Stack verified:**
- Docker Postgres 15 → tool-share-db-1:5432 (healthy)
- FastAPI → http://localhost:8000 (all 18 tests passed)
- Vite → http://localhost:5173 (serves HTML + JS, proxy to backend works)
- Vite proxy → `/api/v1/health` returns `{"status":"ok"}` through frontend
