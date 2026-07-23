#!/usr/bin/env python3
"""Create all database tables from the ORM models.

Uses SQLAlchemy ``Base.metadata.create_all()`` — no Alembic required.
Run this after setting up PostgreSQL and before ``seed_dev.py``.

Usage:
    cd backend
    python scripts/init_db.py

For upgrading from R1, run ``clean_dev.py`` and ``DROP SCHEMA …`` first
(see Backend_Setup.md §9 "Upgrading from R1").
"""

import asyncio
import sys

from dotenv import find_dotenv, load_dotenv
from sqlalchemy import text

# Ensure src/ is on sys.path
sys.path.insert(0, "src")

load_dotenv(find_dotenv())

from app.db.base import Base
from app.db.session import get_engine
import app.models  # noqa: F401 — registers all ORM models with Base.metadata


async def _init_db() -> None:
    engine = get_engine()
    async with engine.connect() as conn:
        # btree_gist is required for the GiST EXCLUDE constraint on the
        # reservations table (prevents double-booking over date ranges).
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        await conn.commit()
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()
    await engine.dispose()
    print("All tables created successfully.")


if __name__ == "__main__":
    asyncio.run(_init_db())
