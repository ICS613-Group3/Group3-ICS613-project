# R1 Retrospective & Defect Triage

**Date:** Thu 7/9 — Updated for R1 closure (current code: 187 tests, ~30 pages)
**Team:** Group 3 — ICS 613
**Context:** Internal discussion of what worked, what broke, and what must be fixed before R2.

---

## 1. What Worked (R1 Accomplishments)

### Backend (Ivan)
- All 46 endpoints implemented across 7 routers: Auth (13), Tools (11), Reservations (10), Reviews (5), Notifications (2), Admin (4), Health (1)
- **187 tests** across unit and acceptance suites — full coverage of happy paths, permissions, edge cases, audit logging, and notifications
- Authentication: JWT access/refresh token rotation, rate limiting on auth endpoints (configurable, defaults at 50/min)
- Tool lifecycle: browse with category/search/availability filters, photo upload (1–5, magic-byte validated, max 5 MB), deactivate/reactivate with auto-cancel of pending reservations
- Reservation lifecycle: request → approve/deny → picked-up → returned, double-booking prevention via GiST EXCLUDE constraint, damage reporting with 7-day window, admin force-return
- Reviews: per-reservation (one per party), edit/delete within 24-hour window, `GET /users/me/reviews` with `role=received|given`
- Notifications: auto-triggered on every state transition, unread-count badge support
- Admin: tool deactivate/reactivate across all owners, **member list + search/filter** (`GET /admin/users`), **member suspend/reactivate/delete**, audit log with action/target filters, invite CRUD *(member list was a P0 fix during Week 7)*
- Background scheduler: auto-cancel un-picked-up reservations after grace period, overdue escalation, token cleanup
- Email integration: MailHog-compatible SMTP for dev, async email sending (invite, verification, password reset)
- **QA acceptance tests**: US13, US19, US20, US30, US31 — automated end-to-end
- **Post-R1 bug fixes integrated**:
  - Damage reports properly attributed to the borrower (not the owner)
  - Duplicate damage reports blocked with ConflictError
  - Damage-rating integration (damage reduces borrower trust score)
  - Suspended members can log in and access read-only pages
  - 1-day rentals (start_date == end_date) now accepted
  - Admin reactivation endpoint accepts and records a custom reason
  - Account deletion: preserves display name, checks owner obligations (tools out on loan)
  - Suspended users can delete their account
  - Notification bodies include tool name and party display names
  - Profile validation: rejects blank/whitespace-only display names
  - ReservationResponse/ReviewResponse include `tool_name`, `borrower_name`, `owner_name`, `reviewer_name`, `reviewee_name`
  - VerifyTokenError mapped to 400 instead of 500

### Frontend (Yafei)
- **30 pages scaffolded and integrated** (was 28 at initial demo): all auth pages, tool browse/detail/create/edit, reservations/detail, reviews/history, profile, notifications, **3 admin pages + AdminMembersPage**
- Admin member management page at `/admin/members` with search, status filter, suspend/reactivate/delete actions — addresses D01/D02
- **All pages now call real backend API** — mock data fully replaced (commit `10d9537`)
- Email validation: regex pattern (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) on both LoginPage and RegisterPage — rejects `rion@e`
- API client layer with `adminApi`, `reviewsApi`, `authApi`, `toolsApi`, `reservationsApi`, `notificationsApi`
- `AuthContext` with token storage and 401 redirect
- `RequireAuth` guard wrapper for authenticated routes
- Clean component layout (AppLayout with nav, dropdowns, responsive shell)

### DevOps (Nick)
- Docker compose for PostgreSQL + MailHog
- Postgres GiST EXCLUDE constraint in migration
- Seed data script for demo users

---

## 2. Defect Status — R1 Post-Fix Review

### ✅ Resolved During R1

| # | Item | Type | Resolution |
|---|------|------|------------|
| D01 | No admin member management page | Missing feature | **Resolved.** `AdminMembersPage.tsx` at `/admin/members` with search, status filter, suspend/reactivate/delete actions. |
| D02 | No `GET /admin/users` endpoint | Missing endpoint | **Resolved.** Endpoint with `search` (ILIKE name/email), `status` filter, pagination. Includes `GET /admin/users/{id}` for single user detail. |
| D04 | Frontend still on mock data | Integration | **Resolved.** All pages converted from mock to real API in commit `10d9537`. |
| D05 | Email validation accepts `rion@e` | Bug | **Resolved.** Regex pattern `^[^\s@]+@[^\s@]+\.[^\s@]+$` added to both LoginPage and RegisterPage (JS + HTML `pattern` attribute). |
| D09 | `R1_API_INTEGRATION_CONTRACT.md` was stale | Docs | **Resolved** (7/4). |

### 🟡 High — should fix before R2

| # | Item | Type | Owner | Notes |
|---|------|------|-------|-------|
| D06 | **Mock→Backend field gaps** | Mapping | BE + FE | `notesForBorrowers`, `availability`, `latestReturnTime` have no backend equivalent. Decision: **drop for R1/R2** — fields removed from FE or handled as N/A. |
| D13 | **No admin audit log view page** | Missing page | FE | Backend `GET /admin/audit-log` endpoint exists with action/actor filters and pagination. Frontend `adminApi.getAuditLog()` exists. CSS classes `.admin-audit-log-card` exist. **But there is no dedicated page, no route in AppRoutes, and no nav link** — admins cannot view the audit trail. |

