"""
Health check and root routes.
"""
from fastapi import APIRouter
from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    s = get_settings()
    return {
        "status": "ok",
        "service": "neuramotion-api",
        # Names and booleans only, never values.
        "video_provider": s.video_provider,
        "provider_token_set": bool(s.video_provider_token),
        "provider_model": s.video_provider_model or None,
        "gpu_enabled": s.enable_gpu_generation,
    }
