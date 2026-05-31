# Sprint 1 — Issue Breakdown (Due 6/1 → 6/8)

**Sprint goal:** Establish team infrastructure, define the requirements, and prepare the inception presentation.

---

## Sprint 1a: Team + Repo Foundation (Due 6/1)

### Issue #1: Finalize team charter and sign off
**Assigned to:** All (QA Lead coordinates)  
**Labels:** `docs`, `setup`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 1 hour (meeting)

**Description:**
- Review the draft charter in `docs/Team_Charter.md`
- Fill in: team name, member names/emails, availability
- Agree on weekly sync time
- Each member signs (types name in the table)
- Push to repo under `docs/`

**Acceptance Criteria:**
- All fields completed
- All 4 signatures
- Charter committed to repo

---

### Issue #2: Create GitHub repository
**Assigned to:** Infra Lead  
**Labels:** `setup`, `infra`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 30 min

**Description:**
- Create a new **public** repository: `ics613-neighborhood-tool-sharing`
- Add all 3 teammates as collaborators (Admin access)
- Create initial README.md stub with project name, team members, and tech stack
- Pin the repo URL in the class Discord project channel

**Acceptance Criteria:**
- Repo exists with all members as collaborators
- README has project name and team info
- Repo URL posted in Discord

---

### Issue #3: Configure branch protection on main
**Assigned to:** Infra Lead  
**Labels:** `setup`, `infra`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 20 min

**Description:**
- Settings → Branches → Add rule for `main`
  - Require a pull request before merging
  - Require approvals (1 minimum)
  - Require status checks to pass before merging
  - Do not allow bypassing
- Dismiss stale pull request approvals when new commits are pushed

**Acceptance Criteria:**
- Direct push to main is rejected
- PR must have 1 approval + CI pass to merge

---

## Sprint 1b: Dev Environment + Project Board (Due 6/4)

### Issue #4: Set up project board on GitHub
**Assigned to:** QA Lead  
**Labels:** `setup`, `project-management`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 30 min

**Description:**
- Create a GitHub Project (Kanban view) with columns:
  - **Backlog** — un-prioritized stories/ideas
  - **To Do** — prioritized for current sprint
  - **In Progress** — actively being worked
  - **Review** — PR open, waiting for approval
  - **Done** — merged and closed
- Create initial labels: `bug`, `feature`, `docs`, `test`, `setup`, `frontend`, `backend`, `database`, `infra`, `P0` (critical), `P1` (important), `P2` (nice-to-have)
- Link the project board in the README

**Acceptance Criteria:**
- Board has all 5 columns
- Labels created
- Board link in README

---

### Issue #5: Scaffold project structure (monorepo)
**Assigned to:** Frontend Lead + Backend Lead (pair)  
**Labels:** `setup`, `frontend`, `backend`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 2 hours

**Description:**
Initialize the monorepo with:

