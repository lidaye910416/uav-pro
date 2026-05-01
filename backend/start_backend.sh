#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
PYTHON="$SCRIPT_DIR/.venv/bin/python3"
PYTHONPATH="$SCRIPT_DIR" exec "$PYTHON" -m uvicorn main:app --host 0.0.0.0 --port 8888
