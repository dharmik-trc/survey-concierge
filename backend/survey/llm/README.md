# AI Report Analyzer - Ollama

The AI Chat uses **Ollama** (local, free) to analyze survey data.

## Setup

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3.2` (or `ollama pull mistral`)
3. Ollama runs automatically; if not: `ollama serve`

## Configuration

Optional environment variables:

```bash
OLLAMA_BASE_URL=http://localhost:11434   # default
OLLAMA_MODEL=llama3.2                    # default
```

**Docker:** When running the backend in Docker, use `host.docker.internal` so the container can reach Ollama on the host:

```bash
OLLAMA_BASE_URL=http://host.docker.internal:11434
```
