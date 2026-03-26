FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies from requirements.txt
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Run database migrations then start the server
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
