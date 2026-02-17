"""Ollama LLM provider - runs models locally. Install: https://ollama.ai"""

import json
import logging
import os
from typing import List, Optional

from .base import BaseLLMProvider

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    """Local LLM via Ollama. Free, runs on your machine."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2")

    def chat(
        self,
        messages: List[dict],
        *,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        # Build messages for Ollama API
        payload_messages = []
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role in ("user", "assistant", "system") and content:
                payload_messages.append({"role": role, "content": content})

        if not payload_messages:
            return "No messages provided."

        try:
            import urllib.request
            import urllib.error

            body = json.dumps(
                {
                    "model": self.model,
                    "messages": payload_messages,
                    "stream": False,
                    "options": {
                        "num_predict": max_tokens,
                        "temperature": temperature,
                    },
                }
            ).encode("utf-8")
            req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode())
            return data.get("message", {}).get("content", "").strip()
        except urllib.error.URLError as e:
            logger.warning("Ollama request failed: %s", e)
            return (
                "Ollama is not reachable. Please ensure Ollama is running (ollama serve) "
                "and a model is pulled (e.g. ollama pull llama3.2)."
            )
        except Exception as e:
            logger.exception("Ollama error: %s", e)
            return f"Error calling Ollama: {str(e)}"

    def is_available(self) -> bool:
        try:
            import urllib.request

            req = urllib.request.Request(f"{self.base_url}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
            return bool(data.get("models"))
        except Exception:
            return False
