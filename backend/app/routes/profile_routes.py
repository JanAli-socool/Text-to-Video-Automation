"""
Profile routes.

GET   /api/v1/profiles/{username}  - Get a public profile by username
PATCH /api/v1/profiles/me          - Update the current user's profile
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.db import get_supabase
from app.auth import get_current_user
from app.schemas import UserResponse, ProfileUpdateRequest, CreatorResponse

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/{username}", response_model=CreatorResponse)
async def get_profile(username: str):
    """Get a public profile by username."""
    sb = get_supabase()
    result = sb.table("profiles").select("id, username, full_name, avatar_url").eq("username", username).single().execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    return CreatorResponse(**result.data)


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    req: ProfileUpdateRequest,
    user: UserResponse = Depends(get_current_user),
):
    """Update the current user's profile (name, bio, avatar)."""
    sb = get_supabase()

    updates = {}
    if req.full_name is not None:
        updates["full_name"] = req.full_name
    if req.bio is not None:
        updates["bio"] = req.bio
    if req.avatar_url is not None:
        updates["avatar_url"] = req.avatar_url

    if updates:
        sb.table("profiles").update(updates).eq("id", user.id).execute()

    # Fetch updated profile
    result = sb.table("profiles").select("*").eq("id", user.id).single().execute()
    profile = result.data or {}

    return UserResponse(
        id=user.id,
        email=user.email,
        username=profile.get("username", user.username),
        full_name=profile.get("full_name", user.full_name),
        avatar_url=profile.get("avatar_url", user.avatar_url),
        plan=profile.get("plan", user.plan),
        credits=profile.get("credits", user.credits),
    )
