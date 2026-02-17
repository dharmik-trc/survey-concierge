"""Base class for LLM providers - implement this to add new providers."""

from abc import ABC, abstractmethod
from typing import List, Optional


class BaseLLMProvider(ABC):
    """Abstract base for LLM providers. Subclass and implement to add OpenAI, Anthropic, etc."""

    @abstractmethod
    def chat(
        self,
        messages: List[dict],
        *,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """
        Send chat completion request.

        Args:
            messages: List of {"role": "user"|"assistant"|"system", "content": "..."}
            system_prompt: Optional system message (some providers handle this separately)
            max_tokens: Max response length
            temperature: 0-1, lower = more deterministic

        Returns:
            Assistant reply text
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is configured and reachable."""
        pass
