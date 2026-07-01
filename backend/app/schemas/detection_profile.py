from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class DetectionProfileCreate(BaseModel):
    name: str
    classes: List[int] = []


class DetectionProfileUpdate(BaseModel):
    name: Optional[str] = None
    classes: Optional[List[int]] = None


class DetectionProfileResponse(BaseModel):
    id: int
    name: str
    classes: List[int]
    created_by: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
