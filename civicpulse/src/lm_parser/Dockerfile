# Use Python 3.11 (matches other CivicPulse modules)
FROM python:3.11-slim

# --------------------------------------------------------------------------
# Environment setup
# --------------------------------------------------------------------------
ENV UV_LINK_MODE=copy
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

# --------------------------------------------------------------------------
# System dependencies
# --------------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------
# Install uv and sync deps
# --------------------------------------------------------------------------
RUN pip install --no-cache-dir --upgrade pip && \
    pip install uv

# Copy dependency files early for caching
WORKDIR /app
COPY pyproject.toml ./
RUN uv sync --no-dev --frozen || uv sync --no-dev

# --------------------------------------------------------------------------
# Copy project source
# --------------------------------------------------------------------------
COPY . /app

# --------------------------------------------------------------------------
# Set working directory
# --------------------------------------------------------------------------
WORKDIR /app

# --------------------------------------------------------------------------
# Set up entrypoint script
# --------------------------------------------------------------------------
RUN chmod +x ./docker-entrypoint.sh

# --------------------------------------------------------------------------
# Default entrypoint
# --------------------------------------------------------------------------
ENV CIVICPULSE_PROCESSING_OUTPUT_DIR=/app/backend/processing/output
ENV CIVICPULSE_DB_PATH=/app/backend/data/civicpulse.db

ENTRYPOINT ["./docker-entrypoint.sh"]

