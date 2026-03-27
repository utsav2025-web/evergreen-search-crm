"""add session_token and missing user columns

Revision ID: a1b2c3d4e5f6
Revises: e9d7a4b1857c
Create Date: 2026-03-27 02:30:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e9d7a4b1857c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        # Soft-login session token (primary fix — login was crashing without this)
        batch_op.add_column(sa.Column('session_token', sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column('session_expires_at', sa.DateTime(timezone=True), nullable=True))
        # User role (partner | guest)
        batch_op.add_column(sa.Column('role', sa.String(length=20), nullable=False, server_default='partner'))
        # Google token expiry timestamp
        batch_op.add_column(sa.Column('google_token_expiry', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_session_token'), ['session_token'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_session_token'))
        batch_op.drop_column('google_token_expiry')
        batch_op.drop_column('role')
        batch_op.drop_column('session_expires_at')
        batch_op.drop_column('session_token')
