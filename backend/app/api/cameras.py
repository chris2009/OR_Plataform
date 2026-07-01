import os
import shutil
import uuid
from typing import List

import cv2
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_operator_or_admin
from app.core.config import settings
from app.core.security import decrypt_camera_password, encrypt_camera_password
from app.db.session import get_db
from app.models.camera import Camera, SourceType
from app.models.user import User, UserRole
from app.schemas.camera import CameraCreate, CameraResponse, CameraUpdate
from app.services.detection.engine import detection_engine

router = APIRouter(prefix="/cameras", tags=["cameras"])

MAX_ACTIVE = 2


async def _count_active(db: AsyncSession) -> int:
    """Cuenta solo fuentes RTSP/video activas. Las imágenes se procesan una
    sola vez (sin loop de inferencia continuo) y no cuentan para el límite."""
    result = await db.execute(
        select(func.count()).where(
            Camera.is_active == True, Camera.source_type != SourceType.image
        )
    )
    return result.scalar_one()


async def _get_camera_or_404(camera_id: int, db: AsyncSession, user: User) -> Camera:
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    cam = result.scalar_one_or_none()
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    if user.role != UserRole.admin and cam.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Sin permisos sobre esta cámara")
    return cam


@router.get("", response_model=List[CameraResponse])
async def list_cameras(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.admin:
        result = await db.execute(select(Camera))
    else:
        result = await db.execute(select(Camera).where(Camera.owner_id == current_user.id))
    return result.scalars().all()


@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    payload: CameraCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    if (
        payload.is_active
        and payload.source_type != SourceType.image
        and await _count_active(db) >= MAX_ACTIVE
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Límite de {MAX_ACTIVE} fuentes RTSP/video activas alcanzado",
        )
    cam = Camera(
        **payload.model_dump(exclude={"password"}),
        password_encrypted=encrypt_camera_password(payload.password),
        owner_id=current_user.id,
    )
    db.add(cam)
    await db.flush()
    await db.refresh(cam)
    if cam.is_active and cam.detection_enabled:
        await detection_engine.start_camera(cam)
    return cam


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: int,
    payload: CameraUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    cam = await _get_camera_or_404(camera_id, db, current_user)
    was_active = cam.is_active

    update_data = payload.model_dump(exclude_none=True)
    password = update_data.pop("password", None)

    # Validar límite si se está activando (no aplica a fuentes tipo imagen)
    new_source_type = update_data.get("source_type", cam.source_type)
    if update_data.get("is_active") and not was_active and new_source_type != SourceType.image:
        if await _count_active(db) >= MAX_ACTIVE:
            raise HTTPException(status_code=400, detail=f"Límite de {MAX_ACTIVE} fuentes RTSP/video activas alcanzado")

    for field, value in update_data.items():
        setattr(cam, field, value)
    if password is not None:
        cam.password_encrypted = encrypt_camera_password(password)

    db.add(cam)
    await db.flush()
    await db.refresh(cam)

    # Reiniciar worker si cambió algo relevante
    if was_active:
        await detection_engine.stop_camera(camera_id)
    if cam.is_active and cam.detection_enabled:
        await detection_engine.start_camera(cam)

    return cam


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    cam = await _get_camera_or_404(camera_id, db, current_user)
    await detection_engine.stop_camera(camera_id)
    await db.delete(cam)


@router.post("/{camera_id}/test-connection")
async def test_connection(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    cam = await _get_camera_or_404(camera_id, db, current_user)
    if cam.source_type != SourceType.rtsp:
        return {"ok": True, "message": "Fuente de tipo local, no requiere test"}

    url = cam.stream_url
    if cam.username:
        pwd = decrypt_camera_password(cam.password_encrypted)
        # Inyectar credenciales en la URL RTSP
        proto, rest = url.split("://", 1) if "://" in url else ("rtsp", url)
        url = f"{proto}://{cam.username}:{pwd}@{rest}"

    cap = cv2.VideoCapture(url)
    ok = cap.isOpened()
    cap.release()
    if not ok:
        raise HTTPException(status_code=400, detail="No se pudo conectar al stream RTSP")
    return {"ok": True, "message": "Conexión exitosa"}


@router.post("/upload-media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(require_operator_or_admin),
):
    allowed_video = {".mp4", ".avi", ".mkv", ".mov", ".webm"}
    allowed_image = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()

    if ext in allowed_video:
        source_type = "video"
    elif ext in allowed_image:
        source_type = "image"
    else:
        raise HTTPException(status_code=400, detail="Tipo de archivo no soportado")

    filename = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(settings.UPLOADS_DIR, filename)
    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {"filename": filename, "path": dest, "source_type": source_type}


@router.get("/{camera_id}/snapshot")
async def get_snapshot(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import Response as FastAPIResponse
    import base64

    cam = await _get_camera_or_404(camera_id, db, current_user)
    frame = await detection_engine.get_latest_frame(camera_id)
    if frame is None:
        raise HTTPException(status_code=404, detail="No hay frame disponible para esta cámara")

    _, buf = cv2.imencode(".jpg", frame)
    return FastAPIResponse(content=buf.tobytes(), media_type="image/jpeg")
