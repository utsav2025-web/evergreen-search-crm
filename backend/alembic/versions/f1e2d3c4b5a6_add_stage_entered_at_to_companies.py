"""add stage_entered_at to companies

Revision ID: f1e2d3c4b5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1e2d3c4b5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
      op.add_column('companies', sa.Column('stage_entered_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
      op.drop_column('companies', 'stage_entered_at')
