"""
JWT utilities.

The backend issues its own JWT tokens on top of Supabase Auth.
Flow:
  1. Client signs up / signs in via Supabase Auth (through this API or the Supabase JS client).
  2. Backend verifies the Supabase session and issues a backend JWT.
  3. Client sends the backend JWT in the Authorization header for all subsequent requests.
  4. Backend decodes the JWT to identify the user on every protected route.
"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import get_settings
from fastapi import HTTPException, status

ALGORITHM = "HS256"


def create_access_token(user_id: str, email: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
