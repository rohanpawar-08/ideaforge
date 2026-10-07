"""add ai_usage_events table

Revision ID: 0003_ai_usage_tracking
Revises: 0002_password_reset_tokens
Create Date: 2026-10-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003_ai_usage_tracking'
down_revision: Union[str, None] = '0002_password_reset_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_usage_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('provider', sa.String(length=50), server_default='groq', nullable=False),
        sa.Column('model', sa.String(length=100), server_default='llama-3.3-70b-versatile', nullable=False),
        sa.Column('success', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_usage_events_id'), 'ai_usage_events', ['id'], unique=False)
    op.create_index(op.f('ix_ai_usage_events_user_id'), 'ai_usage_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_events_action'), 'ai_usage_events', ['action'], unique=False)
    op.create_index(op.f('ix_ai_usage_events_created_at'), 'ai_usage_events', ['created_at'], unique=False)
    op.create_index(
        'ix_ai_usage_events_user_action_created',
        'ai_usage_events',
        ['user_id', 'action', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_ai_usage_events_user_action_created', table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_created_at'), table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_action'), table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_user_id'), table_name='ai_usage_events')
    op.drop_index(op.f('ix_ai_usage_events_id'), table_name='ai_usage_events')
    op.drop_table('ai_usage_events')
