"""add missing company columns: thesis scoring and inbound email FKs

Revision ID: b2c3d4e5f6a7
Revises: f1e2d3c4b5a6
Create Date: 2026-03-30

These columns exist in the Company ORM model but were never added to the
database via Alembic. SQLAlchemy includes them (even as NULL) in INSERT
statements, causing UndefinedColumnError and PendingRollbackError on CSV upload.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'f1e2d3c4b5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
      op.add_column('companies', sa.Column('thesis_score', sa.Float(), nullable=True))
      op.add_column('companies', sa.Column('thesis_flags', sa.JSON(), nullable=True))
      op.add_column('companies', sa.Column('thesis_scored_at', sa.DateTime(timezone=True), nullable=True))
      op.add_column('companies', sa.Column('inbound_email_id', sa.Integer(), nullable=True))
      op.add_column('companies', sa.Column('broker_listing_ref_id', sa.Integer(), nullable=True))


def downgrade() -> None:
      op.drop_column('companies', 'broker_listing_ref_id')
      op.drop_column('companies', 'inbound_email_id')
      op.drop_column('companies', 'thesis_scored_at')
      op.drop_column('companies', 'thesis_flags')
      op.drop_column('companies', 'thesis_score')
