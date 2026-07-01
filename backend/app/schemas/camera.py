from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.camera import SourceType


class CameraBase(BaseModel):
    name: str
    source_type: SourceType
    stream_url: str = ""
    ip_address: str = ""
    username: str = ""
    roi: Optional[List] = None
    is_active: bool = False
    detection_enabled: bool = True
    confidence_threshold: float = 0.5
    classes_filter: List[int] = []


class CameraCreate(CameraBase):
    password: str = ""


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None
    ip_address: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    roi: Optional[List] = None
    is_active: Optional[bool] = None
    detection_enabled: Optional[bool] = None
    confidence_threshold: Optional[float] = None
    classes_filter: Optional[List[int]] = None


class CameraResponse(CameraBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
