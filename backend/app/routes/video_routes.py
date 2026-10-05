"""
Video routes.

POST   /api/v1/videos              - Create (generate) a new video
GET    /api/v1/videos              - List public videos (feed)
GET    /api/v1/videos/{id}         - Get a single video by ID
GET    /api/v1/videos/me           - List the current user's videos
PATCH  /api/v1/videos/{id}         - Update video metadata (title, visibility)
DELETE /api/v1/videos/{id}         - Delete a video
POST   /api/v1/videos/{id}/like    - Like a video
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.db import get_supabase
from app.auth import get_current_user
from app.schemas import (
    UserResponse,
    VideoCreateRequest,
    VideoResponse,
    VideoListResponse,
    CreatorResponse,
)
from app.video_engine import generate_video
from app.providers.replicate import ProviderError
from app.config import get_settings
import asyncio

router = APIRouter(prefix="/videos", tags=["videos"])


def _row_to_response(row: dict) -> VideoResponse:
    """Convert a database row to a VideoResponse schema."""
    creator = None
    if row.get("profiles"):
        p = row["profiles"]
        creator = CreatorResponse(
            id=p.get("id", ""),
            username=p.get("username", ""),
            full_name=p.get("full_name", ""),
            avatar_url=p.get("avatar_url", ""),
        )
    return VideoResponse(
        id=row["id"],
        title=row.get("title", ""),
        prompt=row.get("prompt", ""),
        style=row.get("style", "cinematic"),
        status=row.get("status", "processing"),
        thumbnail_url=row.get("thumbnail_url", ""),
        video_url=row.get("video_url", ""),
        duration=row.get("duration", 5),
        aspect_ratio=row.get("aspect_ratio", "16:9"),
        is_public=row.get("is_public", True),
        likes_count=row.get("likes_count", 0),
        views_count=row.get("views_count", 0),
        model=row.get("model", "neura-motion-v1"),
        created_at=row.get("created_at"),
        creator=creator,
    )


@router.post("", response_model=VideoResponse)
async def create_video(
    req: VideoCreateRequest,
    user: UserResponse = Depends(get_current_user),
):
    """
    Start a video generation job.

    1. Check the user has enough credits.
    2. Insert a video record with status='processing'.
    3. Launch the generation pipeline (async background task in production).
    4. Update the record to status='completed' when done.

    In mock mode, the generation completes within this request.
    In production, this would return immediately with status='processing'
    and the client would poll or subscribe via WebSocket for updates.
    """
    sb = get_supabase()

    # Calculate credit cost
    credit_cost = req.duration
    if req.model == "neura-motion-v2":
        credit_cost += 2
    elif req.model == "diffusion-cine":
        credit_cost += 5

    if user.credits < credit_cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. This generation costs {credit_cost} credits, "
            f"but you have {user.credits}.",
        )

    # Insert video record. `title` is NOT NULL in the Supabase schema.
    generated_title = " ".join(req.prompt.strip().split()[:4]).title() or "Untitled Creation"
    insert_result = (
        sb.table("videos")
        .insert({
            "user_id": user.id,
            "title": generated_title,
            "prompt": req.prompt,
            "style": req.style,
            "status": "processing",
            "duration": req.duration,
            "aspect_ratio": req.aspect_ratio,
            "is_public": req.is_public,
            "model": req.model,
            "thumbnail_url": "",
            "video_url": "",
        })
        .execute()
    )

    if not insert_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create video record.",
        )

    video_id = insert_result.data[0]["id"]

    # Run generation (hosted provider, GPU, or mock). Provider failures become
    # a visible failed record instead of an unhandled 500 response.
    try:
        result = await generate_video(
            prompt=req.prompt,
            style=req.style,
            duration=req.duration,
            aspect_ratio=req.aspect_ratio,
            model=req.model,
        )
    except ProviderError as exc:
        sb.table("videos").update({"status": "failed"}).eq("id", video_id).execute()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    # Never mark `completed` without a deliverable asset. Mock mode deliberately
    # produces no file, so that case becomes a visible failure, and credits stay
    # with the user.
    delivered = bool(result.get("video_url"))
    sb.table("videos").update({
        "status": "completed" if delivered else "failed",
        "title": result["title"],
        "thumbnail_url": result["thumbnail_url"] if delivered else "",
        "video_url": result["video_url"] if delivered else "",
    }).eq("id", video_id).execute()

    if delivered:
        # Deduct credits
        sb.table("profiles").update({"credits": user.credits - credit_cost}).eq("id", user.id).execute()
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VIDEO_PROVIDER is not set to a working provider; no video was rendered.",
        )

    # Return the completed video
    final = (
        sb.table("videos")
        .select("*, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("id", video_id)
        .single()
        .execute()
    )

    return _row_to_response(final.data)


@router.get("", response_model=VideoListResponse)
async def list_videos(
    sort: str = Query("trending", pattern="^(trending|recent)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List public, completed videos for the discover feed."""
    sb = get_supabase()
    order_col = "likes_count" if sort == "trending" else "created_at"

    result = (
        sb.table("videos")
        .select("*, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("is_public", True)
        .eq("status", "completed")
        .order(order_col, desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    videos = [_row_to_response(r) for r in (result.data or [])]
    return VideoListResponse(videos=videos, total=len(videos))


@router.get("/me", response_model=VideoListResponse)
async def list_my_videos(
    user: UserResponse = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List the current user's videos (including private and processing)."""
    sb = get_supabase()

    result = (
        sb.table("videos")
        .select("*, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    videos = [_row_to_response(r) for r in (result.data or [])]
    return VideoListResponse(videos=videos, total=len(videos))


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str,
    user: Optional[UserResponse] = Depends(get_current_user),
):
    """Get a single video by ID. Public videos are visible to all authenticated users."""
    sb = get_supabase()

    result = (
        sb.table("videos")
        .select("*, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("id", video_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found.",
        )

    row = result.data

    # Check visibility: private videos only visible to owner
    if not row.get("is_public") and row.get("user_id") != (user.id if user else None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video.",
        )

    # Increment view count
    sb.table("videos").update({"views_count": row.get("views_count", 0) + 1}).eq("id", video_id).execute()

    return _row_to_response(row)


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: str,
    title: Optional[str] = None,
    is_public: Optional[bool] = None,
    user: UserResponse = Depends(get_current_user),
):
    """Update video metadata. Only the owner can update."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("videos").select("user_id").eq("id", video_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")
    if existing.data["user_id"] != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the video owner.")

    updates = {}
    if title is not None:
        updates["title"] = title
    if is_public is not None:
        updates["is_public"] = is_public

    if updates:
        sb.table("videos").update(updates).eq("id", video_id).execute()

    result = (
        sb.table("videos")
        .select("*, profiles:profiles!videos_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("id", video_id)
        .single()
        .execute()
    )
    return _row_to_response(result.data)


@router.delete("/{video_id}")
async def delete_video(
    video_id: str,
    user: UserResponse = Depends(get_current_user),
):
    """Delete a video. Only the owner can delete."""
    sb = get_supabase()

    existing = sb.table("videos").select("user_id").eq("id", video_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")
    if existing.data["user_id"] != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the video owner.")

    sb.table("videos").delete().eq("id", video_id).execute()
    return {"message": "Video deleted successfully"}


@router.post("/{video_id}/like")
async def like_video(
    video_id: str,
    user: UserResponse = Depends(get_current_user),
):
    """Like a video (increments likes_count)."""
    sb = get_supabase()

    result = sb.table("videos").select("likes_count").eq("id", video_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")

    new_count = result.data["likes_count"] + 1
    sb.table("videos").update({"likes_count": new_count}).eq("id", video_id).execute()

    return {"likes_count": new_count}
