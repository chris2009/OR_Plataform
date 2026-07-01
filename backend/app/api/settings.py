import time

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.system_config import SystemConfig
from app.models.user import User
from app.schemas.settings import SystemConfigResponse, SystemConfigUpdate, SystemInfoResponse
from app.services.detection.engine import detection_engine

router = APIRouter(prefix="/settings", tags=["settings"])
_start_time = time.time()


async def _get_config(db: AsyncSession) -> dict:
    result = await db.execute(select(SystemConfig))
    rows = result.scalars().all()
    return {r.key: r.value for r in rows}


async def _set_config(db: AsyncSession, key: str, value: str):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
        db.add(row)
    else:
        db.add(SystemConfig(key=key, value=value))


@router.get("", response_model=SystemConfigResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cfg = await _get_config(db)
    return SystemConfigResponse(
        yolo_model=cfg.get("yolo_model", "auto"),
        confidence_threshold=float(cfg.get("confidence_threshold", "0.5")),
        process_every_n_frames=int(cfg.get("process_every_n_frames", "3")),
    )


@router.put("", response_model=SystemConfigResponse)
async def update_settings(
    payload: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if payload.yolo_model is not None:
        await _set_config(db, "yolo_model", payload.yolo_model)
    if payload.confidence_threshold is not None:
        await _set_config(db, "confidence_threshold", str(payload.confidence_threshold))
    if payload.process_every_n_frames is not None:
        await _set_config(db, "process_every_n_frames", str(payload.process_every_n_frames))
    await db.flush()

    cfg = await _get_config(db)
    return SystemConfigResponse(
        yolo_model=cfg.get("yolo_model", "auto"),
        confidence_threshold=float(cfg.get("confidence_threshold", "0.5")),
        process_every_n_frames=int(cfg.get("process_every_n_frames", "3")),
    )


@router.post("/reload-engine")
async def reload_engine(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    cfg = await _get_config(db)
    model_name = cfg.get("yolo_model", "auto")
    await detection_engine.reload(model_name)
    return {"detail": f"Motor recargado con modelo: {detection_engine.model_name}"}


@router.get("/system-info", response_model=SystemInfoResponse)
async def system_info(_: User = Depends(get_current_user)):
    info = detection_engine.get_model_info()
    return SystemInfoResponse(
        **info,
        uptime_seconds=time.time() - _start_time,
    )
