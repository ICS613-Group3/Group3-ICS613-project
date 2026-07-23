#!/usr/bin/env python3
"""Clear all data from existing tables, regardless of migration state."""

import asyncio
import os

from dotenv import find_dotenv, load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(find_dotenv())

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing",
)


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, future=True)
    async with engine.begin() as conn:
        # Discover all user tables (excluding alembic_version)
        result = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name != 'alembic_version' "
                "ORDER BY table_name"
            )
        )
        tables = [row[0] for row in result.fetchall()]
        print(f"Found {len(tables)} tables: {', '.join(tables)}")

        # TRUNCATE with CASCADE handles FK dependencies automatically
        # and doesn't require superuser privileges (unlike session_replication_role)
        for table in tables:
            await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
            print(f"  Cleared {table}")

    await engine.dispose()
    print("Done. All data cleared.")


if __name__ == "__main__":
    asyncio.run(main())
