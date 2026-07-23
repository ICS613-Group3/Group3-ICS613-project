# User Stories v5 — Revision Recommendation Plan

**Prepared for:** Group 3 — Rion Sawabe (PM), Ivan Wu (Backend Lead), Nick Fairhart (QA/DevOps), Yafei Wang (Frontend Lead), Loreto Coloma  
**Date:** June 18, 2026  
**Status:** ⬜ Pending Team Approval  

---

## Purpose

This document proposes targeted revisions to `RequirementPackets(Group3).md` based on three inputs:

1. **Group 1 peer review feedback** — `Group3 - Improving User Stories based on Feedback.md`
2. **Frontend review** — `Frontend-Related User Story Review Notes.docx`
3. **Developer architecture review** — efficiency, DRY, and scope control analysis

Each change is tagged with its source so the team can weigh it appropriately.

### Source Legend

| Tag | Meaning |
|-----|---------|
| `[G1]` | Directly from Group 1 peer review feedback |
| `[FE]` | From Frontend-Related User Story Review Notes |
| `[BE]` | Backend architecture analysis (efficiency, avoid duplication, scope control) |

---

## Part 1 — Global Architecture Rules

*Apply once, affect all stories. These remove the need to repeat the same criteria in 15+ individual stories.*

---

### 1.1 — Global Authentication Enforcement Rule `[BE]`

**Problem**  
Group 1 noted 18 user stories missing unauthenticated-access checks. Adding a "401 Unauthorized" scenario to every story is repetitive and bloats the document.

**Recommendation**  
Add a single global rule at the top of the User Stories section:

```
Unless explicitly stated otherwise, all member actions and API endpoints
(except Login, Register, and Forgot Password) require a valid active session.
Unauthenticated requests globally return 401 Unauthorized and redirect to
the login page.
```

**Impact**  
Removes the need for individual unauthenticated-access scenarios across ~16 stories.

---

### 1.2 — Guest / Unregistered Visitors: No Access to Listings `[G1] + [BE]`

**Problem**  
Group 1 flagged the Guest role as ambiguous — can guests browse tool listings? The current document defines a Guest role in the Roles/Personas section with vague wording about "limited access, such as viewing general information about the platform."

There is **no numbered user story** (US1–US34) with guest-specific acceptance criteria — only an example user story connection:

> *"As a Guest, I want to understand how the neighborhood tool-sharing platform works so that I can decide whether to register."*

Guest browsing is inappropriate for this application for three reasons:

1. **Physical security** — Tool listings reveal what valuable equipment sits in which neighbor's garage. Reservation dates leak when someone is home or away.
2. **Trust model** — "I lend to verified neighbors I know." If anyone can browse, the trust boundary blurs before registration.
3. **No organic discovery** — Users don't find this app; they receive an invite from an admin who already knows them. No need to lure strangers with a preview.

**Recommendation**

1. **Remove** the example guest user story connection — it implies guest browsing and contradicts the invite-only model.
2. **Rewrite** the Guest role description:

```
Guest/Unregistered Visitors see only a public landing page stating the
platform is private and invite-only. They may register if they possess a
valid invite token, or log in if they already have an account. No tool
listings, member profiles, reservation data, or any other application
content is visible without authentication.
```

3. **Note:** The seven existing "not logged in" negative scenarios (US5, US6, US8, US9, US10, US17, US26) are generic 401 checks, not guest browsing features. They are already covered by item 1.1 and can be cleaned up during v5 revision.

**Impact**  
No partial-permission views, no guest authorization role, no mixed-visibility UI. Everything sits behind the login wall. Removes one misleading example story.

---

### 1.3 — Lock Down Direct Messaging Scope `[G1]`

**Problem**  
The Member role description says "Communicate clearly with other members when needed." This could be interpreted as general-purpose direct messaging, which would require a separate chat subsystem — far beyond scope.

**Recommendation**  
Add a constraint to the Roles section:

```
Member-to-member messaging is available ONLY within the context of an
active reservation thread (REQUESTED, APPROVED, or PICKED_UP). There is
no general-purpose direct messaging feature.
```

**Impact**  
Prevents scope creep into a full messaging platform. Matches the Course Project requirement of "private message thread for coordination."

---

### 1.4 — Consolidate Listing Statuses: HIDDEN → DEACTIVATED `[G1] + [FE]`

**Problem**  
US27 and US29 use both `DEACTIVATED` and `HIDDEN` listing statuses without defining the difference. This causes database schema confusion and inconsistent frontend behavior.

**Recommendation**  
Use a single status — `DEACTIVATED` — for all cases where a listing is removed from member search results. Search/replace all instances of `HIDDEN` with `DEACTIVATED`.

```
A DEACTIVATED listing is hidden from member search and browse results
but retains its past reservation history and is visible to admins.
```

