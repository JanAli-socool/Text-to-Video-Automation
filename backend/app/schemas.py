"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


# ---- Auth ----
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=2, max_length=30)
    full_name: str = Field(default="", max_length=100)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    avatar_url: str
    plan: str
    credits: int


# ---- Video ----
class VideoCreateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)
    style: str = Field(default="cinematic")
    duration: int = Field(default=5, ge=1, le=60)
    aspect_ratio: str = Field(default="16:9", pattern="^(16:9|9:16|1:1)$")
    model: str = Field(default="neura-motion-v1")
    is_public: bool = True


class VideoResponse(BaseModel):
    id: str
    title: str
    prompt: str
    style: str
    status: str
    thumbnail_url: str
    video_url: str
    duration: int
    aspect_ratio: str
    is_public: bool
    likes_count: int
    views_count: int
    model: str
    created_at: datetime
    creator: Optional["CreatorResponse"] = None


class CreatorResponse(BaseModel):
    id: str
    username: str
    full_name: str
    avatar_url: str


class VideoListResponse(BaseModel):
    videos: list[VideoResponse]
    total: int


class GenerationStatusResponse(BaseModel):
    video_id: str
    status: str
    progress: int = 0
    video_url: Optional[str] = None


# ---- Profile ----
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


TokenResponse.model_rebuild()
VideoResponse.model_rebuild()
