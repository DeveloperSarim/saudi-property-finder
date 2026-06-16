# 🏠 Saudi Property Finder

Real-time property aggregator for Saudi Arabia — scrapes Bayut, Aqar, Wasalt, PropertyFinder & 9 more platforms simultaneously.

## ⚡ One-Command VPS Deploy

SSH into your VPS and run **just this one command**:

```bash
curl -fsSL https://raw.githubusercontent.com/DeveloperSarim/saudi-property-finder/main/setup.sh | bash
```

That's it. The script automatically:
- ✅ Installs Docker (if not already installed)
- ✅ Clones this repo to `/opt/saudi-property-finder`
- ✅ Finds free ports (default 8001 backend, 3001 frontend)
- ✅ Creates `.env` config automatically
- ✅ Builds both containers (backend + frontend)
- ✅ Launches everything with `docker compose up -d`
- ✅ Configures Nginx site (if Nginx is installed)
- ✅ Shows you the URL to open in browser

---

## 🔄 Update to Latest Code

Same command — re-run it anytime to pull latest changes and rebuild:

```bash
curl -fsSL https://raw.githubusercontent.com/DeveloperSarim/saudi-property-finder/main/setup.sh | bash
```

---

## 📋 Useful Commands (After Deploy)

```bash
cd /opt/saudi-property-finder

# View logs
docker compose logs -f

# Backend logs only
docker compose logs -f backend

# Container status
docker compose ps

# Restart backend
docker compose restart backend

# Stop everything
docker compose down
```

---

## 🌐 Add Domain + SSL (Optional)

After the initial setup works with IP:

```bash
# 1. Add this to your domain DNS:
#    A Record: your-domain.com → YOUR_VPS_IP

# 2. Update Nginx config domain
sed -i 's/server_name .*/server_name your-domain.com;/' /etc/nginx/sites-available/saudi-property-finder
nginx -t && systemctl reload nginx

# 3. Get free SSL
certbot --nginx -d your-domain.com

# 4. Update .env with your domain
cd /opt/saudi-property-finder
echo "VITE_API_URL=https://your-domain.com/api" >> .env
echo "CORS_ORIGINS=https://your-domain.com" >> .env

# 5. Rebuild frontend with domain URL
docker compose up -d --build frontend
```

---

## Tech Stack
- **Backend**: FastAPI + Python (curl_cffi for anti-bot browser impersonation)
- **Frontend**: React + Vite + Leaflet Maps
- **Platforms**: Bayut, Aqar, PropertyFinder, Wasalt, Sakani, Haraj, OpenSooq, Expatriates, Mourjan, Satel, Zaahib, Bezaat, SaudiDeal
- **Deployment**: Docker Compose (VPS)
