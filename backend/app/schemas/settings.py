from pydantic import BaseModel
from typing import Optional, List


class SystemConfigUpdate(BaseModel):
    yolo_model: Optional[str] = None
    confidence_threshold: Optional[float] = None
    process_every_n_frames: Optional[int] = None


class SystemConfigResponse(BaseModel):
    yolo_model: str
    confidence_threshold: float
    process_every_n_frames: int


class SystemInfoResponse(BaseModel):
    model_name: str
    ultralytics_version: str
    gpu: Optional[str]
    ram_total_gb: Optional[float]
    ram_available_gb: Optional[float]
    active_cameras: List[int]
    uptime_seconds: float
