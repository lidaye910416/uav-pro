FROM python:3.12-slim

WORKDIR /app

# Install system deps for opencv and git for segment-anything
# Also add curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 git curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

RUN mkdir -p /app/data/chromadb

EXPOSE 8888

# 用 shell 形式以便读取 ${BACKEND_PORT:-8888}
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8888}"]

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:${BACKEND_PORT:-8888}/health || exit 1
