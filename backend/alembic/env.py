"""Async Alembic environment."""

import asyncio
import os
import sys
from logging.config import fileConfig

from dotenv import find_dotenv, load_dotenv
from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

load_dotenv(find_dotenv())

# Ensure the src directory is on the Python path so that `app` can be imported.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "src"))

# Import the Base and all models so Alembic can autogenerate migrations.
# Guarded so that `upgrade` / `downgrade` commands still work when the
# application model layer is not fully scaffolded yet.
try:
    from app.db.base import Base  # noqa: F401
    from app.models import *  # noqa: F401,F403
except ModuleNotFoundError:
    from sqlalchemy.orm import DeclarativeBase

    class Base(DeclarativeBase):  # type: ignore[no-redef]
        pass

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from environment if DATABASE_URL is set.
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
