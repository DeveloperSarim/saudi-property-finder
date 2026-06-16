import React, { useEffect, useRef, useState, useCallback } from "react";
import { t } from "../i18n";

// ── Platform colours ──────────────────────────────────────────────────────────
const PLATFORM_COLORS = {
  Bayut: "#10b981", Aqar: "#38bdf8", PropertyFinder: "#f59e0b",
  Wasalt: "#a78bfa", Sakani: "#34d399", Haraj: "#fb923c",
  OpenSooq: "#e879f9", Expatriates: "#60a5fa", Mourjan: "#f472b6",
  Satel: "#fbbf24", Zaahib: "#4ade80", Bezaat: "#c084fc", SaudiDeal: "#f87171",
};
const pc = (n) => PLATFORM_COLORS[n] || "#10b981";

// ── City pins ────────────────────────────────────────────────────────────────
const CITIES = [
  { name:"Riyadh",         lat:24.7136, lng:46.6753 },
  { name:"Jeddah",         lat:21.4858, lng:39.1925 },
  { name:"Mecca",          lat:21.3891, lng:39.8579 },
  { name:"Medina",         lat:24.5247, lng:39.5692 },
  { name:"Dammam",         lat:26.4207, lng:50.0888 },
  { name:"Al Khobar",      lat:26.2172, lng:50.1971 },
  { name:"Abha",           lat:18.2164, lng:42.5053 },
  { name:"Tabuk",          lat:28.3998, lng:36.5716 },
  { name:"Buraidah",       lat:26.3292, lng:43.9744 },
  { name:"Khamis Mushait", lat:18.3056, lng:42.7292 },
  { name:"Hail",           lat:27.5114, lng:41.7208 },
  { name:"Al Taif",        lat:21.2827, lng:40.4138 },
  { name:"Yanbu",          lat:24.0892, lng:38.0618 },
  { name:"Najran",         lat:17.4924, lng:44.1277 },
  { name:"Jazan",          lat:16.8892, lng:42.5511 },
];

function fmt(p, rentPeriod) {
  if (!p) return "POA";
  const num = p.toLocaleString("en-US");
  return rentPeriod ? `${num} SAR${rentPeriod}` : `${num} SAR`;
}

// ── Load Leaflet from CDN (avoids npm install) ───────────────────────────────
let leafletLoaded = false;
let leafletPromise = null;

function loadLeaflet() {
  if (window.L) { leafletLoaded = true; return Promise.resolve(window.L); }
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => { leafletLoaded = true; resolve(window.L); };
    js.onerror = reject;
    document.head.appendChild(js);
  });
  return leafletPromise;
}

