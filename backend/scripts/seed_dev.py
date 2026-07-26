#!/usr/bin/env python3
"""
Development seed script.

Creates a deterministic set of users, tools, and reservations for local
manual testing and demo rehearsals.

Usage:
    cd backend
    python scripts/seed_dev.py

Environment variables:
    SEED_PASSWORD (default: a random 16-char password printed to stdout).
        Set this explicitly for non-interactive use; otherwise the script
        generates a random password and prints it so you can log in.
    SKIP_SEED_PASSWORD_PRINT (default: unset). Set to "1" to suppress the
        password banner (for CI).
"""

import asyncio
import os
import secrets
import shutil
import sys
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure the src directory is on the Python path so that `app` can be imported.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "src"))

load_dotenv(find_dotenv())

from app.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.enums import (  # noqa: E402
    InviteStatus,
    ToolCondition,
    UserStatus,
)
from app.models.invite import InviteToken  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.photo import Photo  # noqa: E402
from app.models.tool import Tool  # noqa: E402
from app.models.user import User  # noqa: E402

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing",
)

# Seed photos live alongside this script in scripts/seed_photos/ and are
# committed to the repo. The seed script copies them into the served
# uploads directory (media/tool_photos/) so the /uploads/<name>.jpg URLs
# that the Photo records point to actually resolve. The seed images are
# the only files that should ever be in that directory by default; user
# uploads land alongside them at runtime but are gitignored.
SEED_PHOTOS_DIR = Path(__file__).resolve().parent / "seed_photos"


def _resolve_seed_password() -> str:
    """Return the seed password.

    Order of precedence:
      1. ``SEED_PASSWORD`` env var (recommended for non-interactive / CI use).
      2. A freshly generated 16-char URL-safe password, printed to stdout so
         the developer can copy it. This replaces the prior hard-coded
         "Password123!" which was a real-credential risk.
    """
    explicit = os.getenv("SEED_PASSWORD")
    if explicit:
        return explicit
    generated = secrets.token_urlsafe(12)
    if os.getenv("SKIP_SEED_PASSWORD_PRINT") != "1":
        print(
            "\n[seed] No SEED_PASSWORD env var set — generated a random one.\n"
            "      Use this to log in as admin@example.com / member01@example.com "
            "/ member02@example.com:\n"
            f"        password = {generated}\n"
            "      Set SEED_PASSWORD in your .env to fix it for repeated runs.\n",
            file=sys.stderr,
        )
    return generated


def _ensure_seed_photos(uploads_dir: Path) -> int:
    """Copy seed images from ``scripts/seed_photos/`` into ``uploads_dir`` if missing.

    Idempotent: only copies files that aren't already present (so re-running
    the seed never overwrites a user-edited image). Returns the number of
    files copied. A missing ``SEED_PHOTOS_DIR`` is a no-op, not an error —
    lets the seed still create user/tool rows even if the images were
    deleted from the repo checkout.
    """
    if not SEED_PHOTOS_DIR.is_dir():
        return 0
    uploads_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for seed_file in sorted(SEED_PHOTOS_DIR.iterdir()):
        if not seed_file.is_file():
            continue
        target = uploads_dir / seed_file.name
        if not target.exists():
            shutil.copy2(seed_file, target)
            copied += 1
    return copied


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, future=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    seed_password = _resolve_seed_password()
    seed_hash = hash_password(seed_password)

    # Copy seed photos into the served uploads directory so the /uploads/*
    # URLs that Photo records point to actually resolve. This must happen
    # before the Photo rows are committed.
    uploads_dir = get_settings().media_dir / "tool_photos"
    copied = _ensure_seed_photos(uploads_dir)
    if copied:
        print(f"[seed] Copied {copied} seed photo(s) into {uploads_dir}")

    async with async_session() as session:
        async with session.begin():
            await _seed(session, seed_hash)
        await session.commit()

    await engine.dispose()
    print("Seed data created.")


