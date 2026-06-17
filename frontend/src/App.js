import React, { useState, useCallback, useRef } from "react";
import FilterPanel from "./components/FilterPanel";
import PropertyGrid from "./components/PropertyGrid";
import LoadingOverlay from "./components/LoadingOverlay";
import PropertyDetail from "./components/PropertyDetail";
import MapView from "./components/MapView";
import { t } from "./i18n";

// Auto-detect backend URL:
// - If VITE_API_URL is set (e.g. via .env), use it (for Nginx proxy: /api)
// - Otherwise use same hostname as frontend but port 8001 (direct VPS IP access)
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : "http://localhost:8001";

const ALL_PLATFORMS = [
  "bayut","aqar","propertyfinder","wasalt","sakani",
  "haraj","opensooq","expatriates","mourjan",
  "satel","zaahib","bezaat","saudideal",
];

const INIT = {
  location:"", listing_type:"sale", property_types:["apartment"],
  min_price:0, max_price:0, min_area:0, max_area:0, rooms:0,
  area_slug:"", district_slug:"",
};

const CITY_COORDS = {
  Riyadh:[24.7136,46.6753], Jeddah:[21.4858,39.1925], Mecca:[21.3891,39.8579],
  Medina:[24.5247,39.5692], Dammam:[26.4207,50.0888], "Al Khobar":[26.2172,50.1971],
  Abha:[18.2164,42.5053], Tabuk:[28.3998,36.5716], Buraidah:[26.3292,43.9744],
  "Khamis Mushait":[18.3056,42.7292], Hail:[27.5114,41.7208],
  "Al Taif":[21.2827,40.4138], Yanbu:[24.0892,38.0618],
  Najran:[17.4924,44.1277], Jazan:[16.8892,42.5511],
};
function nearestCity(lat, lng) {
  let best = "Riyadh", min = Infinity;
  for (const [city,[clat,clng]] of Object.entries(CITY_COORDS)) {
    const d = (lat-clat)**2 + (lng-clng)**2;
    if (d < min) { min = d; best = city; }
  }
  return best;
}

