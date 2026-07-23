# R1 / R2 / Final — Phasing Plan with Role Assignments

**Team:** Group 3 — ICS 613
**Members:**
- Rion Sawabe — PM (coordination, backlog, presentation slides)
- Ivan Wu — Backend Lead (API, database, auth, services)
- Yafei Wang — Frontend Lead (React UI, state management, components)
- Nick Fairhart — QA/DevOps (CI/CD, Docker, testing, deployment)
- Loreto Coloma — Document Lead (README, design doc, meeting notes, presentation content)

---

## Coverage: All 35 v5 User Stories

| # | Story | Phase |
|---|-------|-------|
| NEW | Admin Invites a New Member | R1.A |
| US1 | Register with Invite Token | R1.A |
| US2 | Verify Email Address | R1.A |
| US3 | Log In Securely | R1.A |
| US4 | Reset Forgotten Password | R1.A |
| US5 | Set Up Profile | R1.A |
| US6 | Edit Profile | R1.A |
| US7 | Delete Account | R1.A |
| US8 | Create a Tool Listing | R1.B |
| US9 | Edit a Tool Listing and Manage Photos | R1.B |
| US10 | Delete or Deactivate a Tool Listing | R1.B |
| US11 | Deactivate and Reactivate Listings with Admin Controls | R1.B |
| US12 | Browse and Search for Available Tools | R1.B |
| US13 | Submit a Reservation Request | R1.B |
| US14 | Approve or Deny Reservation Requests | R1.B |
| US15 | Cancel a Reservation as Borrower | R1.B |
| US16 | Cancel a Reservation as Owner | R1.B |
| US17 | Confirm Tool Pickup | R1.B |
| US18 | Auto-Cancel Overdue Pickup | R1.B |
| US19 | Timezone and Date Normalization for Reservations | R2.A |
| US20 | Confirm Tool Return | R1.B |
| US21 | View Reservation History | R1.B |
| US22 | Send and Receive Messages in a Reservation Thread | R2.A |
| US23 | Receive Notifications About Reservations | R2.A |
| US24 | Leave a Rating and Review After a Tool is Returned | R1.B |
| US25 | View a Member's Review History | R1.B |
| US26 | Member Reports an Inappropriate Tool Listing | R2.A |
| US27 | Admin Reviews Reported Listings | R2.A |
| US28 | Admin Manages Tool Categories | Icebox |
| US29 | Admin Tracks Member Listing Violations | R2.A |
| US30 | Admin Suspends a Member Account | R2.A |
| US31 | Admin Reactivates a Suspended Member Account | R2.A |
| US32 | Admin Views Moderation History | R2.A |
| US33 | Admin Generates Community Moderation Reports | Icebox |
| US34 | Admin Views All Active Reservations | R2.A |

**Total:** R1 = 23 stories | R2 = 10 stories | Icebox = 2 stories | All 35 accounted for

---

## R1 Demo (due 7/6) — 23 stories + 7 infrastructure items

### R1.A — Foundation (8 stories)

| Story | BE (Ivan) | FE (Yafei) | QA (Nick) | PM (Rion) | Doc (Loreto) |
|-------|-----------|------------|-----------|-----------|--------------|
| Admin Invites (New) | API + token lifecycle | Admin invite form, invite list UI, revoke button | Test: token gen, expiry, revoke, already-registered email rejection (S4) | Backlog item | Slide 3 content |
| US1 Register with Invite Token | Auth service, invite validation | Registration form with token field | Test: valid/invalid/used/expired token, duplicate email | Backlog item | — |
| US2 Verify Email Address | Email token + verify endpoint | Verify page (from email link), resend link | Test: valid/expired token, resend flow | Backlog item | — |
| US3 Log In Securely | JWT login + logout (S4) | Login form, logout button, session redirect | Test: valid/invalid creds, EMAIL_PENDING block, logout invalidates | Backlog item | — |
| US4 Reset Forgotten Password | Password reset token flow | Forgot-password form, reset form | Test: request flow, valid/expired token, all sessions revoked | Backlog item | — |
| US5 Set Up Profile | Profile service | Profile setup page (forced after verify), photo upload | Test: required fields, photo validation, 401 check | Backlog item | — |
| US6 Edit Profile | Profile update service | Edit profile page, photo replace | Test: display name required, 403 for other's profile, no-op save | Backlog item | — |
| US7 Delete Account | Soft-delete service + PII anonymization | Delete account button, active-reservation block message, confirmation flow | Test: with/without active reservations, SUSPENDED member deletion (S5), history preserved, re-registration | Backlog item | — |