### 🟢 Medium — should fix before R2

| # | Item | Type | Owner | Notes |
|---|------|------|-------|-------|
| D07 | **Rate limit defaults too generous** | Config | BE | Defaults still at 50/min per IP. Production-tight limits should be 5–10/min. Configurable via env vars — just need to set appropriate defaults or document recommended values. |
| D08 | **No admin reservation overview** | Missing feature | FE | US34 (Admin Views All Reservations) is in R2 but has no frontend page. Backend `GET /reservations` supports all query params. Small lift: reuse ReservationsPage with admin context. |

### 🔵 Low — nice-to-have / deferred

| # | Item | Type | Owner | Notes |
|---|------|------|-------|-------|
| D10 | Registration flow complexity | UX | Team | Invite token + email verification required before login. Team agreed to skip live registration in R1 demo, use seeded accounts. R2 may revisit. |
| D11 | No tool-condition enum mapping utility | DX | FE | Frontend displays "Like New" but backend expects `LIKE_NEW`. Must map on submit. Could add a shared helper. |
| D12 | Photo URL prefix convention | Docs | BE | `photos[n].url` already includes `/uploads/`. Frontend must NOT double-append. Documented in contract but easy to get wrong. |

---

## 2b. New Defect: D13 — Admin Audit Log View Page (Missing Frontend)

### Background
The backend fully supports audit logging: every admin action (suspend, reactivate, delete, invite, deactivate tool, force-return) is recorded in the `admin_audit_log` table. The `GET /admin/audit-log` endpoint supports filtering by `action`, `actor_id`, and pagination. The frontend API client (`adminApi.getAuditLog()`) is ready. Even CSS classes (`.admin-audit-log-card`) exist in `App.css`.

**What's missing:**
- No `AdminAuditLogPage.tsx` component
- No route (`/admin/audit-log` or similar) in `AppRoutes.tsx`
- No nav link in the admin dropdown in `AppLayout.tsx`

Without this page, admins cannot review who did what in the system — a basic governance requirement.

### Scope
- **Frontend — new page:** `AdminAuditLogPage.tsx` at `/admin/audit-log`
  - Table with columns: timestamp, action, actor, target type, target ID, details
  - Filter by action type dropdown (suspend, reactivate, delete, invite, etc.)
  - Filter by actor (optional, could be added later)
  - Pagination
  - Backend endpoint already wired via `adminApi.getAuditLog()`
- **Navigation:** Add `Admin · Audit Log` link to the admin dropdown in AppLayout

### Effort
- Frontend: 0.5 day (new page + route + nav link)

---

## 3. Defect Triage — Priority Order for R2

| Priority | Defect | Effort | Impact | Target Week | Status |
|----------|--------|--------|--------|-------------|--------|
| P1 | **D13**: Admin audit log view page | FE: 0.5 day | Admin governance — missing view for existing backend endpoint | Week 8 | **New** |
| P1 | **D06**: Resolve mock-field gaps | BE: 0.5 day, FE: 0.5 day | Removes stub/placeholder UIs | Week 8 | Decision made (drop) |
| P2 | **D08**: Admin reservation overview | FE: 0.5 day | R2 story US34 | Week 9 | **Open** |
| P2 | **D07**: Tighten rate limit defaults | BE: 10 min | Production hardening | Week 9 | **Open** |
| P3 | **D10–D12**: Nice-to-haves | Various | Polish | Week 10+ | **Open** |

---

## 4. Action Items

| Action | Owner | Target Date | Status |
|--------|-------|-------------|--------|
| Build `GET /admin/users` endpoint + tests | Ivan (BE) | Wed 7/8 | ✅ **Done** |
| Create `AdminMembersPage.tsx` at `/admin/members` | Yafei (FE) | Fri 7/10 | ✅ **Done** |
| Add admin nav link for members | Yafei (FE) | Fri 7/10 | ✅ **Done** |
| Fix email validation on Login/Register (PR #131) | Yafei (FE) | Mon 7/7 | ✅ **Done** |
| Continue FE mock-data integration per contract doc | Yafei (FE) | Wed 7/16 | ✅ **Done** (commit `10d9537`) |
| Post-R1 bug fixes: damage attribution, suspended login, 1-day rentals, reactivation reason | Ivan (BE) | Mon 7/6 | ✅ **Done** |
| Remaining R1 bugs: duplicate damage guard, damage-rating, notification names, profile validation, response fields, VerifyTokenError, account deletion | Ivan (BE) | Mon 7/6 | ✅ **Done** |
| Create `AdminAuditLogPage.tsx` at `/admin/audit-log` | Yafei (FE) | Fri 7/10 | **New** |
| Add admin nav link for audit log | Yafei (FE) | Fri 7/10 | **New** |
| Resolve mock-field gaps (notesForBorrowers, etc.) | Ivan + Yafei | Wed 7/16 | Decision: drop for R1/R2 |
| Tighten rate limit defaults in config | Ivan (BE) | Wed 7/23 | Deferred |
| Update contract doc footer for latest state | Ivan (BE) | Done 7/4 | ✅ |

---

*Generated for Week 7 — Thu 7/9 retrospective and defect triage session.*  
*Updated post-R1 closure with resolved defects, test count, and D13 (audit log view).*