function getAreaSqm(listing) {
  const raw = listing?.area_sqm ?? listing?.area ?? listing?.size ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function App() {
  const [filters, setFilters]               = useState(INIT);
  const [platforms, setPlatforms]           = useState(ALL_PLATFORMS);
  const [listings, setListings]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [scanStatus, setScanStatus]         = useState(null);
  const [hasSearched, setHasSearched]       = useState(false);
  const [viewMode, setViewMode]             = useState("grid");
  const [selectedListing, setSelectedListing] = useState(null);
  const [lang, setLang]                     = useState("en");
  const [mapFilter, setMapFilter]           = useState(null);
  const esRef = useRef(null);

  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const filteredListings = React.useMemo(() => {
    if (!mapFilter) return listings;
    if (mapFilter.type === "bounds") {
      const { southWest, northEast } = mapFilter.value;
      return listings.filter(l => {
        if (!l.lat || !l.lng) return false;
        return l.lat >= southWest.lat && l.lat <= northEast.lat &&
               l.lng >= southWest.lng && l.lng <= northEast.lng;
      });
    }
    if (mapFilter.type === "radius") {
      const { lat, lng } = mapFilter.center;
      const r = mapFilter.radiusKm;
      return listings.filter(l => {
        if (!l.lat || !l.lng) return false;
        return getDistance(lat, lng, l.lat, l.lng) <= r;
      });
    }
    return listings;
  }, [listings, mapFilter, getDistance]);

  const handleExportCSV = useCallback(() => {
    if (filteredListings.length === 0) return;
    const headers = [
      "Title",
      "Price (SAR)",
      "Period",
      "Location Detail",
      "Bedrooms",
      "Bathrooms",
      "Area (sqm)",
      "Contact Number",
      "Platform",
      "Source URL",
      "Latitude",
      "Longitude",
      "Broker Name",
      "Broker Agency"
    ];
    const rows = filteredListings.map(l => [
      l.title || "",
      l.price_sar || 0,
      l.rent_period || "",
      l.location_detail || "",
      l.bedrooms || "",
      l.bathrooms || "",
      l.area_sqm || 0,
      l.contact_number || "",
      l.source_platform_name || "",
      l.source_url || "",
      l.lat || "",
      l.lng || "",
      l.broker_name || "",
      l.broker_agency || ""
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map(row =>
        row.map(val => {
          const strVal = String(val).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(",")
      )
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `makan_properties_${(filters.location || "export").replace(/[\s,]+/g, "_")}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredListings, filters.location]);

  const stopSearch = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setLoading(false);
    setScanStatus(null);
  }, []);

  const doSearch = useCallback((locOverride) => {
    const loc = locOverride || filters.location;
    if (!loc?.trim()) return;
    if (esRef.current) esRef.current.close();

    setListings([]);
    setMapFilter(null);
    setLoading(true);
    setHasSearched(true);
    setScanStatus({ platform:"Initialising", message:"Preparing engines…", counts:{} });

    const p = new URLSearchParams({
      location: loc, listing_type: filters.listing_type,
      property_type: (filters.property_types || ["apartment"]).join(","),
      platforms: platforms.join(","),
    });
    if (filters.min_price > 0) p.set("min_price", filters.min_price);
    if (filters.max_price > 0) p.set("max_price", filters.max_price);
    if (filters.rooms > 0)     p.set("rooms", filters.rooms);
    if (filters.min_area > 0)  p.set("min_area", filters.min_area);
    if (filters.max_area > 0)  p.set("max_area", filters.max_area);
    if (filters.area_slug)     p.set("area_slug", filters.area_slug);
    if (filters.district_slug) p.set("district_slug", filters.district_slug);

    const minArea = filters.min_area > 0 ? filters.min_area : 0;
    const maxArea = filters.max_area > 0 ? filters.max_area : 0;
    const hasAreaFilter = minArea > 0 || maxArea > 0;

    const es = new EventSource(`${API_BASE}/api/stream?${p}`);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if      (d.status === "scanning")       setScanStatus(s => ({...s, platform:d.platform, message:d.message}));
        else if (d.status === "result") {
          if (hasAreaFilter) {
            const area = getAreaSqm(d.listing);
            if (minArea > 0 && area < minArea) return;
            if (maxArea > 0 && area > maxArea) return;
          }
          setListings(ls => [...ls, d.listing]);
        }
        else if (d.status === "platform_done")  setScanStatus(s => ({...s, counts:{...s?.counts,[d.platform]:d.count}}));
        else if (d.status === "complete")       { setLoading(false); setScanStatus(null); es.close(); }
      } catch {}
    };
    es.onerror = () => { setLoading(false); setScanStatus(null); es.close(); };
  }, [filters, platforms]);

  const handleCitySelect = useCallback((city) => {
    setFilters(f => ({ ...f, location: city }));
  }, []);

  const handleAreaSearch = useCallback(({ bounds }) => {
    if (!bounds) return;
    setMapFilter({
      type: "bounds",
      value: {
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng }
      }
    });
  }, []);

  const isRtl = lang === "ar";

  return (
    <div className="min-h-screen font-body" dir={isRtl ? "rtl" : "ltr"}>

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 bg-emerald-500 rounded-lg opacity-20 blur-sm" />
              <div className="relative w-8 h-8 bg-emerald-500/10 border border-emerald-500/40 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L1 6v9h5v-5h4v5h5V6L8 1z" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <span className="font-display font-700 text-xl text-slate-100 tracking-tight">
              مكان <span className="text-emerald-500 text-sm font-mono font-400 mx-1">Makan</span>
            </span>
          </div>

          {/* View toggle + lang toggle */}
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <button
              onClick={() => setLang(l => l === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-600
                         bg-slate-800/60 border border-slate-700 text-slate-300
                         hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
              {lang === "en" ? "عربي" : "EN"}
            </button>

            {/* View mode */}
            <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700 rounded-xl p-1">
              {[
                { mode:"grid", key:"grid",
                  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
                { mode:"map", key:"map",
                  icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
              ].map(({mode,key,icon}) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all
                    ${viewMode===mode ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-slate-200"}`}>
                  {icon}{t(lang, key)}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-3">
            {listings.length > 0 && (
              <span className="text-xs font-mono text-slate-500">
                <span className="text-emerald-400 font-600">{listings.length}</span> {t(lang, "listings")}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-mono text-slate-500 border border-slate-700 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {t(lang, "liveTag")}
            </span>
          </div>
        </div>
      </header>

      {/* ── Layout ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row gap-5">

        {/* Sidebar */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0">
          <FilterPanel
            filters={filters}
            onChange={(k,v) => setFilters(f => ({...f,[k]:v}))}
            onSearch={doSearch}
            loading={loading}
            selectedPlatforms={platforms}
            onPlatformsChange={setPlatforms}
            lang={lang}
          />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">

          {/* Results bar */}
          {hasSearched && !loading && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display font-600 text-2xl text-slate-100">{listings.length}</span>
                <span className="text-slate-400 text-sm">
                  {listings.length !== 1 ? t(lang, "listings") : t(lang, "listing")} {t(lang, "inCity")}{" "}
                  <span className="text-slate-200 font-500">{filters.location}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                {listings.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-600
                               bg-emerald-500/10 border border-emerald-500/30 text-emerald-400
                               hover:bg-emerald-500 hover:text-slate-900 transition-all cursor-pointer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {t(lang, "exportExcel")}
                  </button>
                )}
                <span className="text-xs font-mono border border-slate-700 rounded px-2 py-0.5 text-slate-500">
                  {filters.listing_type === "sale" ? t(lang, "forSaleTag") : t(lang, "forRentTag")}
                </span>
              </div>
            </div>
          )}

          {/* Hero */}
          {!hasSearched && viewMode === "grid" && (
            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full scale-150" />
                <div className="relative w-24 h-24 border border-emerald-500/20 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-emerald-500/60">
                    <path d="M20 4L4 15v22h10V25h12v12h10V15L20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <circle cx="20" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              </div>
              <div className="max-w-sm">
                <h2 className="font-display font-700 text-2xl text-slate-200 mb-2">{t(lang, "heroTitle")}</h2>
                <p className="text-slate-500 text-sm leading-relaxed">{t(lang, "heroDesc")}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
                {["Bayut","Aqar","PropertyFinder","Wasalt","Sakani","Haraj","OpenSooq","Mourjan","Expatriates","Satel","Zaahib","Bezaat","SaudiDeal"].map(p=>(
                  <span key={p} className="text-xs font-mono px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-500">{p}</span>
                ))}
              </div>
            </div>
          )}

          {viewMode === "grid" && (hasSearched || filteredListings.length > 0) && (
            <PropertyGrid listings={filteredListings} loading={loading} hasSearched={hasSearched}
                          onCardClick={setSelectedListing} lang={lang} />
          )}

          {viewMode === "map" && (
            <div className="h-[calc(100vh-10rem)] min-h-[500px]">
              <MapView listings={filteredListings} selectedCity={filters.location}
                       mapFilter={mapFilter} setMapFilter={setMapFilter}
                       onCitySelect={handleCitySelect} onAreaSearch={handleAreaSearch}
                       onListingClick={setSelectedListing} lang={lang} />
            </div>
          )}
        </main>
      </div>

      {/* ── Overlays ── */}
      {loading && (
        <LoadingOverlay scanStatus={scanStatus} listingsFound={listings.length} lang={lang} onStop={stopSearch} />
      )}
      {selectedListing && (
        <PropertyDetail listing={selectedListing} onClose={() => setSelectedListing(null)} lang={lang} />
      )}
    </div>
  );
}