**Frontend (`/frontend/`):**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```
- Add `eslint`, `prettier`, and the team-chosen UI library (shadcn/ui or MUI)
- Set up `.eslintrc.cjs` and `.prettierrc`
- Create a placeholder `App.tsx` rendering "Neighborhood Tool Sharing"

**Backend (`/backend/`):**
```bash
mkdir backend && cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic alembic
```
- Create `main.py` with a health-check endpoint: `GET /api/health → {"status": "ok"}`
- Create `requirements.txt` (pinned)
- Set up `ruff` and `mypy` config in `pyproject.toml`

**Root:**
- Create `docker-compose.yml` with PostgreSQL service
- Create `.gitignore` (venv, node_modules, .env, __pycache__, *.pyc)
- Create `.github/workflows/ci.yml` stub

**Acceptance Criteria:**
- `cd frontend && npm run dev` starts dev server
- `cd backend && uvicorn main:app --reload` serves health check
- `docker compose up` starts PostgreSQL
- Pre-commit hooks configured (lint + format for both stacks)

---

### Issue #6: Set up CI pipeline (GitHub Actions)
**Assigned to:** Infra Lead  
**Labels:** `setup`, `infra`, `ci`  
**Milestone:** Team + Process Setup  
**Estimated effort:** 1.5 hours

**Description:**
Create `.github/workflows/ci.yml` that runs on every PR to `main`:

**Backend checks:**
- `ruff check .` (lint)
- `mypy .` (type check, initially lenient)
- `pytest` (runs any tests found)

**Frontend checks:**
- `npm run lint` (ESLint)
- `npm run format -- --check` (Prettier)
- `npm run test` (Vitest)

**Acceptance Criteria:**
- CI runs on PR open and new commits
- Failing checks block merge (enforced by branch protection from Issue #3)
- Placeholder test (`test_health.py`) passes in CI

---

## Sprint 1c: Requirements & Inception (Due 6/8)

### Issue #7: Define user roles & personas
**Assigned to:** All (QA Lead consolidates)  
**Labels:** `docs`, `requirements`  
**Milestone:** Inception Presentation  
**Estimated effort:** 1 hour (group session)

**Description:**
Identify all user roles in the system and create 1 persona per role:

| Role | Description | Example Persona |
|---|---|---|
| **Guest** | Unauthenticated user on the landing page. Cannot browse tools. | — |
| **Member** | Invited user who can list tools, browse, request reservations | "Alice, 34, homeowner with a garage full of tools" |
| **Tool Owner** | Same as Member when acting on their own listings | — |
| **Borrower** | Same as Member when requesting others' tools | — |
| **Admin** | Can suspend users, deactivate listings, view reports | "Site moderator for the neighborhood" |

Document in `docs/requirements/user_roles.md`.

**Acceptance Criteria:**
- All 5 roles defined with permissions
- At least 3 detailed personas
- Document committed to repo

---

### Issue #8: Map core use cases and workflows
**Assigned to:** Backend Lead + Frontend Lead  
**Labels:** `docs`, `requirements`  
**Milestone:** Inception Presentation  
**Estimated effort:** 1.5 hours

**Description:**
Document the core workflows as use case diagrams (PlantUML or Mermaid in markdown) and text descriptions:

**Primary flow (happy path):**
1. Admin generates invite → sends to neighbor
2. Member registers with invite → logs in → creates profile
3. Member lists a tool (drill, photo, condition, loan rules)
4. Another member browses → finds tool → requests reservation (date range)
5. Owner receives notification → approves
6. Borrower picks up → system marks PICKED_UP
7. Borrower returns → system marks RETURNED
8. Both leave ratings/reviews

**Error flows to capture:**
- Registration with invalid/expired invite
- Double-booking attempt (overlapping APPROVED/PICKED_UP)
- Cancellation after PICKED_UP (must be rejected)
- Non-owner trying to approve/deny

Document in `docs/requirements/core_use_cases.md`.

**Acceptance Criteria:**
- Happy path flowchart complete
- At least 4 error-path flows documented
- All state transitions of the reservation state machine enumerated

---

### Issue #9: Write 25–30 user stories with acceptance criteria
**Assigned to:** All (4 members × 7 stories each = 28)  
**Labels:** `docs`, `requirements`, `P0`  
**Milestone:** Inception Presentation  
**Estimated effort:** 3 hours (individual) + 1 hour (review session)

**Description:**
Each member owns 7 stories from one epic. Use the standard format:

```
As a <role>, I want to <action> so that <value>.

Acceptance Criteria:
Scenario 1: <happy path>
Given <precondition>
When <action>
Then <expected result>

