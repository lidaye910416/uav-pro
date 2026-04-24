from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserInDB(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserPublic(UserBase):
    id: int
    role: str
    is_active: bool

    class Config:
        from_attributes = True
