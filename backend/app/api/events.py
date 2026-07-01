import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.event import Event
from app.models.user import User, UserRole
from app.schemas.event import EventResponse, EventStats

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=List[EventResponse])
async def list_events(
    camera_id: Optional[int] = Query(None),
    detected_class: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = []
    if camera_id:
        filters.append(Event.camera_id == camera_id)
    if detected_class:
        filters.append(Event.detected_class == detected_class)
    if acknowledged is not None:
        filters.append(Event.acknowledged == acknowledged)
    if date_from:
        filters.append(Event.timestamp >= date_from)
    if date_to:
        filters.append(Event.timestamp <= date_to)

    stmt = (
        select(Event)
        .where(and_(*filters) if filters else True)
        .order_by(Event.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/stats", response_model=EventStats)
async def event_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = (
        await db.execute(
            select(func.count(Event.id)).where(Event.timestamp >= today_start)
        )
    ).scalar_one()

    by_class_rows = (
        await db.execute(
            select(Event.detected_class, func.count(Event.id).label("cnt"))
            .group_by(Event.detected_class)
            .order_by(func.count(Event.id).desc())
        )
    ).all()
    by_class = {r.detected_class: r.cnt for r in by_class_rows}

    by_camera_rows = (
        await db.execute(
            select(Event.camera_name, func.count(Event.id).label("cnt"))
            .group_by(Event.camera_name)
            .order_by(func.count(Event.id).desc())
        )
    ).all()
    by_camera = {r.camera_name: r.cnt for r in by_camera_rows}

    by_hour_rows = (
        await db.execute(
            select(
                func.date_part("hour", Event.timestamp).label("hour"),
                func.count(Event.id).label("cnt"),
            )
            .where(Event.timestamp >= today_start)
            .group_by(func.date_part("hour", Event.timestamp))
            .order_by(func.date_part("hour", Event.timestamp))
        )
    ).all()
    by_hour = [{"hour": int(r.hour), "count": r.cnt} for r in by_hour_rows]

    return EventStats(
        total_today=total_today,
        by_class=by_class,
        by_camera=by_camera,
        by_hour=by_hour,
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return event


@router.put("/{event_id}/acknowledge", response_model=EventResponse)
async def acknowledge_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    event.acknowledged = True
    event.acknowledged_by = current_user.id
    event.acknowledged_at = datetime.now(timezone.utc)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    await db.delete(event)


@router.get("/{event_id}/snapshot")
async def get_snapshot(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event or not event.snapshot_path:
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")
    if not os.path.exists(event.snapshot_path):
        raise HTTPException(status_code=404, detail="Archivo de snapshot no encontrado")
    return FileResponse(event.snapshot_path, media_type="image/jpeg")
