"""LLM client for llama.cpp server."""

import logging
import json
from typing import List, Dict, Any, AsyncGenerator
import httpx

from config import settings
from models import Message
from system_prompts import get_system_prompt

logger = logging.getLogger(__name__)


class LLMClient:
    """Client for llama.cpp OpenAI-compatible API."""

    def __init__(self):
        """Initialize LLM client."""
        self.base_url = settings.llm_base_url
        self.timeout = httpx.Timeout(120.0, connect=10.0)

    async def chat_completion(
        self,
        messages: List[Message],
        stream: bool = True,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        Generate chat completion using llama.cpp.

        Args:
            messages: Conversation history
            stream: Whether to stream the response
            temperature: Sampling temperature

        Yields:
            Response chunks (if streaming)
        """
        try:
            logger.info("Calling llama.cpp API")

            # Convert messages to dict format
            messages_dict = [
                {"role": msg.role, "content": msg.content}
                for msg in messages
            ]

            # Add system prompt if not present
            if not messages_dict or messages_dict[0].get("role") != "system":
                system_prompt = get_system_prompt()
                messages_dict.insert(0, {"role": "system", "content": system_prompt})

            payload = {
                "messages": messages_dict,
                "temperature": temperature,
                "stream": stream,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if stream:
                    # Streaming response
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/v1/chat/completions",
                        json=payload,
                    ) as response:
                        response.raise_for_status()

                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                data = line[6:]  # Remove "data: " prefix

                                if data == "[DONE]":
                                    break

                                # Parse llama.cpp format and extract content
                                try:
                                    parsed = json.loads(data)
                                    # llama.cpp format: {"choices": [{"delta": {"content": "..."}}]}
                                    choices = parsed.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            # Return in simplified format for frontend
                                            yield json.dumps({"content": content})
                                except json.JSONDecodeError:
                                    # Pass through if not valid JSON
                                    logger.warning(f"Failed to parse LLM response: {data}")
                                    continue

                else:
                    # Non-streaming response
                    response = await client.post(
                        f"{self.base_url}/v1/chat/completions",
                        json=payload,
                    )
                    response.raise_for_status()
                    yield response.text

        except httpx.HTTPError as e:
            logger.error(f"LLM API HTTP error: {e}")
            raise
        except Exception as e:
            logger.error(f"LLM API error: {e}")
            raise


def create_rag_prompt(context: List[Dict[str, Any]], question: str) -> str:
    """
    Create a prompt with RAG context.

    Args:
        context: List of context items from RAG search
        question: User's question

    Returns:
        Formatted prompt with context
    """
    if not context:
        return question

    # Build context section
    context_parts = []
    for i, item in enumerate(context, 1):
        content = item["content"]
        metadata = item.get("metadata", {})
        filename = metadata.get("filename", "unknown")

        context_parts.append(
            f"[参考資料 {i}: {filename}]\n{content}"
        )

    context_text = "\n\n".join(context_parts)

    # Create prompt with context
    prompt = f"""{question}

参考資料:
{context_text}"""

    return prompt


# Global LLM client instance
llm_client = LLMClient()
