FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# Force APT to use IPv4 (Kaniko often has no IPv6)
RUN echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4

WORKDIR /app

# Copy requirements first to cache pip layer when app code changes
COPY requirements.txt /app

# System deps (same as yours)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
 && rm -rf /var/lib/apt/lists/*

# Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Your app (credentials.json is mounted at runtime via K8s Secret, not baked in)
COPY ./app /app/app

# Run as non-root user
RUN useradd --create-home appuser \
 && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
