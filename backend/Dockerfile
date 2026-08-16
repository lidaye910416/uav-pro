# syntax=docker/dockerfile:1.6
# Requires BuildKit (Docker Desktop / buildx). Enables --mount=type=cache for pip wheel caching.

# Build arg: torch variant for current platform.
#   cpu   - Apple Silicon / arm64 / no-GPU dev (default, fast build, ~1GB wheels)
#   cu130 - linux/amd64 production with NVIDIA GPU (CUDA 13, ~3GB wheels)
ARG TORCH_VARIANT=cpu

FROM python:3.12-slim

WORKDIR /app

# Switch APT mirror to aliyun for fast access from CN networks (deb.debian.org is slow from CN)
# python:3.12-slim uses /etc/apt/sources.list.d/debian.sources (deb822 format), not sources.list
RUN find /etc/apt/sources.list.d/ -type f -name '*.list' -o -name '*.sources' | xargs sed -i \
    -e 's|deb.debian.org|mirrors.aliyun.com|g' \
    -e 's|http://|https://|g' 2>/dev/null || true

# Install system deps for opencv and git for segment-anything
# Also add curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 git curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

# Install Python deps with BuildKit pip wheel cache (persistent across builds on the build host).
# The cache mount is NOT committed to the final image — wheels stay on the host for the next build.
# Default index = aliyun PyPI (fast in CN); --extra-index-url adds download.pytorch.org for torch
# wheels (which aliyun does not mirror). Order: aliyun first, pytorch.org as fallback for torch.
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,target=/root/.cache/pip-http \
    pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip install --upgrade pip \
    && pip install --extra-index-url https://download.pytorch.org/whl/${TORCH_VARIANT} -r requirements.txt

COPY backend/ ./

RUN mkdir -p /app/data/chromadb

EXPOSE 8888

# 用 shell 形式以便读取 ${BACKEND_PORT:-8888}
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8888}"]

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:${BACKEND_PORT:-8888}/health || exit 1