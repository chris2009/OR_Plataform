from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EventResponse(BaseModel):
    id: int
    camera_id: int
    camera_name: str
    detected_class: str
    confidence: float
    bbox: Optional[dict] = None
    snapshot_path: str
    roi_active: bool
    timestamp: datetime
    acknowledged: bool
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EventStats(BaseModel):
    total_today: int
    by_class: dict
    by_camera: dict
    by_hour: list
