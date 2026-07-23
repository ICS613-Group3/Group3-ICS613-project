# Cross-Team Test Case Review Report (Revised)

**Reviewed Team:** Group 3 — Neighborhood Tool Sharing Platform  
**Reviewing Team:** Group 1  
**Artifact Reviewed:** `Manual_Test_Cases.csv` (182 test cases, 34 stories, TC-001 to TC-182)  
**Date:** July 11, 2026  
**Note:** This revision reflects 3 fixes applied since the initial review: (1) Browse & Search empty-state scenarios added, (2) Suspension cascade scenarios added, (3) Scheduler notes added to 7 test cases.

---

## 1. Summary

Group 3 has produced a well-structured test case spreadsheet with 182 manual test cases covering 34 user stories (2 ICEBOX stories — US28 and US33 — correctly separated). Every test case is traceable to a source user story scenario. The Pass/Fail and Actual Result columns are correctly left blank for the initial submission.

**Overall impression:** The test suite is thorough in its core domain coverage — the reservation lifecycle (83 test cases across 15 stories) is exhaustively tested with guard conditions at every state transition. Permission boundaries (401/403) are consistently tested. The three high-priority gaps identified in the initial review have been addressed. Several medium-priority gaps remain.

**Key strengths since initial review:**
- Browse & Search now has 3 empty-state scenarios (zero results, empty category, no listings)
- Admin Suspends now has 3 cascade-effect scenarios (listings deactivated, reservations cancelled, borrowers notified)
- All scheduler-dependent test cases now include manual-testing difficulty notes

**Remaining gaps:**
- 4 read-only stories still lack empty-state test cases
- "Resend verification email" still has no dedicated test case
- Self-report abuse prevention not tested

---

## 2. Strengths

**2a. Reservation Lifecycle Coverage.** The reservation state machine is exhaustively tested: every state transition (REQUESTED, APPROVED, PICKED_UP, RETURNED, CANCELLED, DENIED) has guard conditions tested from both borrower and owner perspectives. Examples: TC-090 "Cannot double-cancel an already CANCELLED reservation," TC-098 "Owner cannot cancel a PICKED_UP reservation," TC-103 "Backend rejects invalid status transition to PICKED_UP."

**2b. Permission Boundaries.** 12 stories include explicit 403 Forbidden tests; 8 stories include explicit 401 Unauthorized tests. The pattern is consistently applied with specific test cases verifying each endpoint's access control.

**2c. Edge Case Handling.** Complex edge cases are present: "Listing name must be unique per owner" (TC-041), "Each user can only submit one review per reservation" (TC-140), "Cannot double-confirm pickup" (TC-106), "Cannot report the same listing multiple times while pending" (TC-152).

**2d. Photo Management Depth.** Edit a Tool Listing and Manage Photos has 11 scenarios covering every photo-management edge case: add, remove, max count (5), min count (1), thumbnail rotation on first-photo removal, invalid file rejection, non-owner guard, unauthenticated guard, invalid latest_return_time format.

**2e. Suspension Cascade Effects (NEW).** US30 now covers downstream effects: suspended member's tool listings are auto-deactivated (TC-169), pending reservations are auto-cancelled (TC-170), and affected borrowers with reservations on suspended member's tools are notified (TC-171).

**2f. Browse Empty States (NEW).** US12 now has 3 empty-state scenarios: search with zero matching results (TC-074), category filter with no matches (TC-075), and browse when no ACTIVE listings exist (TC-076). Each includes expected UI copy for the empty state.

**2g. Scheduler Notes.** All 11 scheduler-dependent test cases now include "Requires waiting for scheduled job or manipulating system clock. Automated test recommended" in the Test data field.

**2h. Review Story Completeness.** Leave a Rating and Review has 9 scenarios covering: submission, non-completed guard, one-per-reservation, 30-day window, self-review block, rating bounds, optional comment, 24-hour edit/delete window, and review reminder after 3 days. This is one of the most thoroughly-tested stories.

**2i. ICEBOX Separation.** US28 and US33 are correctly separated into a companion CSV with distinct ID prefix (TC-IBX-001 to TC-IBX-008), matching the R1 Backend Implementation Plan Section 7.

**2j. Structural Quality.** All 182 test case IDs are sequential (TC-001 to TC-182), no gaps, no backslash escapes, no markdown artifacts, no empty required fields, and Pass/Fail + Actual Result correctly blank.

---

## 3. Ambiguities

**3a. "Report" can mean three different things.** The word "report" is used for (1) listing reports (US26), (2) damage reports (US20 Scenario 6), and (3) moderation reports (US33 ICEBOX). TC-126 correctly says "damage report," but other references could be ambiguous. **Recommendation:** Use distinct terminology: "listing report," "damage report," "moderation report."

**3b. Test data is story-level, not scenario-level.** All 8 scenarios in a story share identical Test data. For stories with diverse path conditions (e.g., Delete Account where scenarios test "with reservations" vs "without reservations"), scenario-specific test data would help the tester. **Recommendation:** Add scenario-specific test data where it clarifies the test setup.

**3c. "Deny" scenarios live in "Cancel as Owner" story.** US16 is titled "Cancel a Reservation as Owner," but scenarios 2, 3, and 5 test the "deny" action. The CSV mitigates this with clarifying names (e.g., "Owner cannot deny an APPROVED reservation (must cancel, not deny)"), but the source story title is misleading. **Recommendation:** Update source requirements or add a note in the story description.

**3d. Some Steps describe system behavior rather than tester actions.** TC-108 says "the system timer runs" (what the system does) vs. TC-069 says "the member opens the browse page. The tester verifies..." (what the tester does). **Recommendation:** Standardize Steps as tester actions or triggered events.

---

## 4. Missing Cases

