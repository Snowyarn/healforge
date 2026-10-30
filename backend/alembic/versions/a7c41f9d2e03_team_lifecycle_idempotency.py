"""team invitation lifecycle + idempotency records

Revision ID: a7c41f9d2e03
Revises: 03b22de49056
Create Date: 2026-10-28

Reviewed manually (not applied blind):
- team_members gains user_id (FK users.id, nullable — legacy invitation rows have
  no account until accepted), invite_token_hash (hashed, single-use), invite
  expiry/acceptance timestamps and revoked_at.
- New idempotency_records table with a unique (user_id, workspace_id, operation,
  idempotency_key) constraint backing the reservation-based idempotency helper.
- Data backfill: every existing workspace owner gets an Active Owner row in
  team_members so role checks and last-owner protection operate on one table.
  Backfill uses a correlated NOT EXISTS so it is idempotent across re-runs.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7c41f9d2e03"
down_revision: str | None = "03b22de49056"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- team_members: invitation acceptance lifecycle -----------------------
    with op.batch_alter_table("team_members", schema=None) as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.String(length=48), nullable=True))
        batch_op.add_column(sa.Column("invite_token_hash", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index(batch_op.f("ix_team_members_user_id"), ["user_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_team_members_invite_token_hash"), ["invite_token_hash"], unique=False)

    # Backfill: workspace owners become Active Owner membership rows (idempotent).
    op.execute(
        """
        INSERT INTO team_members (id, workspace_id, name, email, role, status, invited_by, created_at, user_id, accepted_at)
        SELECT
            'mem_bk_' || substr(w.id, -12) || '_' || substr(u.id, -6),
            w.id,
            u.username,
            u.email,
            'Owner',
            'Active',
            'system',
            CURRENT_TIMESTAMP,
            u.id,
            CURRENT_TIMESTAMP
        FROM workspaces w
        JOIN users u ON u.id = w.owner_user_id
        WHERE NOT EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.workspace_id = w.id AND tm.user_id = u.id AND tm.role = 'Owner'
        )
        """
    )

    # --- idempotency_records --------------------------------------------------
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=48), nullable=False),
        sa.Column("user_id", sa.String(length=48), nullable=False),
        sa.Column("workspace_id", sa.String(length=48), nullable=False),
        sa.Column("operation", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "workspace_id", "operation", "idempotency_key", name="uq_idem_scope_key"),
    )
    op.create_index(op.f("ix_idempotency_records_user_id"), "idempotency_records", ["user_id"], unique=False)
    op.create_index(op.f("ix_idempotency_records_workspace_id"), "idempotency_records", ["workspace_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_idempotency_records_workspace_id"), table_name="idempotency_records")
    op.drop_index(op.f("ix_idempotency_records_user_id"), table_name="idempotency_records")
    op.drop_table("idempotency_records")
    # Owner membership rows created by the backfill are removed with the columns.
    op.execute("DELETE FROM team_members WHERE invited_by = 'system' AND role = 'Owner'")
    with op.batch_alter_table("team_members", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_team_members_invite_token_hash"))
        batch_op.drop_index(batch_op.f("ix_team_members_user_id"))
        batch_op.drop_column("revoked_at")
        batch_op.drop_column("accepted_at")
        batch_op.drop_column("invite_expires_at")
        batch_op.drop_column("invite_token_hash")
        batch_op.drop_column("user_id")
