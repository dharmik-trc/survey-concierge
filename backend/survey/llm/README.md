# AI Report Analyzer - Ollama

The AI Chat uses **Ollama** (local, free) to analyze survey data.

## Setup

### Docker (recommended)

Ollama runs as a service in Docker Compose:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Pull the model (once):

```bash
docker compose -f docker-compose.dev.yml exec ollama ollama pull llama3.2
```

### Local install (no Docker)

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. Run: `ollama serve`

## Configuration

Optional environment variables:

```bash
OLLAMA_BASE_URL=http://localhost:11434   # default
OLLAMA_MODEL=llama3.2                    # default
```

- **Docker Compose:** `OLLAMA_BASE_URL` is set to `http://ollama:11434` by default.
- **Backend in Docker, Ollama on host:** use `OLLAMA_BASE_URL=http://host.docker.internal:11434`
