"""
Authentication dependency.

Extracts and validates the JWT from the Authorization header,
then loads the user's profile from Supabase.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.jwt_utils import decode_access_token
from app.db import get_supabase
from app.schemas import UserResponse

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserResponse:
    """Validate the bearer token and return the authenticated user."""
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    sb = get_supabase()
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
