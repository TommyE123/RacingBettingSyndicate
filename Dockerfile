# Backend (FastAPI) image. The Next.js frontend has its own image: frontend/Dockerfile.
FROM python:3.14-slim@sha256:a2b82f3c48559aa0a8446d9af49826b6e2b2016f4cd2afabfe6013ec53729170

LABEL maintainer="Racing Betting Syndicate"
LABEL description="Racing Betting Syndicate backend API"

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Run as an unprivileged user
RUN useradd --system --create-home --uid 10001 appuser \
    && mkdir -p /data \
    && chown appuser /data
USER 10001

# 8420 - backend API
EXPOSE 8420

# Health check: the backend must serve GET /health
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8420/health', timeout=5)"]

CMD ["python", "-m", "app.main"]
