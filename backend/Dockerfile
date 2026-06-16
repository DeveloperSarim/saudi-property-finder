FROM python:3.11-slim

# Install system deps for curl_cffi (needs gcc + libcurl)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libcurl4-openssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (Docker layer caching — faster rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# Run with 2 workers — enough for concurrent scraping without memory issues
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "310"]
