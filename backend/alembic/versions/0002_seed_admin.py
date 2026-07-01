"""seed admin user

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # bcrypt hash de "admin123"
    hashed = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"

    op.execute(f"""
        INSERT INTO users (username, email, hashed_password, full_name, role, is_active, theme_preference)
        VALUES ('admin', 'admin@yolo.local', '{hashed}', 'Administrator', 'admin', true, 'dark')
        ON CONFLICT (username) DO NOTHING
    """)

    # Perfiles de detección predefinidos
    op.execute("""
        INSERT INTO detection_profiles (name, classes) VALUES
        ('Seguridad Perimetral', '[0]'),
        ('Control Vehicular', '[2, 5, 7, 3]'),
        ('Todas las Clases', '[]')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE username = 'admin'")
    op.execute("DELETE FROM detection_profiles WHERE name IN ('Seguridad Perimetral', 'Control Vehicular', 'Todas las Clases')")
