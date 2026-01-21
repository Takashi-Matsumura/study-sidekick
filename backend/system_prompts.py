"""System prompts for the RAG backend."""

from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

# Settings file path
SETTINGS_FILE = Path(__file__).parent / "settings.json"

DEFAULT_SYSTEM_PROMPT = """あなたは人事評価のアドバイザーです。
評価者が適切な評価を行えるよう、以下のサポートを提供します：

- 評価基準の説明と解釈
- フィードバックの書き方のアドバイス
- 評価スコアの妥当性確認
- 成長目標の設定支援

回答は日本語で、簡潔かつ具体的に行ってください。
参考資料が提供された場合は、その内容を踏まえて回答してください。"""


def get_system_prompt() -> str:
    """Get the current system prompt from settings or return default."""
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                settings = json.load(f)
                return settings.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    except Exception as e:
        logger.warning(f"Failed to load system prompt from settings: {e}")

    return DEFAULT_SYSTEM_PROMPT