**4a. View Reservation History — No empty states.** All 3 scenarios test positive conditions (view as borrower, view as owner, past reservations visible). Missing: what does the history page show when a member has zero reservations as borrower? Zero as owner? **Recommendation:** Add 2 empty-state scenarios.

**4b. View a Member's Review History — No member-with-no-reviews scenario.** All 4 scenarios test positive states. Missing: what does the profile show when a member has no reviews yet? **Recommendation:** Add an empty-state scenario.

**4c. Receive Notifications — No empty or edge states.** All 4 scenarios test notification delivery. Missing: what happens when a user has zero unread notifications? When notifications exceed a display limit? When a notification references a now-deleted listing? **Recommendation:** Add 2 edge/empty-state scenarios.

**4d. Resend verification email — No dedicated test case.** TC-009 mentions "an option to resend the verification email" but this is a side-effect of the expired-token rejection scenario. There is no test case for the actual resend flow: user clicks resend → old token invalidated → new email sent → new token works. **Recommendation:** Add one dedicated resend scenario to US2 Verify Email.

**4e. Self-report abuse not tested.** US26 has 5 scenarios but none tests whether a member can report their own listing. A malicious user could exploit this to suppress competitors. **Recommendation:** Add "Member cannot report their own listing."

**4f. Two REQUESTED reservations for same dates — approve-one-deny-other not explicit.** TC-084 tests the overlap rejection when one is already ACTIVE, and TC-085 tests two non-overlapping approvals. But the case where two REQUESTED reservations exist for the same dates and the owner can only approve one is only implicitly covered. **Recommendation:** Verify coverage or add a scenario: "Owner can only approve one of two overlapping REQUESTED reservations."

**4g. Admin Invites — No non-admin guard test.** The story has 4 scenarios but none tests "Non-admin cannot invite a new member." The admin precondition is assumed. **Recommendation:** Add a 403 guard scenario.

**4h. Admin Tracks Violations — No non-admin guard test.** All 4 scenarios start with "the logged-in user is an admin." Missing: "Non-admin cannot access violation tracking." **Recommendation:** Add a 403 guard scenario.

---

## 5. Scope Risks

| # | Risk | Severity | Stories Affected |
|---|------|----------|-----------------|
| SR1 | **Scheduler-dependent scenarios are hard to test manually.** Auto-cancel (3-day grace), escalation (7-day), and review reminders (3-day) are server-side timers. 11 test cases affected. All now have notes recommending automated testing or clock manipulation. | HIGH | US18, US20, US24 |
| SR2 | **Time-zone dependent tests require server access.** US19 scenarios (TC-112 through TC-117) assume HST behavior. A tester outside Hawaii cannot verify correct normalization without checking server-side timestamps. | MEDIUM | US19 |
| SR3 | **Concurrent submission test (TC-080) requires two simultaneous browser sessions.** "Two borrowers submit overlapping requests at the same time" needs either two testers or automated testing. Marked as "Automated test recommended" in test data. | LOW | US13 |
| SR4 | **Photo upload testing requires prepared test files.** Testers need: valid JPEG (<5MB), oversized file (>5MB), non-image file (.txt), etc. These should be in a shared test-assets folder. | MEDIUM | US8, US9 |
| SR5 | **Email delivery verification requires MailHog or SMTP access.** Invite, verification, password reset, and deletion confirmation emails are all referenced. The test environment must have a working email capture tool. | MEDIUM | Admin Invite, US1, US2, US4, US7 |

---

## 6. Additional Observations

**6a. Test case ID convention is production-quality.** TC-001 through TC-182 for main, TC-IBX-001 through TC-IBX-008 for ICEBOX. Easy to reference in bug reports and trace back to stories.

**6b. "Set Up Profile" and "Edit Profile" share scenario names.** Both have "Display name exceeds maximum length" and "Profile photo upload fails validation." While correct (different stories), testers should be aware these are distinct test cases with different preconditions (new user vs. existing user).

**6c. Some Expected result fields are very long.** TC-030 (Delete Account Scenario 1) has a 522-character Expected result. While thorough, verifying 5-6 separate claims in one assertion is harder for manual testers. Consider splitting into smaller assertions.

**6d. The review story (US24) is exceptionally well-covered.** 9 scenarios spanning the full lifecycle: create, guard conditions, time windows, validation, edit/delete, and reminders. This level of coverage is a model for other stories.

**6e. Notification story Steps could be more actionable.** TC-134, TC-135, TC-136 Steps describe what the SYSTEM does (status changes), not what the TESTER verifies. TC-135 and TC-136 were partially fixed but TC-134 still says "the request is created" rather than "the tester creates a request and checks the owner's notification center."

---

## 7. Recommendations Summary

| Priority | Action | Reference |
|----------|--------|-----------|
| Medium | Add empty-state scenarios for View Reservation History (borrower + owner) | 4a |
| Medium | Add empty-state scenario for View a Member's Review History | 4b |
| Medium | Add empty/edge-state scenarios for Receive Notifications | 4c |
| Medium | Add dedicated "resend verification email" test case | 4d |
| Medium | Add self-report-abuse test case (Member cannot report own listing) | 4e |
| Medium | Add non-admin guard tests for Admin Invites and Admin Tracks Violations | 4g, 4h |
| Medium | Prepare shared test-assets folder with sample images | SR4 |
| Low | Clarify "report" vs "damage report" vs "listing report" terminology | 3a |
| Low | Add scenario-specific test data where value-add | 3b |
| Low | Standardize Steps format as tester actions | 3d |
| Low | Verify TC-080 (concurrent submissions) testability or note as automated-only | SR3 |

---

*This review was conducted from the perspective of Group 1 as informed peer stakeholders. All 182 test cases were examined individually. The Pass/Fail and Actual Result columns are appropriately blank.*
