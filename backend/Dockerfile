FROM python:3.12-slim

WORKDIR /app

# Install system deps for opencv and git for segment-anything
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 git \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

EXPOSE 8000

# Override OLLAMA_BASE_URL and DATABASE_URL for Docker environment
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
