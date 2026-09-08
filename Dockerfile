# ==============================================================================
# Production Python Runtime (FastAPI Unified Server + Pre-built Cesium Static Frontend)
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install minimal system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python production dependencies
COPY backend/requirements-prod.txt /app/backend/requirements-prod.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-prod.txt

# Copy ocean data foundation
COPY data-pipeline/processed /app/data-pipeline/processed

# Copy backend code
COPY backend /app/backend

# Copy compiled production frontend static bundle directly (avoids memory-heavy Node build on Render free tier)
COPY frontend/out /app/frontend/out

# Set non-root permissions for cloud security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Workdir inside backend so main.py runs cleanly
WORKDIR /app/backend

# Environment configuration (Render sets $PORT=10000 dynamically)
ENV PORT=10000 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1

EXPOSE 7860 8000 10000

# Start unified Uvicorn server using shell expansion for $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
