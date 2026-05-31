# Team Charter — Group 3: Neighborhood Tool Sharing

**Date:** May 28, 2026  
**Course:** ICS 613 — Advanced Software Engineering  
**Instructor:** [Instructor Name]

---

## 1. Team Identity

| Field | Detail |
|---|---|
| Team Name | [TBD — choose as a group] |
| Project | Neighborhood Tool Sharing (Invite-only tool lending platform) |
| Repository | [TBD — one member creates, shares on Discord] |
| Discord Channel | [Instructor creates; pin repo URL] |

## 2. Team Members & Roles

| Member | Email | Primary Role | Secondary Role |
|---|---|---|---|
| Member 1 | [@hawaii.edu] | Frontend Lead | Documentation |
| Member 2 | [@hawaii.edu] | Backend Lead | Messaging/Notifications |
| Member 3 | [@hawaii.edu] | Data & Infrastructure Lead | CI/CD & Deployment |
| Member 4 | [@hawaii.edu] | QA & Integration Lead | Requirements & Meeting Notes |

**Role boundaries are soft.** Everyone writes code across the stack. The "Lead" is the primary reviewer for PRs in that area and the person who knows that subsystem best. Each member will own 6–8 user stories end-to-end (frontend + backend).

**Shared responsibilities (everyone):**
- Write code in feature branches with PRs
- Review at least 1 teammate's PR per sprint
- Attend all standups and meetings
- Write test cases for their own features
- Present their section in all 3 presentations

## 3. Communication Plan

| Channel | Purpose | Expected Response |
|---|---|---|
| Discord (class channel) | All project communication — status updates, blockers, design decisions | Within 4 hours during working hours, within 12 hours otherwise |
| GitHub Issues | Task tracking, bug reports, feature requests | Assign within 24 hours |
| GitHub Pull Requests | Code review requests, merge discussions | Review within 24 hours |
| GitHub Wiki | Persistent documentation (setup guide, API docs, deployment guide) | Maintain as features stabilize |
| Weekly sync meeting | Sprint planning, retro, milestone review | Mandatory attendance |

## 4. Meeting Schedule

| Meeting | Frequency | Duration | Purpose |
|---|---|---|---|
| Standup | Mon / Wed / Fri (async on Discord) | 5 min | What I did, what I'm doing, blockers |
| Sprint planning + retro | Weekly (Sunday evening, TBD) | 30-45 min | Plan next sprint, review last sprint, adjust scope |
| Pre-milestone review | Before each submission | 30 min | Run through grading checklist, verify all deliverables |

**Meeting notes:** Posted to Discord within 24 hours. Archived in the GitHub wiki. Rotate note-taker each week.

## 5. Development Practices

### Git Workflow

```
main ────────────────────────────────── (protected, no direct commits)
  │
  ├── feature/auth-setup ──── PR ── squash merge ──┐
  ├── feature/tool-listing ── PR ── squash merge ──┤
  └── feature/reservation ─── PR ── squash merge ──┘
```

- **Branch naming:** `feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>`
- **Commit messages:** Conventional Commits format — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- **PR requirements:** At least 1 reviewer approval + CI passes before merge
- **Branch protection:** `main` requires PR review + status checks to pass
- **No direct pushes to main — ever.**

### Code Quality

| Tool | What it checks | When it runs |
|---|---|---|
| **ruff** (Python) | Linting + formatting | Pre-commit hook + GitHub Actions on PR |
| **mypy** (Python) | Type checking | GitHub Actions on PR |
| **ESLint** (TypeScript) | Linting | Pre-commit hook + GitHub Actions on PR |
| **Prettier** (TypeScript) | Formatting | Pre-commit hook |
| **pytest** | Unit/integration tests | GitHub Actions on PR |
| **Vitest/Jest** | Frontend unit tests | GitHub Actions on PR |
| **axe-core** | WCAG 2.1 AA accessibility checks | Pre-commit hook + GitHub Actions on PR |

### Accessibility (A11y) Commitment

All frontend components must pass basic WCAG 2.1 AA checks. At minimum:

- All interactive elements are keyboard-navigable (Tab, Enter, Escape)
- All images have meaningful `alt` text
- Form inputs have associated `<label>` elements
- Color contrast ratios meet AA thresholds (4.5:1 for normal text)
- axe-core linting runs in CI; violations block merge

### Definition of Done

Every user story is considered **done** only when ALL of the following are satisfied:

1. **Code:** Written, linted (ruff/ESLint passes), and type-checked (mypy/TypeScript strict passes)
2. **Testing:** Unit tests pass with ≥80% line coverage on new code (backend: pytest-cov; frontend: Vitest coverage)
3. **Documentation:** GitHub Wiki updated with any new API endpoints, environment variables, or setup steps
4. **Peer Review:** At least one non-author teammate has approved the PR — no self-merges
5. **CI Green:** All GitHub Actions checks pass (lint, type-check, test, a11y, Alembic check)
6. **Preview Verified:** Feature confirmed working in the staging/preview environment on Render/Fly.io

Stories that do not meet all 6 criteria stay in the **Review** column — they are not moved to **Done**.

### Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, shadcn/ui or MUI |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL (local via Docker Compose, production via Render/Fly.io) |
| Migrations | Alembic (all schema changes must include a migration script) |
| Auth | JWT-based, invite-only registration |
| CI/CD | GitHub Actions |
| Deployment | Render or Fly.io (free tier) |

### Database Migration Strategy

All schema changes **must** include an Alembic migration script in the same PR. No manual table creation or column alteration in production. Run migrations with:

```bash
cd backend
alembic revision --autogenerate -m "description_of_change"
alembic upgrade head
```

**Rule:** If your PR touches a SQLAlchemy model, it must include the corresponding Alembic migration. The CI pipeline will verify that `alembic check` passes (no un-migrated changes).

### Invite-Only Registration Logic

The invite-only boundary is a core security requirement. Alignment between Backend and Frontend leads is enforced by the following rules:

- **Who can invite:** Only **Admin** users can generate invite tokens. Regular members cannot invite others.
- **Token format:** Each invite is a unique, single-use, expiring token (UUID v4, valid for 7 days). One token = one account. Token is marked as `used` upon successful registration — replay is rejected.
- **Registration flow:** Unauthenticated users land on a registration page. They must provide a valid invite token + required profile fields (name, email, password). Invalid, expired, or already-used tokens return a generic error ("Invalid or expired invite") to prevent enumeration.
- **No public sign-up:** There is no self-registration, no "request invite" form, and no public browsing. Unauthenticated users see only a login page and a registration page (which requires a token).
- **Enforcement:** The Backend Lead owns the `/auth/register` endpoint with these rules implemented as Pydantic validators + database constraints. The Frontend Lead ensures the registration form rejects invalid tokens with a user-friendly message and does not expose the invite token in the URL after form submission (POST body only).

This spec prevents scope creep into a public social network and keeps the project focused on a private, trusted community.

## 6. Decision-Making

- **Technical decisions:** Consensus preferred. If deadlocked after 30 min, the role lead for that area makes the call and documents the rationale.
- **Scope decisions:** Discuss as a team. If the spec says "not production-ready," we err on the side of cutting features over shipping broken ones.
- **Cannot-resolve deadlock:** Escalate to instructor after exhausting team discussion.

## 7. Conflict Resolution

1. Direct conversation between the involved members (within 24 hours of issue arising)
2. If unresolved, bring to the full team at next standup or async on Discord
3. If still unresolved, involve instructor

**Ground rule:** Critique ideas and code, not people. Every review comment must be specific and actionable. If you're frustrated, take 15 minutes before responding.

### PR Review Standards

All code reviews use a standardized three-tier scale to make feedback unambiguous and efficient:

| Label | Meaning | Action Required |
|---|---|---|
| **Nit** | Minor style preference, formatting quirk, or naming opinion. Does not affect correctness. | Author may fix or dismiss. Does not block merge. |
| **Issue** | Small logic flaw, missing test case, unclear variable name, missing error handling, or a gap in the acceptance criteria. | Must be addressed (fix or respond with rationale) before merge. |
| **Blocker** | Security vulnerability, architectural misalignment, broken state machine transition, data integrity risk, or a violation of the Invite-Only boundary defined in Section 5. | Must be resolved before merge. If disputed, escalate to a 15-minute team huddle. |

**Reviewer obligations:**
- Every PR comment must include one of the three labels as a prefix: `nit:`, `issue:`, or `blocker:`.
- Approving a PR means you have reviewed the code and believe it meets the Definition of Done (Section 5).
- If you are the PR author and a reviewer leaves a `blocker:`, do not merge until it is resolved — even if another reviewer approved.

## 8. Time Commitments & Availability

| Member | Typical available hours (HST) | Notes |
|---|---|---|
| Member 1 | [e.g., Mon-Fri 10am-6pm, Sat 12-4pm] | |
| Member 2 | | |
| Member 3 | | |
| Member 4 | | |

**Expected weekly commitment:** 6-10 hours per person. Communicate absences at least 24 hours in advance. If you fall behind, flag it early — don't go silent.

## 9. Deliverables & Deadlines Summary

| Milestone | Due | Weight | Primary Driver |
|---|---|---|---|
| Team + Process Setup | 6/1 & 6/4 | 3% | All (Infra Lead owns repo) |
| Inception Presentation + Requirements Packet | 6/8 | 8% | QA Lead coordinates; everyone writes stories |
| Cross-Team Requirements Review | 6/15 | 4% | QA Lead coordinates |
| Technical Design Document | 7/1 | 7% | Data Lead + Backend Lead drive |
| R1 Demo + Presentation | 7/6–7/9 | 7% | All present their features |
| Manual Test Cases / QA Packet | 7/14 | 4% | QA Lead consolidates |
| R2 Demo + Presentation | 7/27 | 7% | All present |
| Deployment Guide | 8/6 | 3% | Infra Lead drives |
| Final Submission + Presentation | 8/11–8/13 | 9% | All present |
| Individual Contribution | Ongoing | 8% | GitHub activity, reviews, peer eval |

## 10. Signatures

By signing below, each team member agrees to the expectations outlined in this charter.

| Member | Signature (type name) | Date |
|---|---|---|
| Member 1 | | |
| Member 2 | | |
| Member 3 | | |
| Member 4 | | |
