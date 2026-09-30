"""
NeuraMotion API - FastAPI application entry point.

Architecture:
  - FastAPI web server with CORS middleware
  - JWT-based authentication (issued on top of Supabase Auth)
  - Supabase Postgres for data persistence (profiles, videos)
  - Diffusion-based text-to-video generation engine (mock or GPU mode)
  - Row Level Security on all tables

Run:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes import auth_routes, video_routes, profile_routes, health_routes

settings = get_settings()

app = FastAPI(
    title="NeuraMotion API",
    description="AI video generation platform - text-to-video backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route groups under the API prefix
prefix = settings.api_prefix
app.include_router(health_routes.router, prefix=prefix)
app.include_router(auth_routes.router, prefix=prefix)
app.include_router(video_routes.router, prefix=prefix)
app.include_router(profile_routes.router, prefix=prefix)


@app.get("/")
async def root():
    return {
        "service": "NeuraMotion API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": f"{prefix}/health",
    }