async def _seed(db: AsyncSession, password_hash: str) -> None:
    """Insert deterministic demo data."""
    # ── Users ──
    admin = User(
        email="admin@example.com",
        hashed_password=password_hash,
        full_name="Admin User",
        status=UserStatus.ACTIVE,
        is_admin=True,
    )
    member01 = User(
        email="member01@example.com",
        hashed_password=password_hash,
        full_name="Demo Owner",
        status=UserStatus.ACTIVE,
        is_admin=False,
    )
    member02 = User(
        email="member02@example.com",
        hashed_password=password_hash,
        full_name="Demo Borrower",
        status=UserStatus.ACTIVE,
        is_admin=False,
    )
    db.add_all([admin, member01, member02])
    await db.flush()

    # ── Invite ──
    invite = InviteToken(
        email="newmember@example.com",
        created_by=admin.id,
        status=InviteStatus.SENT,
    )
    db.add(invite)

    # ── Categories (admin-managed, US28) ──
    categories_data = [
        ("HAND_TOOLS", "Manual tools like hammers, wrenches, screwdrivers"),
        ("POWER_TOOLS", "Electric and battery-powered tools"),
        ("GARDEN_TOOLS", "Outdoor gardening and yard tools"),
        ("CLEANING_TOOLS", "Cleaning equipment and supplies"),
        ("OUTDOOR_GEAR", "Camping, hiking, and outdoor recreation gear"),
    ]
    for name, desc in categories_data:
        db.add(Category(name=name, description=desc, created_by=admin.id))
    await db.flush()

    # ── Tools (one per photo we have seeded) ──
    tools_data = [
        {"name": "Cordless Drill", "category": "POWER_TOOLS", "condition": ToolCondition.GOOD},
        {"name": "Hammer", "category": "HAND_TOOLS", "condition": ToolCondition.LIKE_NEW},
        {"name": "Wrench", "category": "HAND_TOOLS", "condition": ToolCondition.GOOD},
        {"name": "Screwdriver", "category": "HAND_TOOLS", "condition": ToolCondition.GOOD},
        {"name": "Ladder", "category": "OUTDOOR_GEAR", "condition": ToolCondition.GOOD},
        {"name": "Hand Saw", "category": "HAND_TOOLS", "condition": ToolCondition.FAIR},
        {"name": "Circular Saw", "category": "POWER_TOOLS", "condition": ToolCondition.GOOD},
        {"name": "Pliers", "category": "HAND_TOOLS", "condition": ToolCondition.LIKE_NEW},
        {"name": "Tape Measure", "category": "HAND_TOOLS", "condition": ToolCondition.GOOD},
        {"name": "Paint Roller", "category": "HAND_TOOLS", "condition": ToolCondition.FAIR},
        {"name": "Rake", "category": "GARDEN_TOOLS", "condition": ToolCondition.FAIR},
        {"name": "Utility Knife", "category": "HAND_TOOLS", "condition": ToolCondition.GOOD},
    ]

    # Split tools across both non-admin users (odd → owner, even → borrower)
    tools = []
    for i, td in enumerate(tools_data):
        owner = member01 if i % 2 == 0 else member02
        tool = Tool(
            owner_id=owner.id,
            name=td["name"],
            description=f"A {td['category'].lower()} available for sharing.",
            category=td["category"],
            condition=td["condition"],
            is_active=True,
        )
        db.add(tool)
        await db.flush()

        # Add a photo URL pointing at the served uploads directory. The
        # actual file is copied in by ``_ensure_seed_photos`` above; here
        # we just record the public path.
        photo = Photo(
            tool_id=tool.id,
            url=f"/uploads/{tool.name.lower().replace(' ', '-')}.jpg",
            display_order=1,
        )
        db.add(photo)
        tools.append(tool)


if __name__ == "__main__":
    asyncio.run(main())
