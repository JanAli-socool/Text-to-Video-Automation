"""
Video generation engine.

In production this module loads a diffusion-based text-to-video model
(e.g., Stable Video Diffusion, AnimateDiff, or a custom pipeline) and
runs inference on a GPU worker. When GPU generation is disabled (the
default for development), it runs in mock mode that simulates the
generation pipeline with a delay and returns a placeholder thumbnail.

Architecture overview:

  text prompt
       |
       v
  +-------------------+
  | Text Encoder       |  (CLIP / T5 encoder)
  +-------------------+
       |
       v
  +-------------------+
  | Latent Diffusion   |  (U-Net denoising in latent space)
  +-------------------+
       |
       v
  +-------------------+
  | VAE Decoder        |  (latent -> pixel frames)
  +-------------------+
       |
       v
  +-------------------+
  | Frame Interpolation|  (RIFE / FILM for smooth motion)
  +-------------------+
       |
       v
  +-------------------+
  | Video Encoder      |  (FFmpeg -> MP4)
  +-------------------+
       |
       v
  output video file
"""
import os
import time
import random
import hashlib
import asyncio
from pathlib import Path
from typing import Callable

from app.config import get_settings

# Thumbnail pool used in mock mode
_THUMBNAIL_POOL = [
    "https://images.pexels.com/photos/6758832/pexels-photo-6758832.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/39630579/pexels-photo-39630579.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/1428148/pexels-photo-1428148.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/12024203/pexels-photo-12024203.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/36957437/pexels-photo-36957437.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/29101876/pexels-photo-29101876.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/20792947/pexels-photo-20792947.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/32491690/pexels-photo-32491690.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/6679202/pexels-photo-6679202.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/2694037/pexels-photo-2694037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/4233216/pexels-photo-4233216.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    "https://images.pexels.com/photos/30238186/pexels-photo-30238186.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
]

# Lazy-loaded model pipeline (only on GPU workers)
_pipeline = None


def _pick_thumbnail(prompt: str) -> str:
    h = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
    return _THUMBNAIL_POOL[h % len(_THUMBNAIL_POOL)]


def _generate_title(prompt: str) -> str:
    words = prompt.strip().split()[:4]
    return " ".join(w.capitalize() for w in words) or "Untitled Creation"


def _load_pipeline():
    """Load the diffusion model pipeline. Only called when GPU generation is enabled."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    try:
        import torch
        from diffusers import DiffusionPipeline

        settings = get_settings()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        _pipeline = DiffusionPipeline.from_pretrained(
            settings.model_id,
            torch_dtype=dtype,
        ).to(device)

        print(f"[video_engine] Model loaded on {device}")
    except ImportError:
        print("[video_engine] torch/diffusers not available, falling back to mock mode")
        _pipeline = "mock"
    except Exception as e:
        print(f"[video_engine] Failed to load model: {e}, falling back to mock mode")
        _pipeline = "mock"

    return _pipeline


async def generate_video(
    prompt: str,
    style: str,
    duration: int,
    aspect_ratio: str,
    model: str,
    on_progress: Callable[[int], None] | None = None,
) -> dict:
    """
    Run the text-to-video generation pipeline.

    Returns a dict with:
      - thumbnail_url: URL to the video thumbnail
      - video_url: URL to the generated MP4 (or empty string if still processing)
      - title: auto-generated title from the prompt
    """
    settings = get_settings()
    title = _generate_title(prompt)
    thumbnail_url = _pick_thumbnail(prompt)

    # Hosted provider mode is the recommended production path. It runs outside
    # the API process and avoids requiring a local CUDA GPU.
    if settings.video_provider.lower() == "replicate":
        from app.providers.replicate import generate_with_replicate
        result = await generate_with_replicate(
            prompt=prompt,
            duration=duration,
            aspect_ratio=aspect_ratio,
            model=model,
            token=settings.video_provider_token,
            model_ref=settings.video_provider_model,
        )
        return {
            "title": title,
            "thumbnail_url": thumbnail_url,
            "video_url": result["video_url"],
            "prediction_id": result.get("prediction_id"),
        }

    if not settings.enable_gpu_generation:
        # ---- Mock mode: simulate generation with progress ----
        total_steps = 20
        for i in range(1, total_steps + 1):
            await asyncio.sleep(settings.mock_generation_delay / total_steps)
            if on_progress:
                on_progress(int(i / total_steps * 100))

        video_url = f"https://cdn.neuramotion.ai/mock/{hashlib.md5(prompt.encode()).hexdigest()[:12]}.mp4"
        return {
            "title": title,
            "thumbnail_url": thumbnail_url,
            "video_url": video_url,
        }

    # ---- GPU mode: actual diffusion inference ----
    # This runs in a background task on a GPU worker.
    # The pipeline:
    #   1. Encode the text prompt via CLIP/T5
    #   2. Run U-Net denoising in latent space (N steps)
    #   3. Decode latents to pixel frames via VAE
    #   4. Interpolate frames for smooth motion
    #   5. Encode frames to MP4 via FFmpeg

    pipeline = _load_pipeline()

    if pipeline == "mock":
        # Fallback if model failed to load
        return await generate_video(
            prompt, style, duration, aspect_ratio, model, on_progress
        )

    # Determine frame count from duration (default 8 fps)
    num_frames = duration * 8

    # Run inference (this is blocking — in production, dispatch to a Celery/RQ worker)
    output = pipeline(
        prompt=f"{prompt}, {style} style, high quality, detailed",
        num_frames=num_frames,
        num_inference_steps=25,
        guidance_scale=9.0,
    )

    frames = output.frames[0]  # numpy array of shape (num_frames, H, W, 3)

    # Save frames as MP4
    os.makedirs(settings.output_dir, exist_ok=True)
    video_filename = f"{hashlib.md5(prompt.encode()).hexdigest()}.mp4"
    video_path = Path(settings.output_dir) / video_filename

    import imageio
    writer = imageio.get_writer(str(video_path), fps=8, codec="libx264")
    for frame in frames:
        writer.append_data(frame)
    writer.close()

    # In production, upload to S3/CDN and return the URL
    video_url = f"https://cdn.neuramotion.ai/{video_filename}"

    # Save first frame as thumbnail
    thumbnail_filename = f"{hashlib.md5(prompt.encode()).hexdigest()}.jpg"
    thumbnail_path = Path(settings.output_dir) / thumbnail_filename
    from PIL import Image
    Image.fromarray(frames[0]).save(str(thumbnail_path), quality=90)

    return {
        "title": title,
        "thumbnail_url": f"https://cdn.neuramotion.ai/{thumbnail_filename}",
        "video_url": video_url,
    }