### R1.B — Core Demo Path (15 stories)

| Story | BE (Ivan) | FE (Yafei) | QA (Nick) | PM (Rion) | Doc (Loreto) |
|-------|-----------|------------|-----------|-----------|--------------|
| US8 Create a Tool Listing | Listing CRUD + photo storage | Create listing form, category dropdown, photo upload (1-5), latest_return_time input | Test: required fields, photo count/size/format, unique name per owner, 401 | Backlog item | Slide 3 + 4 content |
| US9 Edit a Tool Listing | Edit with PICKED_UP block | Edit listing page, photo add/remove/reorder, deactivation info display | Test: edit allowed when no PICKED_UP, blocked when PICKED_UP, photo limits, non-owner 403 | Backlog item | — |
| US10 Delete or Deactivate | Delete/deactivate service | Delete button, deactivate form with reason, active-reservation block | Test: delete allowed/blocked, photo cleanup on delete, deactivate auto-cancels, reason required, 403/401 | Backlog item | — |
| US11 Admin Listing Controls | Admin deactivate/reactivate + audit log | Admin listing management page, deactivate/reactivate buttons, reason input | Test: PICKED_UP block, auto-cancel, reactivate, audit log, non-admin 403 | Backlog item | — |
| US12 Browse and Search | Search + filter API | Browse page, category filter chips, keyword search, date-range filter, listing detail page | Test: browse all, search by name, filter by category, date-range availability | Backlog item | — |
| US13 Submit Reservation Request | Reservation service + EXCLUDE constraint | Reservation request form (date picker HST), availability display, conflict message | Test: valid request, overlap rejection (409), self-own block, 1-day rental, concurrent race | Backlog item | Slide 2 (ERD) context |
| US14 Approve or Deny Request | Approve/deny service | Owner dashboard with pending requests, approve/deny buttons, optional reason | Test: approve, deny with reason, overlap-on-approve block, non-owner 403 | Backlog item | — |
| US15 Cancel as Borrower | Cancel service + owner notification | Cancel button on borrower's reservations, state-dependent visibility | Test: cancel REQUESTED, cancel APPROVED, block PICKED_UP/DENIED/RETURNED/CANCELLED, owner notified | Backlog item | — |
| US16 Cancel as Owner | Owner cancel service | Cancel button on owner dashboard, reason input | Test: cancel APPROVED, block deny-on-APPROVED, block PICKED_UP, block double-deny, non-party 403 | Backlog item | — |
| US17 Confirm Tool Pickup | Pickup transition + timestamp | Pickup button (visible only APPROVED, on/after start_date), timestamp display | Test: valid pickup, before-start_date block, REQUESTED block (UI hidden + API), double-pickup block, 403/401 | Backlog item | — |
| US18 Auto-Cancel Overdue | Celery job (grace period) | Overdue indicator on reservation, auto-cancel notice | Test: 3-day grace expiry, pickup within grace prevents, HST midnight trigger, date freed | Backlog item | Risk slide content |
| US20 Confirm Tool Return | Return transition + damage report + escalation | Return button, late-return warning, damage report form, admin escalation UI | Test: on-time return, late return, late-return warning, non-borrower 403, damage report (7-day window, auto-deactivates tool + auto-cancels pending reservations), escalation (7-day overdue), admin force-mark | Backlog item | — |
| US21 View Reservation History | History queries (borrower + owner) | Dashboard: my reservations (as borrower), my tools' reservations (as owner), status badges | Test: both views populated, past RETURNED visible | Backlog item | — |
| US24 Leave Rating and Review | Review service + rating calc | Review form (star rating + optional comment), edit/delete within 24h, 3-day reminder | Test: valid review, non-RETURNED block, one-per-reservation, 30-day window, rating 1-5 validation, self-review block | Backlog item | — |
| US25 View Review History | Review aggregation + profile query | Member profile page: reviews, average rating, damage-report trust signals, member-since, completed loans | Test: profile display, reviews visible, damage reports as 1-star, deleted member's reviews preserved | Backlog item | — |

### R1.C — Cross-Cutting Infrastructure (7 items)

