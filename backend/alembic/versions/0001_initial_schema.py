"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), server_default=""),
        sa.Column("role", sa.Enum("admin", "operator", "viewer", name="userrole"), nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("theme_preference", sa.String(10), server_default="dark"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # cameras
    op.create_table(
        "cameras",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("source_type", sa.Enum("rtsp", "video", "image", name="sourcetype"), nullable=False),
        sa.Column("stream_url", sa.String(1000), server_default=""),
        sa.Column("ip_address", sa.String(100), server_default=""),
        sa.Column("username", sa.String(100), server_default=""),
        sa.Column("password_encrypted", sa.String(500), server_default=""),
        sa.Column("roi", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("detection_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("confidence_threshold", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("classes_filter", sa.JSON(), server_default="[]"),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # events
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("camera_id", sa.Integer(), sa.ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False),
        sa.Column("camera_name", sa.String(100), server_default=""),
        sa.Column("detected_class", sa.String(100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("bbox", sa.JSON(), nullable=True),
        sa.Column("snapshot_path", sa.String(500), server_default=""),
        sa.Column("roi_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_events_camera_id", "events", ["camera_id"])
    op.create_index("ix_events_timestamp", "events", ["timestamp"])
    op.create_index("ix_events_acknowledged", "events", ["acknowledged"])

    # system_config
    op.create_table(
        "system_config",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # detection_profiles
    op.create_table(
        "detection_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("classes", sa.JSON(), server_default="[]"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed: config por defecto del sistema
    op.execute("""
        INSERT INTO system_config (key, value) VALUES
        ('yolo_model', 'auto'),
        ('confidence_threshold', '0.5'),
        ('process_every_n_frames', '3')
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("detection_profiles")
    op.drop_table("system_config")
    op.drop_table("events")
    op.drop_table("cameras")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS sourcetype")
