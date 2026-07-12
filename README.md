# Team Name

Group 3

​

# Project Title

Neighborhood Tool Sharing

​

# Description

This is an ICS613 Group 3 project in Summer 2026. We will collaborate to create a responsive full-stack web application. This web application enables an invite-only tool lending for members only. User accounts can be created with a valid invitation from other members. New users can make a profile and list tools. Tools can be posted with images, descriptions, condition, and, if necessary, customized lending rules. Listed tools are searched for and requested to be lent. The tool status can be updated (e.g., REQUESTED, APPROVED, PICKED_UP, RETURNED, or CANCELLED). Private messages and notifications will be enabled under each reservation. A rating/review will be added after lending ends. Admin users can inactivate lists and users.

​

# Team members & Roles/Responsibilities
​This is our team member list, along with their primary roles and secondary responsibilities.
- Rion Sawabe - Project Manager/Frontend development
- Yafei Wang - Frontend Lead/Documentation and Testing
- Ivan Wu - Backend Lead/Requirements elicitation and code reviews
- Nick Fairhart - QA/DevOps Lead/Backend development
- Loreto Coloma - Document Lead



# Main branch protection rule

The main branch is protected against direct pushing. At least 1 member should review and approve the pull request. 

​

# Workflow

We will use an Agile workflow. Each member posts on Discord every Monday about what they did in the past week, any blockers, and what they plan to do in the upcoming week. This is because we work online asynchronously. The progress will be noted in the document. Based on this, new tasks will be created and assigned. If there are upcoming presentations or document submissions due approaching, members will have online synchronous meetings to practice or discuss.

​

# Task management

Our team will use GitHub issues and the board to manage tasks. 

Each assignee will change the task status when they start and when they complete it.

​


# Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React |
|  | TypeScript |
|  | (will be updated by the frontend lead) |
| Backend (Service/API) | Python |
|  | FastAPI |
|  | SQLAlchemy (ORM) |
|  | Pydantic (Data validation) |
|  | JWT (JSON Web Tokens for user authentication) |
| Database | PostgreSQL |
|  | Docker Container (for PostgreSQL) |
| Environment / Secrets | `.env` file (for DB passwords, API keys) |
|  | python-dotenv (loads `.env` into the app) |
| Testing | pytest |
| Version Control | GitHub (branching, pull requests, code review) |
| IDE | VS Code or PyCharm |

*Will be modified later as needed after all use cases and user stories are composed.*


​

# Architecture

- **Paradigm:** Object-Oriented Programming (OOP)
- **Pattern:** N-Tier architecture
- **Code structure:** Repository / Service pattern
  - **Repository layer** — talks to the database (SQLAlchemy)
  - **Service layer** — holds business logic
  - **API layer** — FastAPI routes call the services, never the repositories directly

*Will be modified later as needed after all use cases and user stories are composed.*





# Local security tooling setup

This repo uses [pre-commit](https://pre-commit.com/) to catch committed
secrets before they leave your machine. One-time setup after cloning:

    pip install pre-commit
    pre-commit install

This installs a git hook that runs `detect-secrets` against staged files
on every commit, checked against `.secrets.baseline`. If it flags a new
finding that's a genuine false positive, update the baseline with:

    detect-secrets scan --exclude-files 'package-lock\.json$' > .secrets.baseline

and commit the updated file — do not delete `.secrets.baseline` to make
the hook pass. If a finding looks like a real secret, treat it as an
incident (rotate/remove the credential) instead of baselining it away.


The README will be updated as the project progresses.
