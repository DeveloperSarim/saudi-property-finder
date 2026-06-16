import React, { useState, useRef, useEffect } from "react";
import { t } from "../i18n";

const CITIES = [
  "Riyadh","Jeddah","Mecca","Medina","Dammam","Al Khobar","Dhahran",
  "Abha","Tabuk","Buraidah","Khamis Mushait","Al Jubail","Hail","Al Taif",
  "Yanbu","Al Ahsa","Al Qatif","Najran","Jazan","Al Ula",
];


const PROPERTY_TYPES = [
  { value:"apartment", labelKey:"apartment", icon:"🏢" },
  { value:"villa",     labelKey:"villa",     icon:"🏡" },
  { value:"house",     labelKey:"house",     icon:"🏠" },
  { value:"residential",labelKey:"residential", icon:"🏘️" },
  { value:"building",   labelKey:"building",    icon:"🏢" },
  { value:"office",    labelKey:"office",    icon:"🏬" },
  { value:"shop",      labelKey:"shop",      icon:"🏪" },
  { value:"land",      labelKey:"land",      icon:"🗺️" },
  { value:"commercial",labelKey:"commercial",icon:"🏪" },
];

const PLATFORMS = [
  { key:"bayut",          label:"Bayut",         tier:"premium",     color:"#10b981" },
  { key:"aqar",           label:"Aqar",           tier:"premium",     color:"#38bdf8" },
  { key:"propertyfinder", label:"PropertyFinder", tier:"premium",     color:"#f59e0b" },
  { key:"wasalt",         label:"Wasalt",         tier:"premium",     color:"#a78bfa" },
  { key:"sakani",         label:"Sakani",         tier:"government",  color:"#34d399" },
  { key:"haraj",          label:"Haraj",          tier:"classifieds", color:"#fb923c" },
  { key:"opensooq",       label:"OpenSooq",       tier:"classifieds", color:"#e879f9" },
  { key:"expatriates",    label:"Expatriates",    tier:"classifieds", color:"#60a5fa" },
  { key:"mourjan",        label:"Mourjan",        tier:"classifieds", color:"#f472b6" },
  { key:"satel",          label:"Satel",          tier:"niche",       color:"#fbbf24" },
  { key:"zaahib",         label:"Zaahib",         tier:"niche",       color:"#4ade80" },
  { key:"bezaat",         label:"Bezaat",         tier:"niche",       color:"#c084fc" },
  { key:"saudideal",      label:"SaudiDeal",      tier:"niche",       color:"#f87171" },
];

const TIER_KEYS = {
  premium:"tierPremium", government:"tierGovernment",
  classifieds:"tierClassifieds", niche:"tierNiche",
};
const TIERS = ["premium","government","classifieds","niche"];

