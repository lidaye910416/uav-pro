#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p data/knowledge_base
PYTHON="$SCRIPT_DIR/.venv/bin/python3"
PYTHONPATH="$SCRIPT_DIR" exec "$PYTHON" -m uvicorn chromadb.app:app --host 0.0.0.0 --port 8001
