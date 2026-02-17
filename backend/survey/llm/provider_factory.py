"""LLM provider - Ollama (local, free)."""

from .ollama import OllamaProvider


def get_llm_provider() -> OllamaProvider:
    """Return the Ollama LLM provider."""
    return OllamaProvider()