| Item | BE (Ivan) | FE (Yafei) | DevOps (Nick) | QA (Nick) | PM (Rion) | Doc (Loreto) |
|------|-----------|------------|---------------|-----------|-----------|--------------|
| Auth middleware (JWT) | Implemented | Token storage, axios interceptor, redirect on 401 | — | Test: expired token, missing token, refresh flow | — | — |
| Email service (SMTP) | Token generation + send hooks | — | Docker MailHog (dev), Gmail SMTP (prod), .env config | Test: verification email sent, reset email sent, deletion confirmation | — | — |
| Notification subsystem | Notification model + polling endpoint | Notification badge, unread count, notification list | — | Test: notification created on status change, polling returns new | — | — |
| Job runner (Celery + Redis) | Celery tasks (auto-cancel, auto-deny) | — | Docker: Redis + Celery worker containers | Test: task scheduled, task executes, task idempotent | — | Risk slide |
| HST timezone utility | `normalize_hst()` helper | Date inputs labeled "HST", UI note displayed | — | Test: HST→UTC storage, UTC→HST display, overlap detection | — | — |
| Postgres EXCLUDE constraint | Migration with GiST index | — | Verify in Docker Postgres | Test: concurrent overlapping requests → 409 | — | ERD slide |
| Audit log table | Schema + inserts on deactivate/reactivate/suspend | — | — | Test: log entries created with correct actor/timestamp/reason | — | — |

---

## R2 Demo (due 7/27) — 10 stories + refinements

### R2.A — Deferred Stories (10 stories)

| Story | BE (Ivan) | FE (Yafei) | QA (Nick) | PM (Rion) | Doc (Loreto) |
|-------|-----------|------------|-----------|-----------|--------------|
| US19 Timezone Normalization (doc) | Behavior already in R1 infra | — | Test: HST display across browsers, UTC storage verified | — | Finalize standalone story doc |
| US22 Reservation Messaging | Message model + thread API | Message thread UI in reservation detail, send input, read-only for closed threads, chronological display | Test: send in REQUESTED/APPROVED/PICKED_UP, blocked in RETURNED/CANCELLED, non-party 403, admin readable | Backlog item | — |
| US23 Notification Center UI | Delivery pipeline from R1 | Notification center page, badge with unread count, click to open list, mark-as-read | Test: unread count, notification list populated, status-change triggers | Backlog item | — |
| US26 Member Reports Listing | Report model + submit endpoint | Report button on listing, reason selector, optional comment, pending-report block message | Test: valid report, duplicate block, reason required, 401, deactivated/non-existent listing block (S5) | Backlog item | — |
| US27 Admin Reviews Reports | Report resolution service + auto-cancel on deactivate | Admin reported-listings page, valid/invalid resolution buttons, listing status change | Test: mark valid → listing deactivated + reservations auto-cancelled, mark invalid → listing stays, non-admin 403 | Backlog item | Slide 3 content |
| US29 Admin Tracks Violations | Violation count aggregation | Member moderation profile: violation count, listing titles, dates, admin decisions | Test: count increments on valid report, not on invalid, zero state | Backlog item | — |
| US30 Admin Suspends Member | Suspend service + cascade rules | Admin suspend button with reason, suspended-member restriction UI (disabled actions, read-only browse, suspension notice) | Test: suspend, already-suspended block (S5), restricted actions blocked, can log in but limited, non-admin 403 | Backlog item | — |
| US31 Admin Reactivates Member | Reactivate service | Admin reactivate button, status change display, member notification | Test: reactivate SUSPENDED, block reactivating ACTIVE/DELETED, normal access restored, non-admin 403 | Backlog item | — |
| US32 Admin Moderation History | History query with filters | Moderation history page: filterable (member, listing, action type, date range), paginated 50/page | Test: all actions displayed, filters work, empty-filter message, non-admin 403 | Backlog item | — |
| US34 Admin Views All Reservations | Admin reservation overview query | Admin reservations overview page: all REQUESTED/APPROVED/PICKED_UP, filterable by status/member/date | Test: all active reservations visible, filters work, non-admin 403 | Backlog item | — |

### R2.B — Improvements

| Item | BE (Ivan) | FE (Yafei) | DevOps (Nick) | QA (Nick) |
|------|-----------|------------|---------------|-----------|
| Pagination on all list endpoints (20/page) | Query param support | Page controls on browse, history, admin lists | — | Test: page size, boundary cases |
| Advanced search filters (condition, rating) | Add filter params to search API | Filter controls on browse page | — | Test: combined filters |
| R1 retrospective bug fixes | Fix identified issues | Fix identified issues | CI adjustments | Regression tests |

---

## Icebox (may not implement — 2 stories)

