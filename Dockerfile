# Ultra-lean Python 3.11 for low-memory cloud hosts (Render 512MB RAM)
FROM python:3.11-slim

# Enforce strict single-threaded execution and low-memory allocation
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    OMP_NUM_THREADS=1 \
    MALLOC_TRIM_THRESHOLD_=100000

# Install minimal runtime libraries for OpenCV
RUN apt-get update && apt-get install --no-install-recommends -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install lightweight CPU-only PyTorch (avoids 2.5GB CUDA bloat and build OOM)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# 2. Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy application code
COPY . .

# Expose port (Render automatically sets $PORT)
EXPOSE 8000

# Start Uvicorn with 1 worker to keep RAM footprint well below 100MB
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
