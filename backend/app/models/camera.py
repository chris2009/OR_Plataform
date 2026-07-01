import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SourceType(str, enum.Enum):
    rtsp = "rtsp"
    video = "video"
    image = "image"


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False)
    stream_url: Mapped[str] = mapped_column(String(1000), default="")
    ip_address: Mapped[str] = mapped_column(String(100), default="")
    username: Mapped[str] = mapped_column(String(100), default="")
    # Contraseña cifrada con Fernet
    password_encrypted: Mapped[str] = mapped_column(String(500), default="")
    roi: Mapped[list | None] = mapped_column(JSON, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    detection_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    classes_filter: Mapped[list] = mapped_column(JSON, default=list)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    owner: Mapped["User"] = relationship("User", back_populates="cameras")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="camera")
