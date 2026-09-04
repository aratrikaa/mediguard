# Use lightweight Python 3.11 image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install system dependencies required by OpenCV and EasyOCR
RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download EasyOCR English neural weights during build
# This prevents downloading model weights at container startup and avoids timeouts
RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False)"

# Copy the rest of the application code
COPY . .

# Expose port (Render injects $PORT dynamically)
EXPOSE 8000

# Start Uvicorn bound to 0.0.0.0 and dynamic $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
