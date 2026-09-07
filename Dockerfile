# ==============================================================================
# Stage 1: Build Frontend Static Export (Next.js + Cesium)
# ==============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ ./

# Build static production export (outputs to /app/frontend/out)
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# ==============================================================================
# Stage 2: Production Python Runtime (FastAPI Unified Server)
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system utilities
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

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/frontend/out /app/frontend/out

# Set permissions for Hugging Face Spaces (runs as non-root user 1000)
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Workdir inside backend so main.py runs cleanly
WORKDIR /app/backend

# Environment configuration
ENV PORT=7860 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1

# Expose default port (7860 for Hugging Face, Render sets $PORT dynamically)
EXPOSE 7860 8000 10000

# Start unified Uvicorn server using shell expansion for $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
