"""LLM layer for AI analyzer - uses Ollama (local)."""

from .provider_factory import get_llm_provider

__all__ = ["get_llm_provider"]
