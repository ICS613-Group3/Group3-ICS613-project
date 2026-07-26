# Final Fix Gaps — v5 User Stories Audit
Generated: 2026-07-22

## Remaining Items for Final Phase

### 1. US25 — Public Profile Page (Backend + Frontend)
**What:** Members cannot view another member's public profile.
**Needed:**
- Backend: New endpoint `GET /users/{user_id}/public` (non-admin, returns public info only)
- Frontend: New `PublicProfilePage.tsx` at `/profile/:userId`
- Display: display name, photo, bio, neighborhood, member-since date, average rating, total completed loans, ACTIVE tool listings
- Damage reports visible as trust signals on borrower profiles
**Status:** Not started

### 2. US20 Scenario 7 — Auto-Escalation After 7 Days No Return (Backend)
**What:** When a PICKED_UP reservation passes end_date + 7 days without being returned, admin should be notified and borrower flagged.
**Needed:**
- Backend scheduler/cron job to check for overdue PICKED_UP reservations
- Notification to admin when escalation triggers
- Flag set on borrower's profile (admin-visible)
**Status:** Not started (no UI needed)

### 3. US11 — Deactivate/Reactivate Notification Gaps
**What:** When a tool is deactivated or reactivated, affected borrowers/owners don't receive in-app notifications.
**Affected xfails:**
- `test_us11_admin_deactivate_reactivate.py::test_affected_borrower_is_notified`
- `test_us11_admin_deactivate_reactivate.py::test_owner_is_notified_of_reactivation`
**Status:** Bug confirmed, fix needed in `ToolService.deactivate_tool()` and `ToolService.reactivate_tool()`

### 4. US22 — Messaging Notification Gaps
**What:** Some messaging-related notification scenarios are incomplete.
**Affected xfails:** Remaining xfailed tests in messaging notification tests
**Status:** Minor gaps, documented

---

## Already Fixed (2026-07-22)

| Item | Fix |
|------|-----|
| US4 refresh token invalidation | Removed stale xfail — AuthService.refresh() now checks password_changed_at |
| US8 description required | Removed stale xfail — description now has min_length=1 |
| US8 zero photos rejected | Removed stale xfail — create_with_photos now checks `if not photos` |
| US8 duplicate name check | Removed stale xfail — duplicate name validation exists |
| US10 PICKED_UP guard | Removed stale xfail — deactivate_tool now checks PICKED_UP |
| US11 admin PICKED_UP guard | Removed stale xfail — same guard fix |
| US23 borrower pickup notification | Removed stale xfail — borrower notification added to mark_picked_up |
| US23 approval notification | Fixed approve() to include owner name in notification body |