Scenario 2: <edge/error case>
...
```

**Epic distribution:**

| Epic | Owner | Stories | Example Stories |
|---|---|---|---|
| **Auth & Profiles** | QA Lead | 7 stories | Invite registration, login, profile edit, password reset, invite token validation, invite generation (admin), account deactivation |
| **Tool Management** | Frontend Lead | 7 stories | Create listing, upload photo, edit listing, delete listing, browse tools, search/filter, view tool detail |
| **Reservation Flow** | Backend Lead | 7 stories | Request reservation, approve/deny, mark picked up, mark returned, cancel, double-booking prevention, view reservation history |
| **Social & Admin** | Infra Lead | 7 stories | Send message in reservation thread, view notifications, leave rating/review, admin suspend user, admin deactivate listing, admin dashboard/reports, member dashboard |

**Acceptance Criteria:**
- 25–30 stories total
- Each story has ≥2 scenarios (happy + edge/error)
- All reservation state transitions covered
- All permissions enforced (owner-only actions, admin-only actions)
- Cross-reviewed by at least 1 teammate

---

### Issue #10: Document assumptions, risks, and scope boundaries
**Assigned to:** QA Lead (draft) → All (review)  
**Labels:** `docs`, `requirements`, `risk`  
**Milestone:** Inception Presentation  
**Estimated effort:** 1 hour

**Description:**
Create `docs/requirements/assumptions_and_risks.md`:

**Assumptions (what we're assuming without verification):**
- Users have reliable internet and modern browsers
- Photos are stored as URLs (no CDN/upload pipeline needed)
- Email notifications are out of scope (in-app notifications only)
- One invite token = one account (one-time use)
- Tools are physical items picked up in person (no shipping)

**Risks & Mitigation:**

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Reservation state machine edge cases are complex | Medium | High | Implement state machine as a dedicated Python class with exhaustive unit tests before building UI |
| Team member availability drops during summer | Medium | High | Cross-train: everyone knows basic frontend + backend; no single point of failure |
| Free-tier deployment limits (DB connections, memory) | Medium | Medium | Choose Render/Fly.io with known free-tier limits; keep schema simple |
| Scope creep on "nice-to-have" features | High | Medium | Label all stories P0/P1/P2; P2 stories blocked behind P0 completion |

**Out of scope (explicit):**
- Real-time chat (basic message thread only)
- Email/SMS notifications (in-app only)
- Payment processing
- Identity verification beyond invite token
- Mobile native app

**Acceptance Criteria:**
- ≥5 assumptions documented
- ≥4 risks with mitigation strategies
- Clear "out of scope" list

---

### Issue #11: Prepare inception presentation slides
**Assigned to:** All (each member prepares their section)  
**Labels:** `docs`, `presentation`, `P0`  
**Milestone:** Inception Presentation  
**Estimated effort:** 2 hours (individual) + 1 hour (rehearsal)

**Description:**
Create a shared Google Slides deck. Each member presents their section. The spec requires:

| Section | Presenter | Slides |
|---|---|---|
| Project objectives & value | Anyone | 1-2 |
| Project scope (in/out) | QA Lead | 1-2 |
| User roles/personas | QA Lead | 2-3 |
| Key use cases & user stories | All (by epic) | 6-8 |
| Acceptance criteria highlights | Backend Lead | 1-2 |
| Project management (roles, meetings, tracking) | Infra Lead | 2-3 |
| Key risks & mitigation | QA Lead | 1-2 |
| Project artifacts (docs, tools) | Frontend Lead | 1 |
| Quality assurance plan | Infra Lead | 1 |
| Milestones & next steps | All | 1 |

**Acceptance Criteria:**
- All sections covered per the spec's "At a minimum" list
- Each member presents roughly equal number of slides
- One dry-run rehearsal before presentation day
- Slides committed/linked in repo under `docs/presentations/`

---

## Sprint 1 Summary

| Issue | Who | Effort | Deadline | Labels |
|---|---|---|---|---|
| #1 Finalize charter | All | 1h | 6/1 | `docs`, `setup` |
| #2 Create repo | Infra Lead | 30m | 6/1 | `setup`, `infra` |
| #3 Branch protection | Infra Lead | 20m | 6/1 | `setup`, `infra` |
| #4 Project board | QA Lead | 30m | 6/4 | `setup`, `project-management` |
| #5 Scaffold project | Frontend + Backend | 2h | 6/4 | `setup`, `frontend`, `backend` |
| #6 CI pipeline | Infra Lead | 1.5h | 6/4 | `setup`, `infra`, `ci` |
| #7 User roles & personas | All | 1h | 6/8 | `docs`, `requirements` |
| #8 Core use cases | Backend + Frontend | 1.5h | 6/8 | `docs`, `requirements` |
| #9 User stories (28) | All | 4h | 6/8 | `docs`, `requirements`, `P0` |
| #10 Assumptions & risks | QA Lead → All | 1h | 6/8 | `docs`, `requirements`, `risk` |
| #11 Inception slides | All | 3h | 6/8 | `docs`, `presentation`, `P0` |

**Total estimated effort per person:** ~4.5 hours (Sprint 1a+1b) + ~5.5 hours (Sprint 1c) = ~10 hours over ~10 days.

---

## Immediate Next Actions (Before First Standup)

1. **Infra Lead:** Create the GitHub repo NOW. Add everyone. Post link to Discord.
2. **Everyone:** Clone the repo. Verify you can push to a branch.
3. **Everyone:** Install Docker Desktop (or Podman) so you can run PostgreSQL locally.
4. **QA Lead:** Schedule the first weekly sync (Sunday or Monday, pick in Discord poll).
5. **All:** Read through this issue list and claim your assignments from the epic distribution in Issue #9.
