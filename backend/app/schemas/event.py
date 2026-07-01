from datetime import datetime
from typing import Dict, List, Optional

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


class GroupedCount(BaseModel):
    group: str
    counts: Dict[str, int]


class EventStats(BaseModel):
    total_today: int
    by_class: dict          # hoy, por clase
    by_camera: dict          # hoy, por cámara
    by_hour: list             # hoy, por hora
    by_day: List[GroupedCount]      # últimos 7 días, por clase (para el gráfico)
    by_source: List[GroupedCount]   # últimos 7 días, por cámara y clase (para el gráfico)
    all_classes: List[str]     # todas las clases detectadas alguna vez (para filtros)
    all_cameras: List[str]     # todas las cámaras con eventos alguna vez (para filtros)
