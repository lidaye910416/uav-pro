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

# Install torch/torchvision from pytorch.org FIRST (variant-aware).
# Use --index-url (not --extra-index-url) so pip only searches pytorch.org;
# aliyun mirror has torch but without +cpu/+cu130 suffix, which would otherwise
# shadow the pytorch.org wheels and pull CUDA torch on Mac dev.
#   cpu  -> --no-deps: PyTorch 2.5+ removed the `platform_machine == x86_64`
#           marker from its CUDA meta-deps, so on arm64 Mac pip would pull
#           ~3GB of nvidia-cublas/cudnn/cuda-toolkit wheels even for torch+cpu.
#           The cpu wheel is self-contained for CPU compute.
#   cu130 -> keep deps: CUDA runtime libs (cublas/cudnn) are required at
#           runtime for GPU on Windows prod.
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,target=/root/.cache/pip-http \
    pip install --upgrade pip \
    && if [ "$TORCH_VARIANT" = "cpu" ]; then \
         pip install --no-deps --index-url https://download.pytorch.org/whl/cpu torch torchvision; \
       else \
         pip install --index-url https://download.pytorch.org/whl/${TORCH_VARIANT} torch torchvision; \
       fi

# Install remaining deps from aliyun PyPI (torch/torchvision already installed).
# Filter out torch/torchvision lines so pip doesn't re-resolve them.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && grep -v -E '^(torch|torchvision)\b' requirements.txt > /tmp/req.txt \
    && pip install -r /tmp/req.txt

COPY backend/ ./

RUN mkdir -p /app/data/chromadb

EXPOSE 8888

# 用 shell 形式以便读取 ${BACKEND_PORT:-8888}
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8888}"]

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:${BACKEND_PORT:-8888}/health || exit 1