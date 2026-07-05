# Backend

FastAPI service for **Neighborhood Tool Sharing** (ICS 613 Group 3, Summer 2026). REST API, ORM models, JWT auth, and the dev toolchain. The frontend lives in the parent repo.

## Tech stack

Python 3.11 / 3.12 / 3.13 · FastAPI · SQLAlchemy 2.0 (async, asyncpg) · Pydantic v2 · PostgreSQL 15 · Alembic · JWT auth · pytest · ruff · mypy

## Start here

- **[Backend_Setup.md](Backend_Setup.md)** — full setup guide: PostgreSQL in Docker, venv, env config, migrations, seed data, run, test, lint.
- **[Project structure](Backend_Setup.md#project-structure)** — annotated directory tree.
- **[pyproject.toml](pyproject.toml)** — ruff, mypy, pytest config.
- **[alembic/](alembic/)** — database migrations (R1A → R1D).

## Top-level at a glance

| Path | What |
|---|---|
| `src/app/` | Application code: API routes, models, schemas, services, tests |
| `alembic/` | Database migrations |
| `scripts/` | Dev scripts: `check_db.py`, `seed_dev.py`, `clean_dev.py` |
| `db/init/` | SQL run on first Postgres container start |
| `media/` | Seed tool photos served at `/uploads` |

For one-liners per script and per `src/app/` subpackage, see [Backend_Setup.md § Project structure](Backend_Setup.md#project-structure).

## Configuration

Copy `.env.example` → `.env` and edit. Details: [Backend_Setup.md § 7](Backend_Setup.md#7-configure-environment).

## Seed data (development only)

The seed script creates three local demo users (`admin@example.com`, `member01@example.com`, `member02@example.com`) and 12 tool listings. **These are local-only demo accounts — never deploy them.** Set `SEED_PASSWORD` in your local `.env` to keep a stable password across re-seeds. See [Backend_Setup.md § 10](Backend_Setup.md#10-load-seed-data-optional).

## Contributing

`main` is branch-protected. Open a PR and request review. See the [repo root README](../README.md) for the team workflow.
