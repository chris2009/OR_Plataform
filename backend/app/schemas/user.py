from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str = ""
    role: UserRole = UserRole.viewer
    is_active: bool = True
    theme_preference: str = "dark"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    theme_preference: Optional[str] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    theme_preference: Optional[str] = None
    password: Optional[str] = None
