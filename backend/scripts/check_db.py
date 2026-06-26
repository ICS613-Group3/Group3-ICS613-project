#!/usr/bin/env python3
"""
Async Database Connection Checker

Run this script to verify that:
  1. Docker is running
  2. The PostgreSQL container is up
  3. Your .env file is correct
  4. Python can connect to the database asynchronously

Usage:
    python scripts/check_db.py

Expected output:
    [OK]   Docker is available
    [OK]   PostgreSQL container is running
    [OK]   DATABASE_URL is set
    [OK]   Connected to PostgreSQL 15.x
    [OK]   Can create and drop tables (read/write OK)
    [OK]   All checks passed!
"""

import asyncio
import os
import subprocess
import sys

from dotenv import find_dotenv, load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(find_dotenv())

DATABASE_URL_FALLBACK = "postgresql+asyncpg://ics613user:***@localhost:5432/toolsharing"


def check(ok: bool, message: str, detail: str = "") -> None:
    """Print a check result with consistent formatting."""
    prefix = "[OK]" if ok else "[FAIL]"
    color = "\033[92m" if ok else "\033[91m"  # green / red
    reset = "\033[0m"
    print(f"{color}{prefix}{reset}  {message}")
    if detail:
        for line in detail.strip().split("\n"):
            print(f"       {line}")
    if not ok:
        print()
        print(f"  {color}Fix the issue above, then run this script again.{reset}")
        sys.exit(1)


def check_docker() -> None:
    """Check that Docker is available."""
    try:
        result = subprocess.run(
            ["docker", "--version"],
            capture_output=True, text=True, timeout=10
        )
        check(
            result.returncode == 0,
            "Docker is available",
            result.stdout.strip() if result.stdout else ""
        )
    except FileNotFoundError:
        check(False, "Docker is available", "Docker not found. Install Docker Desktop (docker.com).")
    except subprocess.TimeoutExpired:
        check(False, "Docker is available", "Docker command timed out.")


def check_container() -> None:
    """Check that a PostgreSQL container is running."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=db", "--format", "{{.Names}} {{.Status}}"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            check(True, "PostgreSQL container is running", result.stdout.strip())
        else:
            check(False, "PostgreSQL container is running",
                  "No container named 'db' found.\n"
                  "Run: docker compose up -d   (from the project root)")
    except subprocess.TimeoutExpired:
        check(False, "PostgreSQL container is running", "Docker ps timed out.")


def check_env() -> None:
    """Check that DATABASE_URL is set."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        masked = db_url
        if "@" in masked:
            user_pass, rest = masked.split("@", 1)
            if ":" in user_pass:
                user = user_pass.split(":", 1)[0]
                masked = f"{user}:***@{rest}"
        check(True, "DATABASE_URL is set", f"DATABASE_URL={masked}")
    else:
        check(False, "DATABASE_URL is set",
              "DATABASE_URL environment variable is not set.\n"
              "1. Copy .env.example to .env:\n"
              "     cp .env.example .env\n"
              "2. Edit .env and set DATABASE_URL to:\n"
              f"     DATABASE_URL={DATABASE_URL_FALLBACK}")


async def check_connection() -> None:
    """Check async PostgreSQL connection."""
    db_url = os.getenv("DATABASE_URL") or DATABASE_URL_FALLBACK
    engine = create_async_engine(db_url, future=True)
    try:
        async with engine.connect() as conn:
            result = await conn.exec_driver_sql("SELECT version()")
            version = result.scalar_one()
        check(True, "Connected to PostgreSQL", version)
    except Exception as exc:
        check(False, "Connected to PostgreSQL",
              f"Connection failed: {exc}\n"
              "  • Is docker compose up -d running?\n"
              "  • Is DATABASE_URL in .env correct?\n"
              "  • Try: docker compose logs db")
    finally:
        await engine.dispose()


async def check_read_write() -> None:
    """Check that we can create and drop a temp table."""
    db_url = os.getenv("DATABASE_URL") or DATABASE_URL_FALLBACK
    engine = create_async_engine(db_url, future=True)
    try:
        async with engine.begin() as conn:
            await conn.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS _db_check_temp (id SERIAL PRIMARY KEY, note TEXT)"
            )
            await conn.exec_driver_sql(
                "INSERT INTO _db_check_temp (note) VALUES ('Database connection verified')"
            )
            result = await conn.exec_driver_sql(
                "SELECT note FROM _db_check_temp WHERE id = 1"
            )
            note = result.scalar_one()
            await conn.exec_driver_sql("DROP TABLE _db_check_temp")
        check(True, "Can create and drop tables (read/write OK)", f'Wrote + read back: "{note}"')
    except Exception as exc:
        check(False, "Can create and drop tables (read/write OK)", str(exc))
    finally:
        await engine.dispose()


async def main() -> None:
    print("=" * 60)
    print("  Neighborhood Tool Sharing — DB Setup Checker")
    print("=" * 60)
    print()

    check_docker()
    check_container()
    check_env()
    await check_connection()
    await check_read_write()

    print()
    print("=" * 60)
    check(True, "All checks passed! Your database setup is ready.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
