from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.camera import Camera
from app.models.detection_profile import DetectionProfile
from app.models.user import User
from app.schemas.detection_profile import (
    DetectionProfileCreate,
    DetectionProfileResponse,
    DetectionProfileUpdate,
)

router = APIRouter(prefix="/detection-profiles", tags=["detection-profiles"])


@router.get("", response_model=List[DetectionProfileResponse])
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(DetectionProfile).order_by(DetectionProfile.created_at))
    return result.scalars().all()


@router.post("", response_model=DetectionProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: DetectionProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    profile = DetectionProfile(**payload.model_dump(), created_by=current_user.id)
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=DetectionProfileResponse)
async def update_profile(
    profile_id: int,
    payload: DetectionProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(DetectionProfile).where(DetectionProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(DetectionProfile).where(DetectionProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    await db.delete(profile)


@router.post("/{profile_id}/apply-all")
async def apply_profile_to_all(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(DetectionProfile).where(DetectionProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    cameras_result = await db.execute(select(Camera).where(Camera.is_active == True))
    cameras = cameras_result.scalars().all()

    for cam in cameras:
        cam.classes_filter = profile.classes
        db.add(cam)

    await db.flush()
    return {"detail": f"Perfil '{profile.name}' aplicado a {len(cameras)} cámaras activas"}
