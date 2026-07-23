# **Team Charter / Team Contract**

| Team Name | Group 3 |
| :---- | :---- |
| **Project Name** | Neighborhood Tool Sharing |  |  |
| **Course** | ICS613 | **Semester** | Summer 2026 |

# **1\. Team Purpose**

***The team exists to build a working Neighborhood Tool Sharing web application for the ICS613 course, applying iterative development, automated testing, and GitHub-based collaboration to deliver a secure, invite-only platform that helps neighbors lend and borrow tools safely. The team will practice the full software engineering lifecycle end-to-end: eliciting requirements as user stories and use cases, designing an N-Tier OOP architecture, implementing a complete reservation state machine, and validating the system through unit and integration tests. The project will demonstrate how careful modeling of real-world constraints (no overlapping bookings, owner-approved handoffs, late-return handling, trust through reviews) can be turned into clean, testable code.***

# **2\. Project Scope and Objectives**

## **Project Vision**

***A neighborhood-scale web application where verified members can list tools they are willing to lend, request specific tools for specific date ranges, coordinate pickup and return through a private message thread, and build trust over time through ratings and reviews. The system will make borrowing as easy as browsing a catalog, while protecting both lenders and borrowers through a strict reservation state machine, transparent rules (e.g., a tool's latest return time and notes from the owner), and admin oversight for disputes and policy enforcement.***

## **Goals**

* **Responsive Product Delivery:** Develop and deploy a responsive web application for invite-only neighborhood tool sharing.
* **Implement the full reservation lifecycle:** Build and test the complete state machine — \*\*REQUESTED → APPROVED or DENIED → PICKED\_UP → RETURNED\*\*, plus \*\*CANCELLED\*\* as a terminal off-ramp from REQUESTED or APPROVED — enforcing all the business rules captured in our user stories (borrower cancels, owner approves or denies, borrower confirms pickup and return, owner cannot approve overlapping reservations).  
* **Deliver all user stories end-to-end:** Cover authentication (invite-only registration, email verification, password reset), tool listing management (1–5 photos per listing, category, optional \`latest\_return\_time\` by the return day, optional notes for borrowers), browse and search (filter by category and date range, view owner public profile), reservation request and approval flow, borrower-driven pickup and return confirmation, in-app notifications, reservation message thread, post-return reviews with 1–5 star ratings, and admin tooling to deactivate listings and force-resolve disputes.  
* **Enforce the no-overlap rule and other safety constraints:** Prevent double-booking by checking existing APPROVED or PICKED\_UP reservations before allowing a new REQUESTED reservation on the same date range, and handle the edge cases we documented (cancellation of one of two overlapping requests reverts the other back to REQUESTED; same-borrower double requests; timezone normalization for date comparison).  
* **Practice professional GitHub workflow:** Use feature branches per story, require at least one approving peer review per pull request, link each PR to a GitHub Issue, and track progress on the project board (Backlog → In Progress → In Review → Done) so the team and instructor can see velocity.  
* **Iterative, test-driven delivery:** Write acceptance-criteria-driven tests for each user story, run them in CI, and only mark a story Done when its scenarios pass and the PR is merged.  
* **Iterative Agile Development:** Adopt an iterative workflow aligned with course milestones, maintaining a backlog of 25–30 detailed user stories to ensure transparency and steady incremental progress .

## **In Scope**

* Invitation to join an access-controlled community  
* Account creation  
* Building a user profile

* Listing tools with category (Power Tools, Garden, Kitchen, Ladders, Other)

* Searching tools

* Requesting a tool

* Status changes (REQUESTED, APPROVED, PICKED\_UP, CANCELLED,  RETURNED, or DENIED)

* Double-booking prevention

* Private messages

* Notification for status change

* Review/rating

* Having a member dashboard

* Creating an admin role

* Admin can create reports, disable listings, and deactivate users

## **Out of Scope**

* Discussion functionality among all members (only 1:1 reservation threads are allowed)
* Mobile apps (web only)
* Each non-admin member can suspend other members
* In-app payment processing, deposits, or insurance
* GPS map view, real-time location tracking, or distance-based search
* Member-to-member social features (friend lists, activity feeds, follows)
* SMS or push notifications (in-app notifications only)

# **3\. Team Members and Roles**

| Team Member | Role | Primary Responsibilities | Secondary Responsibilities |
| ----- | ----- | ----- | ----- |
| Rion Sawabe | Project Manager | Planning, managing, and tracking tasks, files and progress, documenting weekly updates  | Frontend development |
| Yafei Wang | Frontend Lead | Responsive design, reusable UI/UX component development, frontend library evaluation, and client-side logic | Documentation and Testing |
| Ivan Wu | Backend Lead | Database schema, Integration, server-side/business logic, API development | Requirements elicitation, Code reviews |
| Nick Fairhart | QA/DevOps Lead | Bug tracking, CI/CD pipeline, deployment, test planning | Backend development |

# **4\. Team Values**

* Respect: Work together with respect towards team members  
* Trust: Believe in team members' ability and foster collaboration  
* Mutual Assistance: Help teammates when they need  
* Growth: Learn new skills and brush up on the skills that we already have  
* Leadership: Each member has a leading role.  Be proud of our own leading role  
* Responsibility: Being responsible for our own tasks (e.g., completing before due)

# **5\. Communication Plan**

| Purpose | Tool / Channel | Notes |
| ----- | ----- | ----- |
| Quick team communication | Discord | Ask for help from other members when needed and provide quick updates |
| Task tracking | GitHub Project Board | Tasks and progress are tracked on the board Task status, Assignees, task descriptions, and due dates are also mentioned |
| Code repository | GitHub (https://github.com/rionhawaii/Group3-ICS613) | At least 1 member should approve the pull request to prevent direct merging into the main branch |
| Meeting notes | Discord/Google Doc | Weekly text-based check-ins. Progress, blockers, and plans will be documented on a Google Doc |
| Documentation and notes | README on GitHub | The project name, its description, tech stack, team members’ names, and how to run it will be noted |

Response expectation: Response is expected within 48 hours, Monday through Friday. If it is impossible, members should mention this on Discord before then, if expected.

We plan to use a weekly text-based Agile methodology since we work online asynchronously. We post each member's completed work from the previous week, any issues or blockers they faced, and what they plan to work on for the upcoming week on Discord every Monday. If anything, such as blockers, help, suggestions, or quick updates, we communicate on a day-to-day basis.

Before the presentation, we may plan to have a live practice session.  

When other documents' deadlines approach, we will provide more frequent updates.

# **6\. Working Agreements**

* Post progress, updates, blockers, or questions every Monday  
* Each member updates their assigned task when they start and complete it  
* Have synchronous meetings before the presentation or any submission is due if needed  
* Each pull request should be reviewed by at least one team member other than the author before it is approved and merged

# **7\. Decision-Making Process**

* First, suggest plans to members on Discord  
* If all agree, we can start using this idea  
* If not, mention why you disagree  
* If members keep disagreeing, ask the professor for advice

# **8\. Development Workflow**

* Weekly text-based sprints  
* Post what each member did in the past week, blockers if they exist, and a new plan every Monday  
* Branches may be created for frontend, backend, or individual features  
* Done means codes reviewed, merged, tested, task status on board should be updated to complete  
* README on GitHub will be upgraded as the project progresses

# **9\. Quality Standards**

* All code must be reviewed through pull requests before merging.  
* All features need frontend unit tests (Vitest), backend unit and integration tests (pytest + pytest-bdd), and end-to-end tests (Playwright) for critical user flows before a PR gets approved 
* Unit and integration tests must pass before merging to main.  
* Code should follow consistent naming conventions and formatting standards.  
* User-facing features must be documented and demonstrated before milestone submissions.

* No secrets or API keys in the repo ever. 

# **10\. Project Artifacts**

* High-level use cases & user stories  
* GitHub repository with project board  
* Technical design doc with architecture diagram and components, list of risks/tradeoffs, technology stack, key API endpoints, and data model  
* Presentation slides  
* Weekly Sprint Updates  
* Requirements Review Report
* Use Case Review Report (gap analysis and resolution log)
* Deployment Guide
* Domain model  
* Test Case Documentation

# **11\. Conflict Resolution and Accountability**

* Tell immediately when a conflict happens with team members  
* Discussing and finding the cause of conflict  
* Thinking of the solution with the entire team  
* Ask the instructor’s advice to solve the conflict

# **12\. Risks and Mitigation**

* No response within 48 hours: If there is at least a small chance that members can not check or respond within 48 hours, notify other members beforehand

* Project schedule risks (e.g., too many tasks, too few tasks, or tasks not well identified): Team members discuss required functionalities and tasks, and agree on task assignments for each sprint

* Getting stuck longer:  Ask team members for help  
* Tech stack incompatibility: Check the versions and compatibility of each stack before integration

# **13\. Milestones and Timeline**

| Milestone | Target Date | Owner(s) | Notes |
| ----- | ----- | ----- | ----- |
| Team Charter Sheet Submission  | 6/4  | Project manager | Write team rules, roles, responsibilities, values, workflow, etc |
| Inception Presentation & Core Requirements | 6/8 (Submission) 6/9 (Presentation) | All members | Explain our project goals, scopes, user roles/personas, acceptance criteria/edge cases, project management overview, risks and ways to mitigate, project artifacts, quality assurance plan,  and milestones |
| Requirements Review Presentation | 6/15 (Submission) 6/16 (Presentation) | All members | Review other teams’ project requirements. This should include review for user stories, acceptance criteria, user roles/personas, open questions & assumptions, and known risks |
| Technical Design Document Submission | 7/1 | Frontend Lead / Backend Lead | Create a design documentation containing architecture diagram \+ components, technology stack (with frameworks and libraries), data model, list of risks/tradeoffs, and API endpoints. Details about code quality tools that we will use have to be explained as well |
| R1 Presentation  | 7/6 (Submission) 7/7 (Presentation) | All members | Demonstration & Presentation |
| Test cases for manual testing Submission | 7/14 | QA Lead | Create test cases before due date |
| R2 Presentation | 7/27 (Submission) 7/28 (Presentation) | All members | Demonstration & Presentation |
| Deployment Guide Submission | 8/6 | All members | Create a document that explains the features, risks,  limitations, and detailed guide for deployment.  |
| Final Submission | 8/11 | Project manager | Submit documents,  final presentation slides, and codes |
| Final Presentation | 8/13 | All members | Showcase our final deliverable to the class |

# 

# **14\. Team Commitment Statement**

We, the members of this team, agree to contribute consistently, communicate professionally, and support one another in completing this project successfully. We understand that this course evaluates not only the final software product, but also the engineering process used to create it. We therefore commit to maintaining strong collaboration, clear documentation, responsible project management, and high standards of technical work throughout the semester.

# 

# **15\. Signatures**

| Name | Signature / Acknowledgment | Date |
| ----- | ----- | ----- |
| Rion Sawabe | Rion Sawabe | 05/31/2026 |
| Yafei Wang | Yafei Wang | 06/01/2026 |
| Ivan Wu | [Ivan Wu](mailto:ivanw@hawaii.edu) | 05/31/2026 |
| Nick Fairhart | Nick Fairhart | 6/1/26 |

