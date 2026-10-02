"""Replicate text-to-video adapter.

The token stays server-side. Model/version are configured by environment so the
provider can be changed without touching the Expo app.
"""
import asyncio
from typing import Any
import httpx


class ProviderError(RuntimeError):
    pass


async def generate_with_replicate(*, prompt: str, duration: int, aspect_ratio: str, model: str, token: str, model_ref: str) -> dict[str, Any]:
    if not token:
        raise ProviderError("VIDEO_PROVIDER_TOKEN is missing")
    if "/" not in model_ref:
        raise ProviderError("VIDEO_PROVIDER_MODEL must be owner/model, for example bytedance/seedance-2.0")

    owner, name = model_ref.split("/", 1)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Seedance 2.0's documented inputs are prompt and duration. Do not send
    # generic model/aspect fields because strict providers reject unknown keys.
    payload = {"input": {"prompt": prompt, "duration": duration}}

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(f"https://api.replicate.com/v1/models/{owner}/{name}/predictions", headers=headers, json=payload)
        if response.is_error:
            raise ProviderError(f"Replicate create failed ({response.status_code}): {response.text[:500]}")
        prediction = response.json()
        poll_url = prediction.get("urls", {}).get("get")
        if not poll_url:
            raise ProviderError("Replicate did not return a polling URL")

        for _ in range(180):
            await asyncio.sleep(2)
            status_response = await client.get(poll_url, headers=headers)
            if status_response.is_error:
                raise ProviderError(f"Replicate poll failed ({status_response.status_code})")
            current = status_response.json()
            status = current.get("status")
            if status in {"succeeded", "successful"}:
                output = current.get("output")
                url = output[0] if isinstance(output, list) and output else output
                if not isinstance(url, str) or not url:
                    raise ProviderError("Replicate completed without a video URL")
                return {"video_url": url, "prediction_id": current.get("id")}
            if status in {"failed", "canceled"}:
                raise ProviderError(current.get("error") or f"Generation {status}")

        raise ProviderError("Timed out waiting for video generation")
