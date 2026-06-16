# Makan (مكان) — Saudi Property Aggregator & Broker Finder

Makan is a high-performance Saudi real estate aggregator and broker discovery platform. It scrapes real-time data across 13 major real estate portals in Saudi Arabia, presenting unified property search and active broker scouting under a single bilingual (English/Arabic RTL) user interface.

---

## 📂 Project Architecture & File Structure

```text
Property Finder/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # Application entry point & CORS configuration
│   ├── shared.py             # Constants, KSA city coordinates, and helper utilities
│   ├── property_scraper.py   # Scraper engines for 13 property platforms
│   ├── broker_scraper.py     # Scraper engines & merge controller for real estate brokers
│   ├── requirements.txt      # Python package dependencies
│   └── vercel.json           # Vercel deployment configuration
├── frontend/                 # Main consumer frontend (React)
│   ├── src/
│   │   ├── App.js            # Main property search container
│   │   ├── index.css         # Styling system
│   │   ├── i18n.js           # Multi-language framework (EN/AR)
│   │   └── components/       # UI Components (Map, Grids, Cards, Detail view)
│   └── package.json          # React packages & scripts (starts on port 3000)
├── broker-frontend/          # Broker scouting dashboard (Vite + React + Tailwind)
│   ├── src/
│   │   ├── App.js            # Broker lookup & merge dashboard
│   │   ├── i18n.js           # Localization mapping (EN/AR)
│   │   └── components/       # Broker grids, cards, and filters
│   ├── vite.config.js        # Vite settings (starts on port 3001)
│   └── package.json          # Vite packages & scripts
└── start.sh                  # One-click startup script (starts backend & main frontend)
```

---

## ⚙️ Backend Core Modules

The backend runs on **FastAPI** (port `8000`) and serves real-time scraped information dynamically without requiring an internal database.

### 1. Scraping Engine (`property_scraper.py`)
Scrapes listings across 13 Saudi property platforms:
*   **Bayut**: Targets Bayut's public **Algolia Index** (`bayut-sa-production-ads-city-level-score-ar`) directly. It requests multiple pages in parallel using `asyncio.gather` for exceptional speed.
*   **Aqar**: Fetches **React Server Components (RSC) streams** from `aqar.fm` and extracts raw listing JSON using regular expressions.
    *   *Cloudflare Bypass*: Integrates with a local **FlareSolverr** service (`http://localhost:8191/v1`) as a fallback to bypass JS challenge protection.
    *   *Geofencing*: Uses bounding box verification for major cities to filter out incorrect coordinates.
    *   *District Localization*: Automatically translates input English query terms to Arabic (via `deep-translator`) to request exact district-specific Aqar endpoints.
*   **PropertyFinder & Wasalt**: Crawls search page HTML and extracts listing data from Next.js `<script id="__NEXT_DATA__">` tags.
*   **Other Platforms**: Fallback scraping and indexing for *Sakani, Haraj, OpenSooq, Expatriates, Mourjan, Satel, Zaahib, Bezaat, and SaudiDeal*.

### 2. Broker Aggregator & Merger (`broker_scraper.py`)
Fetches active real estate brokers from multiple directories and live listings:
*   **BrokerMerger**: Ingests scraped contacts and groups them uniquely by their **phone number** (normalized using `_clean_phone`).
*   **Aggregation Rules**:
    *   Integrates multiple active platforms per broker (e.g., `["Bayut", "Aqar"]`).
    *   Sums up their total properties listed under a merged `listing_count`.
    *   Appends all unique districts they work in to the `areas` list.

### 3. API Endpoints
*   `GET /api/platforms`: Meta configurations for all supported portals.
*   `GET /api/locations`: Real-time city/area/district autocomplete suggestions via Bayut Algolia index.
*   `GET /api/stream` (SSE): Real-time event stream of scraped properties. Yields listings instantly as they are collected from each platform.
*   `GET /api/brokers` (SSE): Real-time event stream of active real estate brokers matching the searched location.
*   `GET /api/properties`: Standard JSON endpoint for batch scraping.
*   `GET /api/cities`: List of supported cities.
*   `GET /health`: Engine status check.

---

## 💻 Frontend Applications

### 1. Makan Search Frontend (`frontend/` - Port `3000`)
The main user application built with Create React App.
*   **Dynamic Layouts**: Supports switching between **Grid View** (cards sorted by price, rooms, or area) and **Map View** (Leaflet map with marker clustering).
*   **Draw Search**: Users can draw search boundaries directly on the map to filter listings within coordinates.
*   **Localization (`i18n.js`)**: Seamless support for English and Arabic. When Arabic is selected, the application dynamically flips to Right-to-Left (RTL) mode.
*   **Data Export**: Features a CSV exporter that generates clean spreadsheets of current search results containing prices, platforms, contacts, and coordinates.

### 2. Broker Finder Frontend (`broker-frontend/` - Port `3001`)
A professional tool built with Vite, React, and Tailwind CSS.
*   Allows agency-specific and broker-specific searches inside city/district limits.
*   Provides instant filtering on brokers' names, agencies, and platforms.
*   Features an Excel Exporter utilizing the `xlsx` library to generate formal `.xlsx` sheets of broker profiles, listing numbers, and contact details.

---

## 🚀 Execution & Running Instructions

### 1. Standard Mode (Backend & Main Frontend)
Run the automated shell script from the project root:
```bash
./start.sh
```
*This command creates the backend python environment, installs dependencies from `requirements.txt` and `package.json`, starts the FastAPI backend (port `8000`), and runs the React app (port `3000`).*

### 2. Broker Finder Mode
Open a separate terminal window and run:
```bash
cd broker-frontend
npm install
npm run dev
```
*This starts the Vite server for the broker search dashboard on port `3001`.*

### 3. FlareSolverr Integration (Optional for Aqar Scraper)
To ensure the Aqar scraper works continuously when Cloudflare challenges are active, run FlareSolverr in the background (default port `8191`):
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  --restart always \
  ghcr.io/flaresolverr/flaresolverr:latest
```
