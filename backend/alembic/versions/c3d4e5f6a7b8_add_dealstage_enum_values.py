"""add missing dealstage enum values (LEAD, CIM, MODEL, IOI, DILIGENCE)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-30

The original dealstage enum only had: PROSPECT, CONTACTED, NDA, LOI, DD, CLOSED, PASSED.
The current DealStage Python enum added: LEAD, CIM, MODEL, IOI, DILIGENCE.
SQLAlchemy stores enum.name (uppercase) so these new names must exist in the DB type.
"""
from alembic import op

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
      # Add new enum values that exist in the Python DealStage enum but not in the DB
      # PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction
      op.execute("ALTER TYPE dealstage ADD VALUE IF NOT EXISTS 'LEAD'")
      op.execute("ALTER TYPE dealstage ADD VALUE IF NOT EXISTS 'CIM'")
      op.execute("ALTER TYPE dealstage ADD VALUE IF NOT EXISTS 'MODEL'")
      op.execute("ALTER TYPE dealstage ADD VALUE IF NOT EXISTS 'IOI'")
      op.execute("ALTER TYPE dealstage ADD VALUE IF NOT EXISTS 'DILIGENCE'")


def downgrade() -> None:
      # PostgreSQL does not support removing enum values
      pass
