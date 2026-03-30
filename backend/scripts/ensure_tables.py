"""ensure_tables.py - run after alembic to create any missing tables.
Uses SQLAlchemy create_all which is idempotent (skips existing tables).
"""
import os
import sys

print("=== Ensuring all database tables exist ===")

db_url = os.environ.get("DATABASE_URL", "sqlite:///./searchfund.db")
db_url = db_url.replace("postgresql+asyncpg", "postgresql").replace("sqlite+aiosqlite", "sqlite")

try:
      import app.models.models
      from app.db.base import Base
      from sqlalchemy import create_engine
      engine = create_engine(db_url, echo=False)
      Base.metadata.create_all(engine)
      engine.dispose()
      print("All tables verified/created successfully.")
except Exception as exc:
      print(f"WARNING: create_all fallback failed: {exc}", file=sys.stderr)
      sys.exit(0)
