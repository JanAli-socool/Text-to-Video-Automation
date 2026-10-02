"""
Authentication dependency.

Extracts and validates the JWT from the Authorization header,
then loads the user's profile from Supabase.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Header
from app.jwt_utils import decode_access_token
from app.db import get_supabase
from app.config import get_settings
from app.schemas import UserResponse

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    x_preview_user_id: str | None = Header(default=None),
) -> UserResponse:
    """Validate Supabase/backend JWT, with a workspace-only preview fallback."""
    sb = get_supabase()
    settings = get_settings()

    # The workspace browser can lose the Authorization header at the preview
    # gateway. This fallback is enabled only for the local preview and still
    # requires the user to have a real profile row in this Supabase project.
    if not credentials and settings.preview_dev_auth and x_preview_user_id:
        user_id = x_preview_user_id
        email = ""
        result = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if result.data:
            profile = result.data
            return UserResponse(id=profile["id"], email=email, username=profile.get("username", ""), full_name=profile.get("full_name", ""), avatar_url=profile.get("avatar_url", ""), plan=profile.get("plan", "free"), credits=profile.get("credits", 0))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Preview user profile not found")

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials

    # Accept the backend JWT and native Supabase Auth access tokens. This lets
    # the Expo client call the API directly after normal Supabase login.
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        email = payload.get("email", "")
    except Exception:
        try:
            auth_user = sb.auth.get_user(token)
            user_id = auth_user.user.id if auth_user.user else None
            email = auth_user.user.email or "" if auth_user.user else ""
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = sb.table("profiles").select("*").eq("id", user_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    profile = result.data
    return UserResponse(
        id=profile["id"],
        email=email,
        username=profile.get("username", ""),
        full_name=profile.get("full_name", ""),
        avatar_url=profile.get("avatar_url", ""),
        plan=profile.get("plan", "free"),
        credits=profile.get("credits", 0),
    )
