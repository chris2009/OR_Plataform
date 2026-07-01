import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.event import Event
from app.models.user import User, UserRole
from app.schemas.event import EventResponse, EventStats, GroupedCount

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
    week_start = today_start - timedelta(days=6)  # últimos 7 días, incluido hoy

    total_today = (
        await db.execute(
            select(func.count(Event.id)).where(Event.timestamp >= today_start)
        )
    ).scalar_one()

    # "Hoy", consistente con total_today (antes era todo el histórico, lo
    # cual hacía que "Top clase" nunca coincidiera con lo que se veía en
    # la tabla filtrada por el día actual).
    by_class_rows = (
        await db.execute(
            select(Event.detected_class, func.count(Event.id).label("cnt"))
            .where(Event.timestamp >= today_start)
            .group_by(Event.detected_class)
            .order_by(func.count(Event.id).desc())
        )
    ).all()
    by_class = {r.detected_class: r.cnt for r in by_class_rows}

    by_camera_rows = (
        await db.execute(
            select(Event.camera_name, func.count(Event.id).label("cnt"))
            .where(Event.timestamp >= today_start)
            .group_by(Event.camera_name)
            .order_by(func.count(Event.id).desc())
        )
    ).all()
    by_camera = {r.camera_name: r.cnt for r in by_camera_rows}

    hour_expr = func.date_part("hour", Event.timestamp).label("hour")
    by_hour_rows = (
        await db.execute(
            select(
                hour_expr,
                func.count(Event.id).label("cnt"),
            )
            .where(Event.timestamp >= today_start)
            .group_by(hour_expr)
            .order_by(hour_expr)
        )
    ).all()
    by_hour = [{"hour": int(r.hour), "count": r.cnt} for r in by_hour_rows]

    # Últimos 7 días × clase (para el gráfico agrupado por día)
    day_expr = func.to_char(Event.timestamp, "YYYY-MM-DD").label("day")
    day_class_rows = (
        await db.execute(
            select(day_expr, Event.detected_class, func.count(Event.id).label("cnt"))
            .where(Event.timestamp >= week_start)
            .group_by(day_expr, Event.detected_class)
            .order_by(day_expr)
        )
    ).all()
    day_map: dict[str, dict[str, int]] = {}
    for r in day_class_rows:
        day_map.setdefault(r.day, {})[r.detected_class] = r.cnt
    by_day = [
        GroupedCount(group=d, counts=day_map.get(d, {}))
        for d in (
            (week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)
        )
    ]

    # Últimos 7 días × cámara × clase (para el gráfico agrupado por fuente)
    source_rows = (
        await db.execute(
            select(Event.camera_name, Event.detected_class, func.count(Event.id).label("cnt"))
            .where(Event.timestamp >= week_start)
            .group_by(Event.camera_name, Event.detected_class)
            .order_by(Event.camera_name)
        )
    ).all()
    source_map: dict[str, dict[str, int]] = {}
    for r in source_rows:
        source_map.setdefault(r.camera_name, {})[r.detected_class] = r.cnt
    by_source = [GroupedCount(group=cam, counts=counts) for cam, counts in source_map.items()]

    # Valores distintos de todo el histórico, para poblar los filtros del datatable
    all_classes = [
        r[0] for r in (await db.execute(
            select(Event.detected_class).distinct().order_by(Event.detected_class)
        )).all()
    ]
    all_cameras = [
        r[0] for r in (await db.execute(
            select(Event.camera_name).distinct().order_by(Event.camera_name)
        )).all()
    ]

    return EventStats(
        total_today=total_today,
        by_class=by_class,
        by_camera=by_camera,
        by_hour=by_hour,
        by_day=by_day,
        by_source=by_source,
        all_classes=all_classes,
        all_cameras=all_cameras,
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
