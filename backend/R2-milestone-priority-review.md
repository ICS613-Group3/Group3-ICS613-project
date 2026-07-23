# R2 Milestone Priority Review — UPDATED (2026-07-17)

All backend issues from the QA report have been fixed and verified.
198 tests pass, 3 skipped, 3 xfailed.

---

## A. QA Backend Debugging Issues — ALL FIXED

| # | Issue | Label | Status | Fix Applied |
|---|-------|-------|--------|-------------|
| #208 | Receive Notifications (TC-136) | doc | **FIXED** | Added borrower confirmation in mark_picked_up() |
| #207 | Receive Notifications (TC-135) | doc | **FIXED** | Added borrower confirmation in mark_returned() |
| #197 | **FE**: Confirm Tool Pickup (TC-102) | **bug** | FE scope | Yafei to handle |
| #196 | Browse & Search (TC-075) | **bug** | **VERIFIED OK** | Backend returns correct empty-state response |
| #195 | Browse & Search (TC-076) | **bug** | **VERIFIED OK** | Backend returns correct empty-state response |
| #194 | Browse & Search (TC-074) | **bug** | **VERIFIED OK** | Backend returns correct empty-state response |
| #193 | Browse & Search (TC-073) | doc | **VERIFIED OK** | Backend supports all filters |
| #192 | Browse & Search (TC-070) | doc | **VERIFIED OK** | Backend supports all filters |
| #191 | Browse & Search (TC-069) | — | **VERIFIED OK** | Backend supports all filters |
| #190 | Deactivate/Reactivate (TC-068) | doc | **VERIFIED OK** | Backend has proper audit logging |
| #187 | Deactivate/Reactivate (TC-065) | **bug** | **FIXED** | Added PICKED_UP guard in deactivate_tool() |
| #182 | Creating a Tool Listing (TC-041) | **bug** | **FIXED** | Added duplicate name check in create_tool() |
| #181 | Creating a Tool Listing (TC-039) | enhancement | **FIXED** | Same as #182 |
| #180 | Creating a Tool Listing (TC-038) | **bug** | **FIXED** | Same as #182 |
| #179 | Creating a Tool Listing (TC-036) | **bug** | **FIXED** | Same as #182 |
| #178 | Creating a Tool Listing (TC-035) | enhancement | **FIXED** | Same as #182 |
| #177 | Delete Account (TC-033) | doc/enhancement | **VERIFIED OK** | Backend anonymizes email on delete; FE needs confirmation dialog |

## B. R1 Bug Fixes & Core Stability — ALL VERIFIED

| # | Issue | Status |
|---|-------|--------|
| #141 | R1 retrospective bug fixes | **VERIFIED OK** — already fixed in previous commits |
| #139 | Pagination on all list endpoints (20/page) | **FIXED** — standardized all endpoints to 20/page |
| #136 | HST timezone utility | **FIXED** — created app/core/timezone.py with normalize_hst() |
| #121 | (BE) Check duplicate listing name | **FIXED** — added to create_tool() |
| #95 | (FE) Redirect to member dashboard | FE scope — Yafei to handle |

## C. Partially Built User Stories

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| #37 | US 10: Delete/Deactivate Tool Listing (**bug**) | **VERIFIED OK** | Backend works correctly |
| #33 | US 6: Edit Profile (**bug** + enhancement) | **VERIFIED OK** | Backend works correctly |
| #32 | US 5: New Member Set Up Profile | **VERIFIED OK** | Backend works correctly |
| #36 | US 9: Edit Tool Listing & Manage Photos | **VERIFIED OK** | Backend works correctly |
| #27 | Admin Invites a New Member | **VERIFIED OK** | Backend works correctly |

## D. Admin User Stories — ALL IMPLEMENTED & VERIFIED

All backend endpoints exist and work correctly. GitHub issues need to be closed after push.

| # | Issue | Backend Endpoint | Status |
|---|-------|------------------|--------|
| #61 | US 34: Admin Views All Active Reservations | `GET /admin/reservations` | **VERIFIED OK** |
| #59 | US 32: Admin Views Moderation History | `GET /admin/audit-log` | **VERIFIED OK** |
| #58 | US 31: Admin Reactivates Suspended Account | `POST /users/{id}/reactivate` | **VERIFIED OK** |
| #57 | US 30: Admin Suspends Member Account | `POST /users/{id}/deactivate` | **VERIFIED OK** |
| #56 | US 29: Admin Tracks Member Violations | `GET /users/{id}/moderation` | **VERIFIED OK** |
| #54 | US 27: Admin Reviews Reported Listings | `GET /reports` + `POST /reports/{id}/resolve` | **VERIFIED OK** |

## E. Improvements & Infrastructure — Defer to Final

| # | Issue | Reason |
|---|-------|--------|
| #135 | Job runner (Celery + Redis) | Not blocking demo |
| #138 | Audit log table | Already implemented as AdminAuditLog |
| #140 | Advanced search filters | Already implemented (condition, min_rating) |
| #69 | (BE) Update invite revoked status | Invite system enhancement |
| #68 | (BE) Retrieve invite status | Invite system enhancement |
| — | Store invite status in DB | Invite system enhancement |
| — | (FE) Invite Management Page | Invite system enhancement |
| #120 | (FE) Show duplicate name message | FE scope |
| #118 | (FE) Return time format validation | FE scope |

## F. Process Tasks — R2

- #144 R2 Presentation + Live demo rehearsal
- #159 R2 Presentation slides creation

---

## Code Changes Made

### 1. reservation.py — Borrower notifications
- Added confirmation notification to borrower in `mark_picked_up()`
- Added confirmation notification to borrower in `mark_returned()`

### 2. tool.py — Duplicate name check + PICKED_UP guard
- Added duplicate name validation in `create_tool()`
- Added PICKED_UP guard in `deactivate_tool()`

### 3. Pagination standardization (20/page)
- `admin.py`: list_users, audit_log (was 50)
- `messages.py`: list_messages (was 50)
- `reports.py`: list_reports, list_my_reports (was 50)
- `listing_report.py` service: list_reports (was 50)
- `admin.py` service: list_users, list_audit_log (was 50)
- `message.py` service: list_messages (was 50)

### 4. New: timezone.py
- Created `app/core/timezone.py` with HST conversion helpers

---

## Next Steps

1. **Commit and push** all changes to GitHub
2. **Close GitHub issues** that are now fixed:
   - #208, #207, #187, #182, #181, #180, #179, #178, #177
   - #196, #195, #194, #193, #192, #191, #190
   - #139, #136, #121
   - #61, #59, #58, #57, #56, #54
   - #141, #37, #33, #32, #36, #27
3. **Yafei** handles FE issues: #197, #95, #120, #118
4. **Defer to final**: #135, #69, #68, invite system enhancements
