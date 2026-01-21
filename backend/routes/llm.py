"""LLM generation routes with Server-Sent Events streaming."""

import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class GenerateRequest(BaseModel):
    """Request model for LLM generation."""

    prompt: str
    systemPrompt: Optional[str] = None
    options: Optional[dict] = None


class ModelInfo(BaseModel):
    """Response model for model information."""

    modelName: str
    modelPath: str
    parameters: int
    parametersFormatted: str
    contextSize: int


@router.get("/model")
async def get_model_info():
    """Get information about the currently loaded LLM model."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{settings.llm_base_url}/v1/models")
            response.raise_for_status()
            data = response.json()

        model = data.get("data", [{}])[0] if data.get("data") else {}

        if not model:
            raise HTTPException(status_code=404, detail="No model found")

        # Extract model info
        model_path = model.get("id", "")
        model_filename = model_path.split("/")[-1] if model_path else ""

        # Parse model name for readability
        model_name = model_filename.replace(".gguf", "")
        if "gemma" in model_name.lower():
            parts = model_name.split("_")
            last_parts = parts[-3:] if len(parts) >= 3 else parts
            combined = "_".join(last_parts)
            model_name = (
                combined.replace("google-", "Google ")
                .replace("google_", "Google ")
                .replace("gemma", "Gemma")
                .replace("-3n", " 3n")
                .replace("_3n", " 3n")
                .replace("-E4B", " E4B")
                .replace("_E4B", " E4B")
                .replace("-it", " Instruct")
                .replace("_it", " Instruct")
            )

        params = model.get("meta", {}).get("n_params", 0)
        params_formatted = f"{params / 1_000_000_000:.1f}B" if params else "Unknown"

        return {
            "modelName": model_name or "Unknown Model",
            "modelPath": model_filename,
            "parameters": params,
            "parametersFormatted": params_formatted,
            "contextSize": model.get("meta", {}).get("n_ctx_train", 0),
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(status_code=503, detail=f"LLM server unavailable: {e}")
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def generate_text(request: GenerateRequest):
    """Generate text using LLM with Server-Sent Events streaming."""

    async def stream_generator():
        """Generator that streams LLM output as SSE."""
        try:
            # Build messages
            messages = []
            if request.systemPrompt:
                messages.append({"role": "system", "content": request.systemPrompt})
            messages.append({"role": "user", "content": request.prompt})

            # Get options
            options = request.options or {}
            temperature = options.get("temperature", 0.7)
            max_tokens = options.get("maxTokens", 2000)

            # Prepare request body
            body = {
                "model": "default",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,
            }

            logger.info(f"Starting LLM generation stream to {settings.llm_base_url}")

            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{settings.llm_base_url}/v1/chat/completions",
                    json=body,
                    headers={"Content-Type": "application/json"},
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        logger.error(f"LLM error: {response.status_code} - {error_text}")
                        yield f"data: {json.dumps({'error': f'LLM error: {response.status_code}'})}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        # Handle SSE format from llama.cpp
                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix

                            if data == "[DONE]":
                                yield f"data: {json.dumps({'done': True})}\n\n"
                                break

                            try:
                                chunk = json.loads(data)
                                content = (
                                    chunk.get("choices", [{}])[0]
                                    .get("delta", {})
                                    .get("content", "")
                                )
                                if content:
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue

        except httpx.HTTPError as e:
            logger.error(f"HTTP error during streaming: {e}")
            yield f"data: {json.dumps({'error': f'Connection error: {e}'})}\n\n"
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate/sync")
async def generate_text_sync(request: GenerateRequest):
    """Generate text using LLM (non-streaming, returns complete response)."""
    try:
        # Build messages
        messages = []
        if request.systemPrompt:
            messages.append({"role": "system", "content": request.systemPrompt})
        messages.append({"role": "user", "content": request.prompt})

        # Get options
        options = request.options or {}
        temperature = options.get("temperature", 0.7)
        max_tokens = options.get("maxTokens", 2000)

        body = {
            "model": "default",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.llm_base_url}/v1/chat/completions",
                json=body,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        return {"content": content, "done": True}

    except httpx.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=503, detail=f"LLM server unavailable: {e}")
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
