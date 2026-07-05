# syntax=docker/dockerfile:1

# Multi-stage Dockerfile for the FastAPI backend.

# ---------------------- Builder stage ----------------------
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build dependencies for psycopg2-binary and bcrypt.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies into a virtual environment for easy copy.
COPY requirements.txt .
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---------------------- Runtime stage ----------------------
FROM python:3.13-slim AS runtime

WORKDIR /app

# libpq runtime library only (no compiler).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtual environment from the builder.
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code.
COPY src/app ./app
COPY alembic ./alembic
COPY alembic.ini .

# Run migrations and start the application.
# In production, run migrations separately in an init container or job.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
