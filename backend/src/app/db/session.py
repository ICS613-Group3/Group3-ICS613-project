"""Async database engine and session management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_engine_instance: AsyncEngine | None = None
_sessionmaker_instance: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Return the cached async engine, creating it on first access.

    The engine is bound to whatever ``Settings`` is current at the time of
    first access. Tests that mutate ``os.environ`` and then call
    ``reset_engine_cache()`` (e.g. in fixtures) can force re-creation.

    Pool tuning: defaults are conservative for a small service. In production,
    tune ``pool_size`` and ``max_overflow`` based on expected concurrency.
    ``pool_recycle`` (1800s = 30 min) is shorter than typical Postgres
    idle-disconnect settings to avoid "connection lost" errors on long-lived
    idle connections. ``pool_pre_ping`` adds a cheap round-trip before each
    checkout to catch dead connections; turn off only if the latency is
    measured and unacceptable.
    """
    global _engine_instance
    if _engine_instance is None:
        settings = get_settings()
        _engine_instance = create_async_engine(
            settings.database_url,
            echo=settings.debug,
            future=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=1800,
            pool_pre_ping=True,
        )
    return _engine_instance


def get_async_session_maker() -> async_sessionmaker[AsyncSession]:
    """Return an async sessionmaker bound to the cached engine.

    The sessionmaker is created once and re-used. ``expire_on_commit`` is
    off so attribute access after ``commit()`` doesn't trigger implicit
    SELECT round-trips (which would fail in async context).
    """
    global _sessionmaker_instance
    if _sessionmaker_instance is None:
        _sessionmaker_instance = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _sessionmaker_instance


def reset_engine_cache() -> None:
    """Drop the cached engine and sessionmaker.

    Tests that override ``DATABASE_URL`` between modules should call this
    so subsequent ``get_engine()`` calls rebuild with the new value.
    """
    global _engine_instance, _sessionmaker_instance
    _engine_instance = None
    _sessionmaker_instance = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session for FastAPI dependencies.

    Commits on clean exit, rolls back on exception. The session is closed
    in the ``finally`` block regardless of outcome.
    """
    async_session_local = get_async_session_maker()
    async with async_session_local() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Async context manager for sessions outside of FastAPI (e.g., scheduler jobs).

    Same commit/rollback semantics as ``get_db`` so callers don't have to
    remember to commit. The scheduler code is simpler because of this.
    """
    async_session_local = get_async_session_maker()
    async with async_session_local() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
