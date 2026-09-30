"""
Authentication routes.

POST /api/v1/auth/signup   - Create a new account
POST /api/v1/auth/signin   - Sign in and receive a JWT
GET  /api/v1/auth/me       - Get current user profile
POST /api/v1/auth/signout  - Sign out (client-side token invalidation)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.config import get_settings
from app.db import get_supabase
from app.jwt_utils import create_access_token
from app.auth import get_current_user
from app.schemas import (
    SignUpRequest,
    SignInRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
async def signup(req: SignUpRequest):
    """
    Create a new user account via Supabase Auth.
    A profile row is auto-created by a database trigger.
    Returns a backend JWT for subsequent API calls.
    """
    sb = get_supabase()
    settings = get_settings()

    result = sb.auth.sign_up({
        "email": req.email,
        "password": req.password,
        "options": {
            "data": {
                "username": req.username,
                "full_name": req.full_name,
            }
        },
    })

    if not result.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sign-up failed. Please try again.",
        )

    # Fetch the auto-created profile
    profile_result = (
        sb.table("profiles")
        .select("*")
        .eq("id", result.user.id)
        .single()
        .execute()
    )

    profile = profile_result.data or {}
    token = create_access_token(result.user.id, req.email)

    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expiry_hours * 3600,
        user=UserResponse(
            id=result.user.id,
            email=req.email,
            username=profile.get("username", req.username),
            full_name=profile.get("full_name", req.full_name),
            avatar_url=profile.get("avatar_url", ""),
            plan=profile.get("plan", "free"),
            credits=profile.get("credits", 10),
        ),
    )


@router.post("/signin", response_model=TokenResponse)
async def signin(req: SignInRequest):
    """
    Sign in with email/password via Supabase Auth.
    Returns a backend JWT.
    """
    sb = get_supabase()
    settings = get_settings()

    result = sb.auth.sign_in_with_password({
        "email": req.email,
        "password": req.password,
    })

    if not result.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Fetch profile
    profile_result = (
        sb.table("profiles")
        .select("*")
        .eq("id", result.user.id)
        .single()
        .execute()
    )

    profile = profile_result.data or {}
    token = create_access_token(result.user.id, req.email)

    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expiry_hours * 3600,
        user=UserResponse(
            id=result.user.id,
            email=req.email,
            username=profile.get("username", ""),
            full_name=profile.get("full_name", ""),
            avatar_url=profile.get("avatar_url", ""),
            plan=profile.get("plan", "free"),
            credits=profile.get("credits", 0),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: UserResponse = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return user


@router.post("/signout")
async def signout():
    """
    Sign out is handled client-side by discarding the JWT.
    The backend JWT is stateless, so there's no server-side session to revoke.
    """
    return {"message": "Signed out successfully"}
