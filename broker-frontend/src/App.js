import React, { useState, useRef, useCallback } from "react";
import BrokerFilterPanel from "./components/BrokerFilterPanel";
import BrokerGrid from "./components/BrokerGrid";
import { t } from "./i18n";
import * as XLSX from "xlsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ALL_PLATFORMS = ["bayut", "aqar", "propertyfinder", "wasalt", "sakani", "haraj", "opensooq", "expatriates", "mourjan", "satel", "zaahib", "bezaat", "saudideal"];

function _merge(phone, existing) {
  const map = new Map(existing.map(b => [b.phone, b]));
  if (!phone) return existing;
  return map.has(phone.phone)
    ? existing.map(b => b.phone === phone.phone
        ? { ...b, platforms: [...new Set([...b.platforms, ...(phone.platforms || [])])],
            listing_count: b.listing_count + (phone.listing_count || 0) }
        : b)
    : [...existing, phone];
}

export default function App() {
  const [lang,              setLang]              = useState("en");
  const [brokers,           setBrokers]           = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [hasSearched,       setHasSearched]       = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(ALL_PLATFORMS);
  const [searchQuery,       setSearchQuery]       = useState("");
  const esRef = useRef(null);

  const stopStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setLoading(false);
  }, []);

  const handleSearch = useCallback((location) => {
    stopStream();
    setBrokers([]);
    setHasSearched(true);
    setLoading(true);

    const params = new URLSearchParams({
      location: location || "Saudi Arabia",
      platforms: selectedPlatforms.join(","),
    });

    const es = new EventSource(`${API}/api/brokers?${params}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if      (d.status === "broker")   setBrokers(prev => _merge(d.broker, prev));
        else if (d.status === "complete") stopStream();
      } catch {}
    };

    es.onerror = () => stopStream();
  }, [selectedPlatforms, stopStream]);

  const handleExportExcel = () => {
    if (!brokers || brokers.length === 0) return;
    const dataToExport = brokers.map(b => ({
      "Name": b.name || "-",
      "Agency": b.agency || "-",
      "Phone": b.phone || "-",
      "Platforms": (b.platforms || []).join(", "),
      "Listings Count": b.listing_count || 0,
      "Areas": (b.areas || []).join(", "),
      "Profile URL": b.profile_url || "-",
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Brokers");
    XLSX.writeFile(workbook, "Brokers_Export.xlsx");
  };

  const isRtl = lang === "ar";

  return (
    <div className={`min-h-screen ${isRtl ? "rtl font-body" : "font-body"}`}
         dir={isRtl ? "rtl" : "ltr"}>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80
                         bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30
                            flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <circle cx="12" cy="8" r="4"/>
                <path d="M2 20c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-700 text-slate-100 text-sm tracking-tight">
                  {t(lang, "appTitle")}
                </span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded-md
                                 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {t(lang, "liveTag")}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono leading-none mt-0.5">
                {t(lang, "appSubtitle")}
              </p>
            </div>
          </div>

          {/* Lang toggle */}
          <button
            onClick={() => setLang(l => l === "en" ? "ar" : "en")}
            className="text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-700
                       bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600
                       transition-all">
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-6 items-start">

          {/* Sidebar filter */}
          <aside className="w-72 shrink-0 hidden lg:block">
            <BrokerFilterPanel
              loading={loading}
              onSearch={handleSearch}
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={setSelectedPlatforms}
              lang={lang}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Mobile filter */}
            <div className="lg:hidden mb-6">
              <BrokerFilterPanel
                loading={loading}
                onSearch={handleSearch}
                selectedPlatforms={selectedPlatforms}
                onPlatformsChange={setSelectedPlatforms}
                lang={lang}
              />
            </div>

            {/* Search bar — shown once results start arriving */}
            {(hasSearched || brokers.length > 0) && (
              <div className="mb-5 relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن وسيط أو شركة…" : "Search broker or company…"}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl
                             ps-9 pe-4 py-2.5 text-sm text-slate-200 placeholder-slate-500
                             outline-none focus:border-emerald-500/60 transition-all font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Export Button */}
            {(hasSearched || brokers.length > 0) && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 
                             hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-sm font-mono transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {lang === "ar" ? "تصدير إلى إكسل" : "Export to Excel"}
                </button>
              </div>
            )}

            <BrokerGrid
              brokers={searchQuery
                ? brokers.filter(b => {
                    const q = searchQuery.toLowerCase();
                    return (b.name  || "").toLowerCase().includes(q) ||
                           (b.agency|| "").toLowerCase().includes(q) ||
                           (b.phone || "").includes(q) ||
                           (b.areas || []).some(a => a.toLowerCase().includes(q));
                  })
                : brokers}
              loading={loading}
              hasSearched={hasSearched}
              lang={lang}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
