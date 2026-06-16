# 🏠 Saudi Property Finder

Real-time property aggregator for Saudi Arabia — scrapes Bayut, Aqar, Wasalt, PropertyFinder & 9 more platforms simultaneously.

## Tech Stack
- **Backend**: FastAPI + Python (curl_cffi for anti-bot bypass)
- **Frontend**: React + Vite + Leaflet Maps
- **Deployment**: Docker Compose (VPS)

---

## 🚀 VPS Deployment (Hostinger / Any Linux VPS)

### Prerequisites
- Ubuntu 22.04 VPS
- Domain/subdomain pointing to VPS IP
- Nginx already installed on VPS

### Step 1 — Install Docker on VPS
```bash
ssh root@YOUR_VPS_IP
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

### Step 2 — Clone & Configure
```bash
cd /opt
git clone https://github.com/DeveloperSarim/saudi-property-finder.git
cd saudi-property-finder

# Create .env from template
cp .env.example .env
nano .env
```

Fill in your `.env`:
```env
DOMAIN=property.yourdomain.com
VITE_API_URL=https://property.yourdomain.com/api
CORS_ORIGINS=https://property.yourdomain.com
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

### Step 3 — Add Nginx Site Config
```bash
# Copy provided config
cp nginx/nginx-vps-site.conf /etc/nginx/sites-available/property-finder

# Replace YOUR_DOMAIN in the file
sed -i 's/YOUR_DOMAIN/property.yourdomain.com/g' /etc/nginx/sites-available/property-finder

# Enable the site
ln -s /etc/nginx/sites-available/property-finder /etc/nginx/sites-enabled/

# Test and reload Nginx
nginx -t && systemctl reload nginx
```

### Step 4 — Get Free SSL
```bash
certbot --nginx -d property.yourdomain.com
```

### Step 5 — Build & Launch
```bash
cd /opt/saudi-property-finder
docker compose up -d --build
```

First build takes 3–5 minutes. When done:
```bash
docker compose ps          # All services should show "healthy"
curl https://property.yourdomain.com/health  # Should return {"status":"ok"}
```

---

## 🔄 Update Deployment

```bash
cd /opt/saudi-property-finder
git pull
docker compose up -d --build
```

## 📋 Useful Commands

```bash
# View logs
docker compose logs -f

# Backend logs only
docker compose logs -f backend

# Restart backend
docker compose restart backend

# Stop all
docker compose down
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | — | Your domain (required) |
| `VITE_API_URL` | — | Full API URL including /api (required) |
| `CORS_ORIGINS` | `*` | Frontend domain for CORS |
| `BACKEND_PORT` | `8001` | Change if port is taken |
| `FRONTEND_PORT` | `3001` | Change if port is taken |

> **Note**: If ports 8001 or 3001 are already used by other apps on your VPS, change them in `.env`.