function fmt(v) {
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v/1_000).toFixed(0)}K`;
  return v.toString();
}

// ── Searchable dropdown component ──────────────────────────────────────────
function SearchableDropdown({ items, value, onChange, placeholder, icon, allLabel }) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const ref                 = useRef(null);

  const filtered = query
    ? items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (item) => { onChange(item); setQuery(""); setOpen(false); };
  const clear  = () => { onChange(""); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-slate-900/60 border border-slate-700 text-sm
                   rounded-xl px-3 py-2.5 outline-none text-start
                   hover:border-slate-600 focus:border-emerald-500/60 transition-all">
        <span className="text-slate-500 shrink-0">{icon}</span>
        <span className={`flex-1 truncate ${value ? "text-slate-100" : "text-slate-500"}`}>
          {value || placeholder}
        </span>
        {value && (
          <span onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-slate-500 hover:text-slate-300 px-0.5 shrink-0 text-xs">✕</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" className={`text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 start-0 end-0 top-full mt-1 bg-slate-800 border border-slate-700
                        rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-900/60 border border-slate-700 text-slate-200 text-xs
                         rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 font-mono
                         placeholder-slate-600"
            />
          </div>
          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {allLabel && (
              <button type="button" onMouseDown={() => { clear(); setOpen(false); }}
                className="w-full text-start px-4 py-2 text-xs font-mono text-emerald-400
                           hover:bg-slate-700/80 transition-colors">
                {allLabel}
              </button>
            )}
            {filtered.length > 0 ? filtered.map(item => (
              <button key={item} type="button" onMouseDown={() => select(item)}
                className={`w-full text-start px-4 py-2 text-sm transition-colors
                  ${value === item
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-slate-300 hover:bg-slate-700/80 hover:text-slate-100"}`}>
                {item}
              </button>
            )) : (
              <p className="text-center text-xs text-slate-600 font-mono py-3">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSearchableDropdown({ items, values, onChange, placeholder, icon }) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const ref                 = useRef(null);

  const filtered = query
    ? items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (item) => {
    if (values.includes(item)) onChange(values.filter(v => v !== item));
    else onChange([...values, item]);
  };
  const clear = () => onChange([]);

  const displayValue = values.length > 0 
    ? (values.length === 1 ? values[0] : `${values.length} selected`)
    : "";

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-slate-900/60 border border-slate-700 text-sm
                   rounded-xl px-3 py-2.5 outline-none text-start
                   hover:border-slate-600 focus:border-emerald-500/60 transition-all">
        <span className="text-slate-500 shrink-0">{icon}</span>
        <span className={`flex-1 truncate ${displayValue ? "text-slate-100" : "text-slate-500"}`}>
          {displayValue || placeholder}
        </span>
        {values.length > 0 && (
          <span onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-slate-500 hover:text-slate-300 px-0.5 shrink-0 text-xs">✕</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" className={`text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 start-0 end-0 top-full mt-1 bg-slate-800 border border-slate-700
                        rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              autoFocus
              type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-900/60 border border-slate-700 text-slate-200 text-xs
                         rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 font-mono
                         placeholder-slate-600"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length > 0 ? filtered.map(item => {
              const isSelected = values.includes(item);
              return (
                <button key={item} type="button" onMouseDown={(e) => { e.preventDefault(); toggle(item); }}
                  className={`w-full flex items-center gap-2 text-start px-3 py-2 rounded text-sm transition-colors mb-0.5
                    ${isSelected ? "bg-emerald-500/20 text-emerald-400" : "text-slate-300 hover:bg-slate-700/80 hover:text-slate-100"}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                                  ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-500 bg-slate-800"}`}>
                    {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className="truncate">{item}</span>
                </button>
              );
            }) : (
              <p className="text-center text-xs text-slate-600 font-mono py-3">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function FilterPanel({ filters, onChange, onSearch, loading, selectedPlatforms, onPlatformsChange, lang }) {
  const [selectedCity,      setSelectedCity]      = useState("");
  const [selectedArea,      setSelectedArea]      = useState(null);  // { slug, name } | null
  const [selectedDistricts, setSelectedDistricts] = useState([]);    // Array of { slug, name }

  // Live data from backend
  const [cities,           setCities]           = useState([]);
  const [areas,            setAreas]            = useState([]);
  const [districts,        setDistricts]        = useState([]);
  const [areasLoading,     setAreasLoading]     = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  const [showPlatforms,    setShowPlatforms]    = useState(false);
  const [priceMode,        setPriceMode]        = useState("any");
  const [sizeMode,         setSizeMode]         = useState("any");

  // ── Fetch cities on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/locations`)
      .then(r => r.json())
      .then(d => setCities(d.cities || []))
      .catch(() => {});
  }, []);

  // ── Fetch areas when city changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedCity) { setAreas([]); setDistricts([]); return; }
    setAreasLoading(true);
    setAreas([]); setDistricts([]);
    setSelectedArea(null); setSelectedDistricts([]);
    fetch(`${API_BASE}/api/locations?city=${encodeURIComponent(selectedCity.toLowerCase())}`)
      .then(r => r.json())
      .then(d => { setAreas(d.areas || []); })
      .catch(() => setAreas([]))
      .finally(() => setAreasLoading(false));
  }, [selectedCity]);

  // ── Fetch districts when area changes ────────────────────────────────
  useEffect(() => {
    if (!selectedArea) { setDistricts([]); return; }
    setDistrictsLoading(true);
    setDistricts([]); setSelectedDistricts([]);
    fetch(`${API_BASE}/api/locations?area_slug=${encodeURIComponent(selectedArea.slug)}`)
      .then(r => r.json())
      .then(d => setDistricts(d.districts || []))
      .catch(() => setDistricts([]))
      .finally(() => setDistrictsLoading(false));
  }, [selectedArea]);

  // ── Location change handlers ───────────────────────────────────────────
  const handleCityChange = (city) => {
    setSelectedCity(city);
    setSelectedArea(null);
    setSelectedDistricts([]);
    onChange("location",      city);
    onChange("area_slug",     "");
    onChange("district_slug", "");
  };

  const handleAreaChange = (area) => {
    setSelectedArea(area);
    setSelectedDistricts([]);
    onChange("location",      area ? `${area.name}, ${selectedCity}` : selectedCity);
    onChange("area_slug",     area ? area.slug : "");
    onChange("district_slug", "");
  };

  const handleDistrictChange = (distNames) => {
    // distNames is an array of strings
    const newSelection = distNames.map(name => districts.find(d => d.name === name)).filter(Boolean);
    setSelectedDistricts(newSelection);
    
    const loc = newSelection.length > 0
      ? `${newSelection.map(d=>d.name).join(" - ")}, ${selectedArea?.name || ""}, ${selectedCity}`
      : selectedArea
        ? `${selectedArea.name}, ${selectedCity}`
        : selectedCity;
    
    onChange("location", loc);
    onChange("district_slug", newSelection.map(d => d.slug).join(","));
  };

  const togglePlatform = (key) => {
    if (selectedPlatforms.includes(key)) {
      if (selectedPlatforms.length === 1) return;
      onPlatformsChange(selectedPlatforms.filter(k => k !== key));
    } else {
      onPlatformsChange([...selectedPlatforms, key]);
    }
  };

  const toggleTier = (tier) => {
    const tierKeys = PLATFORMS.filter(p => p.tier===tier).map(p => p.key);
    const allOn = tierKeys.every(k => selectedPlatforms.includes(k));
    if (allOn) {
      const next = selectedPlatforms.filter(k => !tierKeys.includes(k));
      if (next.length > 0) onPlatformsChange(next);
    } else {
      onPlatformsChange([...new Set([...selectedPlatforms, ...tierKeys])]);
    }
  };

  const allSelected = selectedPlatforms.length === PLATFORMS.length;

  const handlePriceMode = (mode) => {
    setPriceMode(mode);
    if (mode === "any") {
      onChange("min_price", 0);
      onChange("max_price", 0);
    } else {
      // Custom range defaults: 0 to 20M
      onChange("min_price", 0);
      onChange("max_price", 20_000_000);
    }
  };

  const priceLabel = priceMode === "any"
    ? t(lang,"anyPrice")
    : `${filters.min_price > 0 ? fmt(filters.min_price) + " – " : "0 – "}${fmt(filters.max_price)} SAR`;

  const handleSizeMode = (mode) => {
    setSizeMode(mode);
    if (mode === "any") {
      onChange("min_area", 0);
      onChange("max_area", 0);
    } else {
      onChange("min_area", filters.min_area > 0 ? filters.min_area : 0);
      onChange("max_area", filters.max_area > 0 ? filters.max_area : 5000);
    }
  };

  const sizeLabel = sizeMode === "any"
    ? t(lang,"anySize")
    : `${filters.min_area > 0 ? filters.min_area : 0} – ${filters.max_area > 0 ? filters.max_area : 5000} m²`;

  const cityIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
  const districtIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 sticky top-24 space-y-5
                    max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 bg-emerald-500 rounded-full" />
        <h2 className="font-display font-600 text-slate-200 text-sm tracking-wide uppercase">
          {t(lang,"filters")}
        </h2>
      </div>

      <form onSubmit={e => { e.preventDefault(); onSearch(); }} className="space-y-4">

        {/* ── Location ── */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            {t(lang,"location")}
          </label>

          {/* ── Level 1: City ── */}
          <SearchableDropdown
            items={cities.length ? cities : ["Riyadh","Jeddah","Mecca","Medina","Dammam","Al Khobar","Abha","Tabuk"]}
            value={selectedCity}
            onChange={handleCityChange}
            placeholder={lang === "ar" ? "اختر مدينة…" : "Select city…"}
            icon={cityIcon}
          />

          {/* ── Level 2: Area (appears after city) ── */}
          {selectedCity && (
            <div className="relative">
              {areasLoading ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/60 border border-slate-700
                                rounded-xl text-xs text-slate-500 font-mono">
                  <span className="w-3 h-3 border-2 border-emerald-500/40 border-t-emerald-500
                                  rounded-full animate-spin inline-block shrink-0" />
                  {lang === "ar" ? "جارٍ تحميل المناطق…" : "Loading areas…"}
                </div>
              ) : areas.length > 0 ? (
                <SearchableDropdown
                  items={areas.map(a => a.name)}
                  value={selectedArea?.name || ""}
                  onChange={(name) => {
                    if (!name) { handleAreaChange(null); return; }
                    const found = areas.find(a => a.name === name);
                    if (found) handleAreaChange(found);
                  }}
                  placeholder={lang === "ar" ? `كل مناطق ${selectedCity}` : `All ${selectedCity} areas`}
                  icon={districtIcon}
                  allLabel={lang === "ar" ? `✓ كل المناطق` : `✓ All areas`}
                />
              ) : (
                <div className="px-3 py-2 text-xs text-slate-600 font-mono italic">
                  {lang === "ar" ? "لا توجد مناطق متاحة" : "No sub-areas available"}
                </div>
              )}
            </div>
          )}

          {/* ── Level 3: District (appears after area) ── */}
          {selectedArea && (
            <div className="relative">
              {districtsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-900/60 border border-slate-700
                                rounded-xl text-xs text-slate-500 font-mono">
                  <span className="w-3 h-3 border-2 border-emerald-500/40 border-t-emerald-500
                                  rounded-full animate-spin inline-block shrink-0" />
                  {lang === "ar" ? "جارٍ تحميل الأحياء…" : "Loading districts…"}
                </div>
              ) : districts.length > 0 ? (
                <MultiSearchableDropdown
                  items={districts.map(d => d.name)}
                  values={selectedDistricts.map(d => d.name)}
                  onChange={handleDistrictChange}
                  placeholder={lang === "ar" ? `اختر أحياء ${selectedArea.name}` : `Select ${selectedArea.name} districts`}
                  icon={(
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83
                      M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                    </svg>
                  )}
                />
              ) : (
                <div className="px-3 py-2 text-xs text-slate-600 font-mono italic">
                  {lang === "ar" ? "لا توجد أحياء متاحة" : "No districts available"}
                </div>
              )}
            </div>
          )}

          {/* ── Breadcrumb pill ── */}
          {selectedCity && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-emerald-400">{selectedCity}</span>
              {selectedArea && (
                <>
                  <span className="text-slate-600">›</span>
                  <span className="text-emerald-300">{selectedArea.name}</span>
                </>
              )}
              {selectedDistricts.length > 0 && (
                <>
                  <span className="text-slate-600">›</span>
                  <span className="text-emerald-200">{selectedDistricts.map(d=>d.name).join(", ")}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Listing type ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            {t(lang,"listingType")}
          </label>
          <div className="flex rounded-xl overflow-hidden border border-slate-700 p-0.5 bg-slate-900/40">
            {["sale","rent"].map(tp => (
              <button key={tp} type="button" onClick={() => onChange("listing_type",tp)}
                className={`flex-1 py-2 text-sm font-500 rounded-lg transition-all
                  ${filters.listing_type===tp ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-slate-200"}`}>
                {tp==="sale" ? t(lang,"forSale") : t(lang,"forRent")}
              </button>
            ))}
          </div>
        </div>

        {/* ── Property type (multi-select) ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {t(lang,"propertyType")}
            </label>
            {(filters.property_types || []).length > 0 && (
              <span className="text-xs font-mono text-emerald-400">
                {(filters.property_types || []).length} {lang === "ar" ? "محدد" : "selected"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {PROPERTY_TYPES.map(pt => {
              const selected = (filters.property_types || []).includes(pt.value);
              return (
                <button key={pt.value} type="button"
                  onClick={() => {
                    const cur = filters.property_types || [];
                    const next = selected
                      ? cur.filter(v => v !== pt.value)
                      : [...cur, pt.value];
                    onChange("property_types", next.length ? next : [pt.value]);
                  }}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs transition-all
                    ${selected
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:text-slate-300"}`}>
                  <span className="text-base leading-none">{pt.icon}</span>
                  <span className="font-mono">{t(lang, pt.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Price ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {t(lang,"price")}
            </label>
            <span className="text-xs font-mono text-emerald-400">{priceLabel}</span>
          </div>

          {/* Any / Custom toggle */}
          <div className="flex rounded-xl overflow-hidden border border-slate-700 p-0.5 bg-slate-900/40">
            <button type="button" onClick={() => handlePriceMode("any")}
              className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all
                ${priceMode==="any" ? "bg-emerald-500 text-slate-900 font-600" : "text-slate-400 hover:text-slate-200"}`}>
              {t(lang,"anyPrice")}
            </button>
            <button type="button" onClick={() => handlePriceMode("custom")}
              className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all
                ${priceMode==="custom" ? "bg-slate-600 text-slate-100 font-600" : "text-slate-400 hover:text-slate-200"}`}>
              {lang === "ar" ? "نطاق مخصص" : "Custom Range"}
            </button>
          </div>

          {/* Custom sliders */}
          {priceMode === "custom" && (
            <div className="space-y-2 pt-1">
              {[["Min","min_price",0],["Max","max_price",20_000_000]].map(([lbl,key]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-mono w-6">{lbl}</span>
                  <input type="range" min="0" max="20000000" step="100000"
                    value={filters[key] ?? (key==="max_price" ? 20_000_000 : 0)}
                    onChange={e => onChange(key, parseInt(e.target.value))}
                    className="flex-1" />
                  <span className="text-xs font-mono text-slate-400 w-12 text-end">
                    {fmt(filters[key] || 0)}
                  </span>
                </div>
              ))}
              <div className="flex gap-2">
                {[["min_price","minPrice"],["max_price","maxPrice"]].map(([key,ph]) => (
                  <input key={key} type="number" min="0" placeholder={t(lang,ph)}
                    value={filters[key] || ""}
                    onChange={e => onChange(key, parseInt(e.target.value)||0)}
                    className="w-full bg-slate-900/60 border border-slate-700 text-slate-300 text-xs
                               rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 font-mono
                               placeholder-slate-700" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bedrooms ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {t(lang,"size")}
            </label>
            <span className="text-xs font-mono text-emerald-400">{sizeLabel}</span>
          </div>

          <div className="flex rounded-xl overflow-hidden border border-slate-700 p-0.5 bg-slate-900/40">
            <button type="button" onClick={() => handleSizeMode("any")}
              className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all
                ${sizeMode==="any" ? "bg-emerald-500 text-slate-900 font-600" : "text-slate-400 hover:text-slate-200"}`}>
              {t(lang,"anySize")}
            </button>
            <button type="button" onClick={() => handleSizeMode("custom")}
              className={`flex-1 py-1.5 text-xs font-mono rounded-lg transition-all
                ${sizeMode==="custom" ? "bg-slate-600 text-slate-100 font-600" : "text-slate-400 hover:text-slate-200"}`}>
              {t(lang,"customRange")}
            </button>
          </div>

          {sizeMode === "custom" && (
            <div className="space-y-2 pt-1">
              {[
                ["Min","min_area",0],
                ["Max","max_area",5000],
              ].map(([lbl,key,def]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-mono w-6">{lbl}</span>
                  <input type="range" min="0" max="5000" step="10"
                    value={filters[key] ?? def}
                    onChange={e => onChange(key, parseInt(e.target.value))}
                    className="flex-1" />
                  <span className="text-xs font-mono text-slate-400 w-16 text-end">
                    {(filters[key] || 0).toLocaleString()} m²
                  </span>
                </div>
              ))}
              <div className="flex gap-2">
                {[["min_area","minSize"],["max_area","maxSize"]].map(([key,ph]) => (
                  <div key={key} className="relative flex-1">
                    <input type="number" min="0" max="5000" step="10"
                      placeholder={t(lang,ph)}
                      value={filters[key] || ""}
                      onChange={e => onChange(key, parseInt(e.target.value,10)||0)}
                      className="w-full bg-slate-900/60 border border-slate-700 text-slate-300 text-xs
                                 rounded-lg pl-3 pr-8 py-2 outline-none focus:border-emerald-500/50 font-mono
                                 placeholder-slate-700" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600
                                     font-mono pointer-events-none">m²</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bedrooms ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            {t(lang,"bedrooms")}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {[0,1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => onChange("rooms",n)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all
                  ${filters.rooms===n
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-slate-700 bg-slate-900/30 text-slate-500 hover:text-slate-300"}`}>
                {n===0 ? t(lang,"any") : n===5 ? "5+" : n}
              </button>
            ))}
          </div>
        </div>

        {/* ── Platforms (collapsed by default) ── */}
        <div className="space-y-2">
          <button type="button" onClick={() => setShowPlatforms(v => !v)}
            className="w-full flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider cursor-pointer">
              {t(lang,"platforms")} ({selectedPlatforms.length}/{PLATFORMS.length})
            </label>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`text-slate-500 transition-transform ${showPlatforms ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showPlatforms && (
            <div className="space-y-2">
              <button type="button"
                onClick={() => onPlatformsChange(allSelected ? [PLATFORMS[0].key] : PLATFORMS.map(p=>p.key))}
                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors">
                {allSelected ? t(lang,"deselectAll") : t(lang,"selectAll")}
              </button>

              {TIERS.map(tier => {
                const tierPlatforms = PLATFORMS.filter(p => p.tier===tier);
                const tierKeys = tierPlatforms.map(p => p.key);
                const allTierOn = tierKeys.every(k => selectedPlatforms.includes(k));
                return (
                  <div key={tier} className="space-y-1">
                    <button type="button" onClick={() => toggleTier(tier)}
                      className={`text-xs font-mono uppercase tracking-wider transition-colors
                        ${allTierOn ? "text-slate-400" : "text-slate-600"} hover:text-slate-300`}>
                      {t(lang, TIER_KEYS[tier])}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {tierPlatforms.map(p => {
                        const on = selectedPlatforms.includes(p.key);
                        return (
                          <button key={p.key} type="button" onClick={() => togglePlatform(p.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono
                                        border transition-all
                              ${on ? "text-white border-transparent"
                                   : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400"}`}
                            style={on ? { background:p.color+"22", borderColor:p.color+"55", color:p.color } : {}}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                  style={{ background: on ? p.color : "#475569" }} />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Search button ── */}
        <button type="submit" disabled={loading || !selectedCity}
          className={`w-full py-3 rounded-xl font-display font-600 text-sm tracking-wide transition-all
            ${loading || !selectedCity
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"}`}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              {t(lang,"scanning")} {selectedPlatforms.length} {t(lang,"platformsLabel")}…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {t(lang,"scan")} {selectedPlatforms.length} {selectedPlatforms.length!==1 ? t(lang,"platformsLabel") : t(lang,"platformLabel")}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
