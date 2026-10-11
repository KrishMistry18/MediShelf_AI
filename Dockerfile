# MediShelf AI — Production & Staging Backend Container
FROM python:3.11-slim

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    ENVIRONMENT=staging

WORKDIR /app

# Install system runtime dependencies for OpenCV and EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU build of PyTorch
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu

# Install backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Pre-fetch EasyOCR models so runtime requires zero external network calls
RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False, download_enabled=True)"

# Copy application code, pre-computed model checkpoints, and knowledge base
COPY backend ./backend
COPY ml ./ml
COPY data ./data
COPY tools ./tools
COPY medishelf.db ./medishelf.db

# Validate knowledge base on build
RUN python -c "import sqlite3; conn = sqlite3.connect('data/medicines/medicine_knowledge.db'); count = conn.execute('SELECT COUNT(*) FROM medicines_master').fetchone()[0]; print(f'Verified {count} records in knowledge base'); assert count >= 27000"

EXPOSE 8000

# Health check verifies the live FastAPI health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["python", "tools/serve_api.py", "--host", "0.0.0.0", "--port", "8000", "--no-reload"]
