"""
Application configuration.
Loaded from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- Supabase ---
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_db_url: str = ""

    # --- JWT ---
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    # --- Server ---
    cors_origins: list[str] = ["*"]
    api_prefix: str = "/api/v1"

    # --- Video Generation ---
    # Set to true only on a GPU worker. On CPU the pipeline runs in mock mode.
    enable_gpu_generation: bool = False
    model_id: str = "stable-diffusion-v1-5/stable-video-diffusion-img2vid-xt"
    output_dir: str = "./generated_videos"
    mock_generation_delay: int = 8  # seconds

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
