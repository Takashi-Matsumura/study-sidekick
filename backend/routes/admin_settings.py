"""Settings management API routes."""

import json
import logging
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Settings file path
SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

DEFAULT_SETTINGS = {
    "system_prompt": """あなたは人事評価のアドバイザーです。
評価者が適切な評価を行えるよう、以下のサポートを提供します：

- 評価基準の説明と解釈
- フィードバックの書き方のアドバイス
- 評価スコアの妥当性確認
- 成長目標の設定支援

回答は日本語で、簡潔かつ具体的に行ってください。
参考資料が提供された場合は、その内容を踏まえて回答してください。"""
}


def load_settings() -> dict:
    """Load settings from file."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load settings: {e}")
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict) -> None:
    """Save settings to file."""
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save settings: {e}")
        raise


class SystemPromptRequest(BaseModel):
    """System prompt update request."""
    system_prompt: str


@router.get("/system-prompt")
async def get_system_prompt():
    """Get current system prompt."""
    try:
        settings = load_settings()
        return {
            "system_prompt": settings.get("system_prompt", DEFAULT_SETTINGS["system_prompt"]),
            "default_prompt": DEFAULT_SETTINGS["system_prompt"],
        }
    except Exception as e:
        logger.error(f"Failed to get system prompt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get system prompt: {str(e)}"
        )


@router.put("/system-prompt")
async def update_system_prompt(request: SystemPromptRequest):
    """Update system prompt."""
    try:
        settings = load_settings()
        settings["system_prompt"] = request.system_prompt
        save_settings(settings)

        logger.info("System prompt updated")

        return {
            "success": True,
            "message": "System prompt updated successfully",
        }
    except Exception as e:
        logger.error(f"Failed to update system prompt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update system prompt: {str(e)}"
        )


@router.post("/system-prompt/reset")
async def reset_system_prompt():
    """Reset system prompt to default."""
    try:
        settings = load_settings()
        settings["system_prompt"] = DEFAULT_SETTINGS["system_prompt"]
        save_settings(settings)

        logger.info("System prompt reset to default")

        return {
            "success": True,
            "message": "System prompt reset to default",
            "system_prompt": DEFAULT_SETTINGS["system_prompt"],
        }
    except Exception as e:
        logger.error(f"Failed to reset system prompt: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset system prompt: {str(e)}"
        )