export default function MapView({ listings, selectedCity, onCitySelect, onAreaSearch, onListingClick, lang = "en" }) {
  const mapDiv = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const cityMarkersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [drawLayer, setDrawLayer] = useState(null);
  const selectModeRef = useRef(false);
  const drawStart = useRef(null);
  const drawRect = useRef(null);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadLeaflet().then((L) => {
      if (mapRef.current || !mapDiv.current) return;

      const map = L.map(mapDiv.current, {
        center: [23.8859, 45.0792],
        zoom: 5,
        zoomControl: false,
        maxBounds: [[10, 30], [35, 60]],
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      setReady(true);

      // Area drag-select
      let isDragging = false;
      map.on("mousedown", (e) => {
        if (!selectModeRef.current) return;
        isDragging = true;
        drawStart.current = e.latlng;
        if (drawRect.current) { drawRect.current.remove(); drawRect.current = null; }
      });
      map.on("mousemove", (e) => {
        if (!isDragging || !selectModeRef.current || !drawStart.current) return;
        if (drawRect.current) drawRect.current.remove();
        drawRect.current = L.rectangle(
          L.latLngBounds(drawStart.current, e.latlng),
          { color: "#10b981", weight: 2, fillOpacity: 0.08, fillColor: "#10b981" }
        ).addTo(map);
      });
      map.on("mouseup", (e) => {
        if (!isDragging || !selectModeRef.current) return;
        isDragging = false;
        if (!drawStart.current) return;
        const bounds = L.latLngBounds(drawStart.current, e.latlng);
        if (Math.abs(bounds.getNorth() - bounds.getSouth()) > 0.01) {
          const center = bounds.getCenter();
          onAreaSearch?.({ lat: center.lat, lng: center.lng, bounds });
          selectModeRef.current = false;
          setSelectMode(false);
        }
        drawStart.current = null;
      });
    }).catch(console.error);

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // ── Fly to selected city ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !selectedCity) return;
    const city = CITIES.find(c => c.name.toLowerCase() === selectedCity.toLowerCase());
    if (city) mapRef.current.flyTo([city.lat, city.lng], 12, { duration: 1.2 });
  }, [selectedCity, ready]);

  // ── Sync selectMode ref ───────────────────────────────────────────────────
  useEffect(() => { selectModeRef.current = selectMode; }, [selectMode]);

  // ── City pins (when no listings) ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || !window.L) return;
    const L = window.L;
    cityMarkersRef.current.forEach(m => m.remove());
    cityMarkersRef.current = [];
    if (listings.length > 0) return;

    CITIES.forEach(city => {
      const isSelected = selectedCity?.toLowerCase() === city.name.toLowerCase();
      const m = L.circleMarker([city.lat, city.lng], {
        radius: isSelected ? 10 : 6,
        fillColor: isSelected ? "#10b981" : "#334155",
        color: isSelected ? "#10b981" : "#475569",
        weight: 2, fillOpacity: 1,
      }).addTo(mapRef.current);

      m.bindTooltip(city.name, { permanent: false, direction: "top", className: "leaflet-tooltip-dark" });
      m.on("click", () => onCitySelect?.(city.name));
      cityMarkersRef.current.push(m);
    });
  }, [listings.length, selectedCity, ready]);

  // ── Property markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (listings.length === 0) return;

    listings.forEach((listing, i) => {
      if (!listing.lat || !listing.lng) return;
      const color = pc(listing.source_platform_name);

      const m = L.circleMarker([listing.lat, listing.lng], {
        radius: 8, fillColor: color, color: "#0f172a",
        weight: 1.5, fillOpacity: 0.85,
      }).addTo(mapRef.current);

      const popup = L.popup({ maxWidth: 260, className: "prop-popup" });
      // Normalize phone — strip country code variants, then prepend 966
      const waNum = (() => {
        const p = listing.contact_number;
        if (!p) return "";
        const d = String(p).replace(/\D/g, "");
        const local = d.startsWith("00966") ? d.slice(5)
                    : d.startsWith("966") && d.length > 9 ? d.slice(3)
                    : d.startsWith("0") ? d.slice(1) : d;
        return local.length >= 8 ? `966${local}` : "";
      })();
      const waMsg = encodeURIComponent(`مرحباً، أود الاستفسار عن: ${listing.title}\n${listing.source_url}`);

      popup.setContent(`
        <div style="font-family:'DM Sans',sans-serif;background:#1e293b;border-radius:12px;overflow:hidden;min-width:220px;border:1px solid #334155">
          ${listing.image_url ? `<img src="${listing.image_url}" style="width:100%;height:120px;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none'"/>` : ""}
          <div style="padding:12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <span style="background:${color}22;color:${color};border:1px solid ${color}44;font-size:10px;font-family:monospace;padding:2px 8px;border-radius:6px">${listing.source_platform_name}</span>
            </div>
            <p style="color:#e2e8f0;font-size:12px;font-weight:600;line-height:1.4;margin:0 0 6px;max-height:36px;overflow:hidden">${listing.title}</p>
            <p style="color:${color};font-family:monospace;font-size:16px;font-weight:700;margin:0 0 4px">${fmt(listing.price_sar, listing.rent_period)}</p>
            <p style="color:#64748b;font-size:11px;margin:0 0 8px">${listing.location_detail}</p>
            <div style="display:flex;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:10px">
              ${listing.bedrooms!=="N/A"?`<span>🛏 ${listing.bedrooms}</span>`:""}
              ${listing.bathrooms!=="N/A"?`<span>🚿 ${listing.bathrooms}</span>`:""}
              ${listing.area_sqm>0?`<span>📐 ${listing.area_sqm}m²</span>`:""}
            </div>
            <div style="display:flex;gap:6px">
              <a href="${listing.source_url}" target="_blank" rel="noopener"
                 style="flex:1;text-align:center;padding:6px;border-radius:8px;background:#334155;color:#cbd5e1;font-size:11px;font-family:monospace;text-decoration:none">
                View on ${listing.source_platform_name}
              </a>
              ${waNum ? `<a href="https://wa.me/${waNum}?text=${waMsg}" target="_blank" rel="noopener"
                 style="flex:1;text-align:center;padding:6px;border-radius:8px;background:#25d36622;color:#25d366;border:1px solid #25d36644;font-size:11px;font-family:monospace;text-decoration:none">
                WhatsApp
              </a>` : ""}
            </div>
          </div>
        </div>
      `);
      m.bindPopup(popup);
      m.on("click", () => onListingClick?.(listing));
      markersRef.current.push(m);
    });
  }, [listings, ready]);

  const platforms = [...new Set(listings.map(l => l.source_platform_name))];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-700/60">
      {/* Map container */}
      <div ref={mapDiv} className="w-full h-full" style={{ background:"#0f172a" }} />

      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button onClick={() => setSelectMode(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-600
                      border shadow-lg transition-all
            ${selectMode
              ? "bg-emerald-500 border-emerald-400 text-slate-900"
              : "bg-slate-800/90 border-slate-600 text-slate-300 hover:border-emerald-500/50"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          {selectMode ? t(lang,"dragToSelect") : t(lang,"areaSelect")}
        </button>
      </div>

      {/* Count badge */}
      {listings.length > 0 && (
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5
                        bg-slate-900/90 border border-slate-700 rounded-xl text-xs font-mono text-emerald-400 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
          {listings.length} {t(lang,"listingsOnMap")}
        </div>
      )}

      {/* Platform legend */}
      {platforms.length > 0 && (
        <div className="absolute bottom-10 left-3 z-[1000] bg-slate-900/90 border border-slate-700
                        rounded-xl px-3 py-2 flex flex-col gap-1.5 shadow-lg max-h-52 overflow-y-auto">
          {platforms.map(name => (
            <div key={name} className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pc(name) }} />
              {name}
            </div>
          ))}
        </div>
      )}

      {/* Instruction */}
      {selectMode && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95
                        border border-emerald-500/40 rounded-xl px-4 py-2 text-xs font-mono
                        text-emerald-400 shadow-lg pointer-events-none whitespace-nowrap">
          {t(lang,"dragInstruction")}
        </div>
      )}

      {/* City hint */}
      {listings.length === 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/80
                        border border-slate-700 rounded-xl px-4 py-2 text-xs font-mono
                        text-slate-400 pointer-events-none whitespace-nowrap">
          {t(lang,"clickCity")}
        </div>
      )}
    </div>
  );
}
