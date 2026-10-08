"""add project_task_states table

Revision ID: 0004_project_task_states
Revises: 0003_ai_usage_tracking
Create Date: 2026-10-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004_project_task_states'
down_revision: Union[str, None] = '0003_ai_usage_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_task_states',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('roadmap_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=160), nullable=False),
        sa.Column('task_fingerprint', sa.String(length=160), nullable=False),
        sa.Column('phase_key', sa.String(length=120), nullable=True),
        sa.Column('task_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='todo', nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('source_schema', sa.Integer(), server_default='2', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['roadmap_id'], ['roadmaps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('roadmap_id', 'task_id', name='uq_project_task_states_roadmap_task')
    )
    op.create_index(op.f('ix_project_task_states_id'), 'project_task_states', ['id'], unique=False)
    op.create_index(op.f('ix_project_task_states_user_id'), 'project_task_states', ['user_id'], unique=False)
    op.create_index(op.f('ix_project_task_states_roadmap_id'), 'project_task_states', ['roadmap_id'], unique=False)
    op.create_index(
        'ix_project_task_states_roadmap_status',
        'project_task_states',
        ['roadmap_id', 'status'],
        unique=False
    )
    op.create_index(
        'ix_project_task_states_user_roadmap',
        'project_task_states',
        ['user_id', 'roadmap_id'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_project_task_states_user_roadmap', table_name='project_task_states')
    op.drop_index('ix_project_task_states_roadmap_status', table_name='project_task_states')
    op.drop_index(op.f('ix_project_task_states_roadmap_id'), table_name='project_task_states')
    op.drop_index(op.f('ix_project_task_states_user_id'), table_name='project_task_states')
    op.drop_index(op.f('ix_project_task_states_id'), table_name='project_task_states')
    op.drop_table('project_task_states')
