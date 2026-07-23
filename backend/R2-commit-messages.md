fix: R2 backend — bug fixes, new features, and seed script alignment

Resolves GitHub issues:
  Tier 1 (regression fixes):
    #169, #170, #171, #177, #178, #179, #180, #181, #182,
    #187, #190, #191, #192, #193, #194, #195, #196, #207, #208
  Tier 2 (completed enhancements):
    #47, #51, #52, #121, #136, #139, #69
  Tier 3 (features deferred but already built):
    #45, #46, #49, #53, #54, #55, #56, #57, #58, #59, #60, #61,
    #63, #67, #138, #139

— Bug fixes —
- Auth: stale refresh tokens rejected after password reset (#171)
- Auth: pending/soft-deleted users cannot verify email (VerifyTokenError)
- Auth: suspended users allowed to log in to see suspension notice
- Auth: deleted accounts cannot authenticate
- Tools: duplicate tool name per owner blocked (case-insensitive) (#121)
- Tools: description now required on create (#179/#181)
- Tools: at least 1 photo required on create (#178/#180)
- Tools: deactivation blocked when tool is PICKED_UP (#187)
- Tools: deactivation reason stored with audit metadata (#190)
- Reservations: auto-cancel overdue pickups after 3-day grace (#45)
- Reservations: auto-escalate overdue returns with soft/hard phases
- Reservations: borrower receives notification on pickup and return (#207/#208)
- Reviews: ratings recalculated on create/edit/delete (tool avg_rating, user trust_score)
- Reviews: damage reports counted as 1-star equivalents for trust_score
- Users: account soft-delete blocks when tools are out on loan (#177)
- Users: full_name preserved after deletion for history integrity
- Users: response fields trimmed (no hashed_password, proper admin flag)

— New features —
- Admin invite revoke endpoint (POST /auth/invites/{id}/revoke) (#69)
- Admin tool category management (CRUD on /categories) (#55)
- Member listing reports (POST /tools/{id}/report) (#53)
- Admin report review + resolve (POST /reports/{id}/resolve) (#54)
- Reservation messaging (POST/GET /reservations/{id}/messages) (#49)
- Reviews on completed reservations (POST /reservations/{id}/review) (#51)
- View own review history (GET /users/me/reviews) (#52)
- In-app notifications with unread count (#207/#208)
- Admin moderation profile per member (GET /admin/users/{id}/moderation) (#56)
- Admin audit log with action/target/date filters (GET /admin/audit-log) (#138)
- Admin moderation reports with CSV export (#60)
- Admin all-reservations view with filters (#61)
- Admin user management: suspend, reactivate, hard-delete (#57/#58)
- HST timezone utility (core/timezone.py) (#136)
- Pagination on all list endpoints (20 items/page) (#139)
- Advanced tool search: category, condition, min_rating, date range filters
- Invite status tracking: SENT / USED / EXPIRED / REVOKED (#67)
- Token cleanup: expired tokens auto-deleted after 30 days (scheduler)

— Seed script —
- Removed broken ToolCategory enum references
- Added Category model seed rows (5 admin-managed categories)
- Tool category changed from enum values to plain strings

— Test results —
  198 passed, 3 skipped, 3 xfailed  (no regressions)