**Impact**  
One less database enum, one less frontend conditional branch.

---

## Part 2 — Missing Core Functionality

*Must add. These close gaps that would block implementation.*

---

### 2.1 — Add "Admin Invites New Member" Story (One-Click) `[G1]`

**Problem**  
US1 covers registration *with* an invite token, but no story defines who creates the tokens or how they reach new members. Without this, the backend has an incomplete token lifecycle and the admin workflow is undefined.

**Recommendation**  
Add a new Admin user story. The original gap only covers token generation with manual copy-paste. Since the app already requires SMTP for US1/US2 (verification) and US4 (password reset) — see 4.5 — we can improve the workflow to **one-click: admin enters email, system generates token and auto-sends the invite email**. No extra infrastructure cost.

```
User Story X — Admin Invites a New Member
As an admin, I want to invite a new member by entering their email so that
the system generates a unique invite token and emails it to them automatically.

Scenario 1: Admin invites a new member (one-click)
  Given the logged-in user is an admin.
  When the admin enters the new member's email address and clicks Invite.
  Then a unique invite token is generated and linked to that email.
  And an invite email is automatically sent to that address with the
    registration link containing the token.
  And the admin sees the invite in the invite list with status "sent".

Scenario 2: Admin views all invites and their status
  Given the logged-in user is an admin.
  When the admin views the invite management page.
  Then the admin sees all invites with status (sent, used, expired, revoked)
    and the associated member if registered.

Scenario 3: Admin revokes an unused invite
  Given the logged-in user is an admin.
  And an invite is unused and not expired.
  When the admin revokes the invite.
  Then the invite is marked as revoked and the token can no longer be used.
```

**Impact**  
Closes a critical gap — US1 is impossible to build without this. No new infrastructure needed; reuses the same SMTP config as verification emails.

---

### 2.2 — Add Logout Scenario to US3 `[G1] + [FE]`

**Problem**  
US3 title says "log in and out" but only covers login behavior. The frontend has no acceptance criteria for the logout button.

**Recommendation**  
Add to US3:

```
Scenario 4: Log out
  Given the logged-in user has an active session.
  When the user clicks Log Out.
  Then the session token is invalidated.
  And the user is redirected to the login page.
  And protected member pages are no longer accessible without logging in again.
```

**Impact**  
Gives frontend a clear session-termination contract.

---

## Part 3 — Ambiguity & Redundancy Fixes

*Clean up confusing or duplicate scenarios.*

---

### 3.1 — US9 & US10: Consolidate Redundant Scenarios `[G1]`

**Problem**  
US9 has two scenarios (1 and 3) that both verify "listing can be edited when no PICKED_UP reservation exists." US10 Scenario 5 duplicates Scenario 3.

**Recommendation**

| Story | Action |
|-------|--------|
| US9 | Merge Scenario 3 into Scenario 1 — add precondition: "And the listing has no PICKED_UP reservation" |
| US10 | Remove Scenario 5 (covered by Scenario 3) |

**Impact**  
Reduces duplicate testing effort.

---

### 3.2 — US11: Clarify Admin Deactivation Precondition `[G1] + [FE]`

**Problem**  
Scenario 1 allows deactivation of any ACTIVE listing. Scenario 2 then blocks deactivation when PICKED_UP. The rules are contradictory.

**Recommendation**  
Update Scenario 1:

```
Given an ACTIVE tool listing exists.
And the tool has no active PICKED_UP reservation.
And the logged-in user is an admin.
When the admin deactivates the listing with a reason…
```

**Impact**  
Admin UI always has one clear rule to check.

---

### 3.3 — US12 & US25: Move "View Public Profile" `[G1] + [FE]`

