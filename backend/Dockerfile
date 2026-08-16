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
# We download wheels with curl directly into a local /tmp dir, then pip install
# from local files. This sidesteps pip's index-resolution quirks on PyTorch's
# non-standard /whl/<variant>/ HTML layout (it kept pulling wrong-variant
# wheels like torchvision+cu132 on Mac dev via --index-url / --find-links).
#
# Wheel URL pattern: https://download.pytorch.org/whl/<variant>/<wheel-filename>
# Note: NO /<pkg>/ subdir in the wheel URL — adding /torch/ or /torchvision/
# returns 403. Only the HTML index page has the /<pkg>/ subdir.
#
#   cpu  -> --no-deps: PyTorch 2.5+ removed the `platform_machine == x86_64`
#           marker from its CUDA meta-deps, so on arm64 Mac pip would pull
#           ~3GB of nvidia-cublas/cudnn/cuda-toolkit wheels even for torch+cpu.
#           The cpu wheel is self-contained for CPU compute.
#   cu130 -> keep deps: CUDA runtime libs (cublas/cudnn) are required at
#           runtime for GPU on Windows prod.
ARG TORCH_VARIANT=cpu
ARG TARGETARCH=aarch64  # set by buildx automatically; aarch64=Mac arm64, x86_64=Windows/Linux

RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,target=/root/.cache/pip-http \
    set -eux; \
    mkdir -p /tmp/torch-wheels; \
    cd /tmp/torch-wheels; \
    if [ "$TORCH_VARIANT" = "cpu" ]; then \
      TORCH_WHL=$(curl -fsSL https://download.pytorch.org/whl/cpu/torch/ \
        | grep -oE 'torch-2\.13\.0\+cpu-cp312-cp312-manylinux_2_28_'"${TARGETARCH}"'\.whl' \
        | head -1); \
      TV_WHL=$(curl -fsSL https://download.pytorch.org/whl/cpu/torchvision/ \
        | grep -oE 'torchvision-0\.28\.0\+cpu-cp312-cp312-manylinux_2_28_'"${TARGETARCH}"'\.whl' \
        | head -1); \
      # Note: '+' in wheel filename must be percent-encoded as %2B, otherwise
      # the CDN returns 403. Use python -c for reliable percent-encoding.
      TORCH_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$TORCH_WHL"); \
      TV_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$TV_WHL"); \
      curl -fsSLO "https://download.pytorch.org/whl/cpu/${TORCH_URL}"; \
      curl -fsSLO "https://download.pytorch.org/whl/cpu/${TV_URL}"; \
      pip install --no-deps --no-cache-dir --no-index ./*.whl; \
    else \
      TORCH_WHL=$(curl -fsSL "https://download.pytorch.org/whl/${TORCH_VARIANT}/torch/" \
        | grep -oE 'torch-2\.13\.0\+'"${TORCH_VARIANT}"'-cp312-cp312-manylinux_2_28_x86_64\.whl' \
        | head -1); \
      TV_WHL=$(curl -fsSL "https://download.pytorch.org/whl/${TORCH_VARIANT}/torchvision/" \
        | grep -oE 'torchvision-0\.28\.0\+'"${TORCH_VARIANT}"'-cp312-cp312-manylinux_2_28_x86_64\.whl' \
        | head -1); \
      TORCH_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$TORCH_WHL"); \
      TV_URL=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe='/'))" "$TV_WHL"); \
      curl -fsSLO "https://download.pytorch.org/whl/${TORCH_VARIANT}/${TORCH_URL}"; \
      curl -fsSLO "https://download.pytorch.org/whl/${TORCH_VARIANT}/${TV_URL}"; \
      pip install --no-cache-dir --no-index ./*.whl; \
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