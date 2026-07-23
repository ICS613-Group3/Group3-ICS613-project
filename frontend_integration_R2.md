# Frontend Integration — R2 (Release 2)

**Date:** 2026-07-22
**Branch:** `r2-frontend-combined`

---

## Overview

R2 integrates all remaining user stories (US22–US34) into the frontend, connecting React pages to the FastAPI backend via real API calls. This replaces Rion's mock-data prototypes with production-ready implementations.

---

## New API Modules

| Module | File | Endpoints |
|--------|------|-----------|
| Categories | `src/api/categories.ts` | `GET /categories`, `POST /categories`, `DELETE /categories/{id}` |
| Reports | `src/api/reports.ts` | `POST /tools/{id}/report`, `GET /reports`, `POST /reports/{id}/resolve`, `GET /reports/me` |
| Messages | `src/api/messages.ts` | `GET /reservations/{id}/messages`, `POST /reservations/{id}/messages` |

### Updated API Module

| Module | New Method | Endpoint |
|--------|------------|----------|
| `src/api/admin.ts` | `exportModerationReportCsv()` | `GET /admin/reports/moderation/export` |

---

## New Pages

| Page | File | Route | User Story |
|------|------|-------|------------|
| My Tools | `src/pages/MyToolsPage.tsx` | `/tools/mine` | View own tool listings |
| Admin Categories | `src/pages/AdminCategoriesPage.tsx` | `/admin/categories` | US28 — manage tool categories |
| Admin Reported Listings | `src/pages/AdminReportedListingsPage.tsx` | `/admin/reported` | US27 — review reported listings |
| Admin Moderation Reports | `src/pages/AdminModerationReportsPage.tsx` | `/admin/moderation/reports` | US33 — generate moderation reports |
| Message Thread | `src/pages/MessageThreadPage.tsx` | `/reservations/:id/messages` | US22 — reservation messaging |

### Updated Pages

| Page | Changes | User Story |
|------|---------|------------|
| `src/pages/ToolDetailPage.tsx` | Added Report Listing modal (reason + comment + submit) | US26 |
| `src/pages/AdminModerationIndividualProfile.tsx` | Added Suspend/Reactivate buttons with reason input | US30/31 |

---

## Routes (src/routes/AppRoutes.tsx)

```
/tools/mine                          → MyToolsPage
/reservations/:id/messages           → MessageThreadPage
/admin/reported                      → AdminReportedListingsPage
/admin/categories                    → AdminCategoriesPage
/admin/moderation/reports            → AdminModerationReportsPage
```

All new routes are wrapped in `<RequireAuth>`.

---

## Navigation (src/components/AppLayout.tsx)

- **Browse Tools dropdown** — added "My Tools" link
- **Admin section** — added "Reported Listings", "Categories", "Moderation" links

---

## Bug Fixes (from code review)

| Issue | File | Fix |
|-------|------|-----|
| `suspendUser()` missing reason | `AdminMembersPage.tsx:58` | Added `suspendReason.trim()` as second arg |
| `unsuspendUser()` missing reason | `AdminMembersPage.tsx:74` | Added `'Admin reactivation'` as second arg |
| `report.reason.value` crash | `listing_report.py:155` | Changed to `report.reason` (plain string, not enum) |
| Duplicate `PaginatedResponse` type | `api/admin.ts:46-52` | Removed local copy, imports from `types/api.ts` |
| Hardcoded admin credentials | `LoginPage.tsx:71,84` | Cleared `defaultValue` for email and password |
| Dead `mockData.ts` | `src/data/mockData.ts` | Deleted (wrong ToolCondition enum, never imported) |

---

## Stale xfail Removals (backend tests)

| Test File | xfail Reason (was) | Why Stale |
|-----------|-------------------|-----------|
| `test_us04_reset_password.py` | Refresh token not invalidated | AuthService.refresh() now checks password_changed_at |
| `test_us08_create_listing.py` (3) | Description optional, zero photos allowed, no duplicate check | All three now enforced |
| `test_us10_delete_deactivate_listing.py` | No PICKED_UP guard on deactivate | Guard now exists in deactivate_tool() |
| `test_us11_admin_deactivate_reactivate.py` | No PICKED_UP guard for admin | Same guard fix |
| `test_us23_notifications.py` (2) | No borrower notification on pickup, no tool name in approve | Both now implemented |

---

## Remaining Gaps (documented in FINAL_FIXES.md)

1. **US25** — Public profile page (backend endpoint + frontend page needed)
2. **US20 S7** — Auto-escalation after 7 days no return (backend scheduler)
3. **US11** — Deactivate/reactivate don't notify affected users (2 xfails)
4. **US22** — Messaging notification gaps (xfails)

---

## Test Results

```
Backend:  337 passed, 44 skipped, 13 xfailed, 0 failures
Frontend: TypeScript compiles clean (npx tsc --noEmit)
```

---

## Files Changed Summary

```
NEW:  frontend/src/api/categories.ts
NEW:  frontend/src/api/reports.ts
NEW:  frontend/src/api/messages.ts
NEW:  frontend/src/pages/MyToolsPage.tsx
NEW:  frontend/src/pages/AdminCategoriesPage.tsx
NEW:  frontend/src/pages/AdminReportedListingsPage.tsx
NEW:  frontend/src/pages/AdminModerationReportsPage.tsx
NEW:  frontend/src/pages/MessageThreadPage.tsx

MOD:  frontend/src/api/admin.ts (added exportModerationReportCsv, removed duplicate PaginatedResponse)
MOD:  frontend/src/pages/ToolDetailPage.tsx (added Report modal)
MOD:  frontend/src/pages/AdminModerationIndividualProfile.tsx (added Suspend/Reactivate)
MOD:  frontend/src/pages/AdminMembersPage.tsx (fixed suspendUser/unsuspendUser calls)
MOD:  frontend/src/pages/LoginPage.tsx (removed hardcoded credentials)
MOD:  frontend/src/routes/AppRoutes.tsx (5 new routes, cleaned imports)
MOD:  frontend/src/components/AppLayout.tsx (3 new nav links)
MOD:  backend/src/app/services/listing_report.py (fixed .value crash)
MOD:  backend/src/app/services/reservation.py (added owner name to approve notification)
MOD:  backend/src/app/tests/acceptance/test_us04_reset_password.py (removed stale xfail)
MOD:  backend/src/app/tests/acceptance/test_us08_create_listing.py (removed 3 stale xfails, fixed test)
MOD:  backend/src/app/tests/acceptance/test_us10_delete_deactivate_listing.py (removed stale xfail)
MOD:  backend/src/app/tests/acceptance/test_us11_admin_deactivate_reactivate.py (removed stale xfail)
MOD:  backend/src/app/tests/acceptance/test_us23_notifications.py (removed 2 stale xfails)

DEL:  frontend/src/data/mockData.ts (dead code)
DEL:  frontend/src/pages/AdminAuditLogPage.tsx (stale, replaced by ModerationHistoryPage)
DEL:  frontend/src/pages/AdminReportsPage.tsx (stale duplicate)
```