These are low-priority stories documented as acceptable known limitations for the final submission. They have no live-demo value and were flagged as scope-creep risks by the Group 1 cross-team review.

| Story | BE (Ivan) | FE (Yafei) | QA (Nick) | Doc (Loreto) | Why Icebox |
|-------|-----------|------------|-----------|--------------|------------|
| US28 Admin Manages Tool Categories | Category CRUD API | Category management page (add/remove from allowed list, block removal if ACTIVE listings use it) | Test: add category, remove when no ACTIVE listings, block when in use, non-admin 403 | Document as: "Static category list maintained in deployment config." | Simplified to dropdown in v5. Zero demo value. Pure content management. |
| US33 Admin Generates Community Moderation Reports | Report query endpoints | Report generation page (type selector, date range, CSV export button) | Test: generate report, CSV export with headers, empty results message, non-admin 403 | Document as: "Report queries available via direct DB access for R1; UI planned for v2." | Group 1 Section 8c: scope creep risk. Zero live-demo value. Analytics, not demo functionality. |

---

## Final (due 8/11) — Polish + Harden

### Final.A — Required Deliverables

| Deliverable | BE (Ivan) | FE (Yafei) | DevOps (Nick) | QA (Nick) | PM (Rion) | Doc (Loreto) |
|-------------|-----------|------------|---------------|-----------|-----------|--------------|
| Deployment guide | Docker config validation | Build steps | Step-by-step deploy guide, env vars, seed data, troubleshooting | Validate guide on clean machine | Review | Write deployment guide |
| Manual test cases (8-10 per story) | — | — | — | Write test cases, positive + negative + edge | Track progress | Template + formatting |
| E2E test of full lifecycle | Seed data for E2E path | — | Playwright / pytest E2E | Automated test: invite→register→verify→list→request→approve→pickup→return→review | — | — |
| Booking rules test coverage | Fill gaps in reservation tests | — | — | Coverage report, target 80%+ on reservation module | — | — |
| Seed data + demo script | Seed script | — | Docker seed volume | Verify demo path deterministic | Rehearse demo | Demo script document |
| README polish | Architecture decisions | Frontend setup | Docker setup | Known limitations | Review | Full README |
| Bug fixes from R1 + R2 | Fix backend bugs | Fix frontend bugs | CI/CD fixes | Verify all fixes | Track issues | — |
| Final retrospective | Lessons learned (BE) | Lessons learned (FE) | Lessons learned (DevOps) | QA summary | Project management reflection | Compile retrospective |
| Final presentation slides | Slide 3 (accomplishments) | Slide 3 (screenshots) | Slide 7 (QA metrics) | Slide 7 (defects, coverage) | Slides 1, 5, 8 | Slides 2, 4, 6, 10 |

---

## Summary by Team Member

### Ivan (Backend Lead)
- **R1:** 23 story backends + 7 infra items
- **R2:** 10 story backends + 2 icebox backends (if time) + pagination + search filters
- **Final:** Bug fixes, seed data, E2E test support, README architecture section

### Yafei (Frontend Lead)
- **R1:** 23 story frontends (heaviest workload)
- **R2:** 10 story frontends + 2 icebox frontends (if time) + notification center + messaging UI + admin pages + pagination
- **Final:** Bug fixes, screenshots for slides, build steps in deploy guide

### Nick (QA/DevOps)
- **R1:** CI/CD pipeline, Docker (Postgres + Redis + Celery + MailHog), test all 23 stories, EXCLUDE constraint verification
- **R2:** Test 10 new stories + 2 icebox stories (if time), regression test R1 stories, pagination boundary testing
- **Final:** Deployment guide (author + validate), E2E automation, test cases document, coverage report, bug verification

### Rion (PM)
- **R1:** Backlog creation (GitHub Project Board with all 35 story issues), issue assignment, sprint tracking, Slide 1 + 5 + 8 for R1 presentation
- **R2:** Sprint tracking, scope adjustments based on R1 velocity, Slide 5 + 8 updates
- **Final:** Final presentation coordination, project management reflection, milestone tracking summary

### Loreto (Document Lead)
- **R1:** Technical Design Document (due 7/1) — compile from Ivan + Yafei + Nick inputs. R1 presentation slides 2, 4, 6, 10. Meeting minutes. README updates.
- **R2:** Update design doc with R1 changes. R2 presentation content. Manual test case formatting (due 7/14).
- **Final:** Deployment guide (co-author), README polish, final retrospective compilation, Known Limitations documentation for Icebox stories
