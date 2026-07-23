"""Pytest fixtures and configuration.

IMPORTANT: Test environment variables are set BEFORE the app import below.
pydantic-settings reads ``.env`` on first ``Settings()`` call, which happens
when ``app.main`` is imported. If we set the env vars after that, the
already-constructed ``Settings`` instance keeps the .env value (e.g. the
local ``SECRET_KEY=change-me-...`` placeholder) and tests fail validation.
"""

import os

# ``DISABLE_SCHEDULER`` is the real env var name (no ``TOOLSHARING_`` prefix —
# the ``SettingsConfigDict`` doesn't set ``env_prefix``). The previous
# ``TOOLSHARING_DISABLE_SCHEDULER`` was a silent no-op. The scheduler
# actually doesn't start under the test client (httpx's ASGITransport
# doesn't run lifespan by default), so this is belt-and-suspenders for
# the future.
os.environ.setdefault("DISABLE_SCHEDULER", "true")
# 48-char test key — meets the minimum length validator (>=32) and avoids
# the dev-placeholder check ("change-me", "replace-with", ...).
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32-chars-min-ok")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing_test",
)

import uuid  # noqa: E402
from collections.abc import AsyncGenerator, Generator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db.base import Base  # noqa: E402
from app.db.session import reset_engine_cache  # noqa: E402
from app.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402

# Use a dedicated test database.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://ics613user:ics613password@localhost:5432/toolsharing_test",
)


@pytest.fixture(scope="session", autouse=True)
def _configure_test_env() -> None:
    """Ensure tests never send real email and never run the scheduler.

    The static ``os.environ.setdefault(...)`` calls at the top of this module
    already set the test-only vars before the app is imported. This fixture
    re-asserts them and forces the engine cache to be rebuilt with the test
    ``DATABASE_URL`` in case a different process mutated it.
    """
    os.environ["DISABLE_SCHEDULER"] = "true"
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32-chars-min-ok")
    os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
    # Force the cached engine to be re-built with the test DATABASE_URL.
    reset_engine_cache()


@pytest.fixture(autouse=True)
def _reset_rate_limiters() -> Generator[None, None, None]:
    """Clear in-memory rate limiter state between tests.

    The rate limiters are process-global singletons; without this fixture,
    a sequence of tests that all hit ``/auth/login`` would accumulate counts
    and one would fail with 429 in the middle of an unrelated suite.
    """
    from app.dependencies_rate_limit import reset_all_limiters

    reset_all_limiters()
    yield
    reset_all_limiters()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def async_engine() -> AsyncGenerator:
    """Create the async engine used for the whole test session.

    The session-scoped event loop is the recommended pytest-asyncio 0.24+
    pattern; the deprecated ``event_loop`` fixture is no longer redefined.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True)
    # Connect outside a transaction (AUTOCOMMIT) so CREATE/DROP TABLE works.
    conn = await engine.connect()
    conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
    # Enable btree_gist BEFORE create_all: the `reservations` table has a
    # GiST EXCLUDE constraint on `tool_id` (UUID), which requires the
    # btree_gist extension to be loaded first. This must run before any
    # CREATE TABLE in the test DB.
    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    await conn.run_sync(Base.metadata.drop_all)
    await conn.run_sync(Base.metadata.create_all)
    # Seed default tool categories so tool-creation tests pass (US28).
    await conn.execute(
        text(
            "INSERT INTO tool_categories (id, name, created_at) VALUES "
            "(gen_random_uuid(), 'HAND_TOOLS', now()), "
            "(gen_random_uuid(), 'POWER_TOOLS', now()), "
            "(gen_random_uuid(), 'GARDEN_TOOLS', now()), "
            "(gen_random_uuid(), 'CLEANING_TOOLS', now()), "
            "(gen_random_uuid(), 'OUTDOOR_GEAR', now())"
        )
    )
    await conn.close()
    try:
        yield engine
    finally:
        conn = await engine.connect()
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.close()
        await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh async session wrapped in a transaction rollback."""
    async_session = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with async_session() as session, session.begin():
        yield session
        await session.rollback()


@pytest_asyncio.fixture(loop_scope="session")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Return an HTTP client with DB dependency overridden."""

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def unique_email() -> str:
    """Return a unique email address for a test."""
    return f"test+{uuid.uuid4().hex[:12]}@example.com"