**Problem**  
US12 Scenario 6 (view another member's public profile) does not belong in a tool-browsing story.

**Recommendation**  
Move Scenario 6 from US12 to US25 (or create a dedicated "View Member Public Profile" story). US12 should remain focused purely on tool search, filter, and browse.

**Impact**  
Keeps frontend component responsibility boundaries clean.

---

### 3.4 — US13: Remove Redundant Non-Overlap Scenario `[G1] + [FE]`

**Problem**  
US13 Scenario 5 ("Non-overlapping reservations on the same tool are permitted") is already implied by Scenario 1, which states the tool must have no overlapping reservations.

**Recommendation**  
Remove Scenario 5. The behavior is already verified by Scenario 1 and the overlap-rejection scenario.

**Impact**  
One less test case.

---

### 3.5 — US14 & US16: Separate Owner Actions by Reservation State `[G1] + [FE]`

**Problem**  
Owner denial behavior appears in both US14 and US16, creating confusion about which story owns the approve/deny workflow.

**Recommendation**  
Add clarifying notes and update scenario wording:

| Story | Responsibility |
|-------|---------------|
| US14 | Owner approves or denies a **REQUESTED** reservation |
| US16 | Owner cancels an already **APPROVED** reservation (post-approval cancellation) |

**Impact**  
Frontend routing and owner dashboard action buttons have unambiguous target states.

---

### 3.6 — US15: Add Owner Notification on Borrower Cancellation `[G1] + [FE]`

**Problem**  
US16 notifies borrowers when owners cancel, but US15 does not notify owners when borrowers cancel. Asymmetrical — owners will be confused.

**Recommendation**  
Add to US15 cancellation scenarios:

```
And the owner receives an in-app notification that the reservation was
cancelled by the borrower.
```

**Impact**  
Both parties stay informed; owner dashboard stays accurate.

---

### 3.7 — US17: Clarify Pickup Timestamp Visibility `[G1] + [FE]`

**Problem**  
Pickup timestamp is recorded but its visibility (borrower? owner? admin? internal?) is undefined. Owner acknowledgment of pickup is also ambiguous.

**Recommendation**  
Add to pickup confirmation scenario:

```
And the pickup timestamp is visible on the reservation details page to
the borrower, owner, and admin.

The borrower confirms pickup unilaterally (owner acknowledgment is not
required); the owner receives a notification that pickup was confirmed.
```

**Impact**  
No extra owner-confirmation UI needed. Clear visibility contract for all parties.

---

### 3.8 — US20: Prevent Duplicate Reports `[G1]`

**Problem**  
No scenario prevents a user from submitting multiple reports for the same reservation (spam/abuse vector).

**Recommendation**  
Add a negative scenario:

```
Scenario X: Duplicate report on same reservation is rejected
  Given the logged-in user has already submitted an unresolved report
    for a specific reservation.
  When the user attempts to submit another report for the same reservation.
  Then the system rejects the submission.
  And a message says a report has already been filed for this reservation.
```

**Impact**  
Prevents report spam and duplicate admin review work.

---

### 3.9 — US26: Block Reports on Non-Existent / Deactivated Listings `[G1] + [FE]`

**Problem**  
No scenario prevents a member from reporting a listing that doesn't exist or is already deactivated.

**Recommendation**  
Add a negative scenario:

```
Scenario X: Report on non-existent or deactivated listing is rejected
  Given the logged-in user is a member.
  When the user attempts to report a listing that does not exist,
    is already DEACTIVATED, or belongs to a deleted account.
  Then the system rejects the report.
  And a message says the listing is not available for reporting.
```

**Impact**  
Prevents confusing frontend states and invalid admin review queue entries.

---

### 3.10 — US30: Prevent Suspending Already-Suspended Users `[G1]`

**Problem**  
No scenario checks the edge case of suspending a user who is already suspended.

**Recommendation**  
Add a negative scenario:

```
Scenario X: Cannot suspend an already-suspended member
  Given the logged-in user is an admin.
  And a member account is already in SUSPENDED status.
  When the admin attempts to suspend the member again.
  Then the system rejects the action.
  And a message says the member is already suspended.
```

**Impact**  
Prevents duplicate suspension records and confusing account states.

---

## Part 4 — Scope Reductions

*Save development time by simplifying over-engineered stories.*

---

### 4.1 — US4 (Password Reset): Keep as-is `[G1]`

**Problem**  
Group 1 flagged US4 as a scope risk due to custom email token logic.

**Recommendation**  
Keep US4 as-is. The SMTP infrastructure is already required for US1/US2 verification emails (see 4.5), so password-reset emails add no new infrastructure — only the token lifecycle code.

**Impact**  
~1 day of backend token logic (generate, store, expire, validate). No separate email setup needed.

---

### 4.2 — US19 (Timezone): Simplify to Static HST `[G1] + [BE]`

**Problem**  
Dynamic timezone normalization across user locations adds date-handling complexity for no benefit — the app serves one neighborhood.

**Recommendation**  
Rewrite US19:

```
Revised US19
As the system, I want all reservation dates and times stored in UTC and
displayed in Hawaii Standard Time (HST, UTC-10) so that all members see
consistent reservation windows.

The application converts user-entered dates/times from HST to UTC for
storage, and converts UTC back to HST for display. No per-user timezone
detection is required.
```

**Impact**  
Removes timezone-detection libraries, per-user preferences, and related edge cases. Simple UTC ↔ HST conversion only.

---

### 4.3 — US28 (Admin Tool Rules): Simplify to Category Dropdown `[G1] + [BE]`

**Problem**  
Managing separate allow and deny lists with CRUD admin UI is over-engineered.

**Recommendation**  
Replace US28 with:

```
Revised US28 — Admin Manages Tool Categories
As an admin, I want to manage the list of allowed tool categories so
that members can only list approved types of tools.

The system maintains a single list of allowed categories (e.g., "Power
Tools", "Garden", "Kitchen", "Ladders", "Other"). When creating a listing,
the member selects from this dropdown. If a category is not in the list,
it cannot be added — implicitly denying unlisted tool types. Admins can
add or remove categories from this list.
```

**Impact**  
Two database tables → one. Complex rule engine → simple admin CRUD page.

---

### 4.4 — US33 (Moderation Reports): Restrict Export to CSV Only `[G1]`

**Problem**  
US33 Scenario 2 says "export data in supported format" without specifying the format. PDF, Excel, and HTML export would each add significant scope.

**Recommendation**  
Explicitly restrict to CSV:

```
Scenario 2: Export report data as CSV
  Given the admin is viewing a report.
  When the admin clicks Export.
  Then the data is downloaded as a .csv file whose contents match the
    on-screen data.
  And the CSV includes column headers matching the report columns.
```

**Impact**  
CSV export uses standard library only. No PDF/XLSX/HTML templating.

---

### 4.5 — Dev Setup: Per-Developer Gmail for Email Sending `[BE]`

**Problem**  
US1/US2 (verification), US4 (password reset), and US7 (deletion confirmation) all send emails. Each team member needs their own SMTP sender for local development and testing.

**Recommendation**  
Each team member creates their own Gmail account as the system sender for their local environment. Credentials go into the personal `.env` file — never committed to the repo.

| Step | Action |
|------|--------|
| 1 | Create a Gmail account (e.g., `yourname-ics613@gmail.com`) |
| 2 | Enable 2-Factor Authentication |
| 3 | Generate an App Password (Google Account → Security → App Passwords) |
| 4 | Add to your local `.env` file |

```
# .env (each team member's own, never committed to git)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourname-ics613@gmail.com
SMTP_PASSWORD=<your-16-character-app-password>
```

Each team member uses a **different email address** (their regular email) as the recipient when testing — register with `yourname@hawaii.edu` and the verification email arrives there from your sender account.

**Impact**  
~5 minutes per person. No shared credentials, no shared inbox, no risk of one person's test emails going to another's inbox. Each developer controls their own SMTP independently.

---

## Summary

| # | Change | Source | Priority | Decision |
|---|--------|--------|----------|----------|
| 1.1 | Global authentication rule | `[BE]` | High | Approve |
| 1.2 | Guest visitors: no access to listings | `[G1] + [BE]` | High | Approve |
| 1.3 | Lock messaging to reservation threads | `[G1]` | High | Approve |
| 1.4 | Consolidate HIDDEN → DEACTIVATED | `[G1] + [FE]` | High | Approve |
| 2.1 | Add Admin Invites Member story (one-click, auto-email) | `[G1]` | **Critical** | Approve |
| 2.2 | Add Logout scenario to US3 | `[G1] + [FE]` | High | Approve |
| 3.1 | Consolidate US9/US10 redundant scenarios | `[G1]` | Medium | Approve |
| 3.2 | Clarify US11 admin deactivation rule | `[G1] + [FE]` | High | Approve |
| 3.3 | Move US12 Scenario 6 to US25 | `[G1] + [FE]` | High | Approve |
| 3.4 | Remove US13 redundant non-overlap scenario | `[G1] + [FE]` | Medium | Approve |
| 3.5 | Separate US14/US16 by reservation state | `[G1] + [FE]` | Medium | Approve |
| 3.6 | Add owner notification to US15 | `[G1] + [FE]` | High | Approve |
| 3.7 | Clarify US17 pickup timestamp visibility | `[G1] + [FE]` | High | Approve |
| 3.8 | US20 prevent duplicate reports | `[G1]` | Medium | Approve |
| 3.9 | US26 block reports on deactivated listings | `[G1] + [FE]` | Medium | Approve |
| 3.10 | US30 prevent double-suspension | `[G1]` | Low | Approve |
| 4.1 | US4 password reset: keep as-is | `[G1]` | Medium | Approve |
| 4.2 | US19 simplify to static HST | `[G1] + [BE]` | High | Approve |
| 4.3 | US28 simplify to category dropdown | `[G1] + [BE]` | High | Approve |
| 4.4 | US33 restrict export to CSV only | `[G1]` | High | Approve |
| 4.5 | Dev setup: per-developer Gmail for email | `[BE]` | High | Set up |

---

## Team Sign-Off

| Member | Role | Approved | Notes |
|--------|------|:--------:|-------|
| Rion Sawabe | PM | ☐ | |
| Ivan Wu | Backend Lead | ☐ | |
| Nick Fairhart | QA/DevOps | ☐ | |
| Yafei Wang | Frontend Lead | ☐ | |
| Loreto Coloma | Member | ☐ | |

---

**Next Step:** Once all members approve (or request changes), the document owner will apply these changes to `RequirementPackets(Group3).docx` and publish it as **v5 (Final)**.
