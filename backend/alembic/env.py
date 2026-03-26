"""Alembic migration environment — synchronous engine for SQLite/PostgreSQL."""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Import all models so Alembic can detect them
# We need to import Base from a sync-compatible source
from sqlalchemy.orm import DeclarativeBase
import app.models.models  # noqa: F401

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Get the Base from the models module (it uses the async engine base)
# We need to use the same Base that models are registered on
from app.db.base import Base

target_metadata = Base.metadata

# Allow DATABASE_URL env var to override alembic.ini
_db_url = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./searchfund.db")
# Alembic needs sync URL — strip async driver prefix
_db_url = _db_url.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")
config.set_main_option("sqlalchemy.url", _db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL only)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,   # required for SQLite ALTER TABLE support
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with a live connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,   # required for SQLite ALTER TABLE support
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
