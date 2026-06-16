import React, { useState, useRef, useEffect } from "react";
import { t } from "../i18n";

const CITIES = [
  "Riyadh","Jeddah","Mecca","Medina","Dammam","Al Khobar","Dhahran",
  "Abha","Tabuk","Buraidah","Khamis Mushait","Al Jubail","Hail","Al Taif",
  "Yanbu","Al Ahsa","Al Qatif","Najran","Jazan","Al Ula",
];

const CITY_DISTRICTS = {
  Riyadh: [
    "Al Malaz","Al Olaya","Al Nakheel","Al Wurud","Al Rawdah","Al Sulaimaniyah",
    "Al Qirawan","Al Yarmouk","Al Shifa","Al Aqiq","Al Hamra","Al Murabba",
    "Al Izdihar","Al Naseem","Al Aziziyah","Al Malqa","Al Rabwah","Hittin",
    "Al Yasmeen","Al Sahafah","Al Qadisiyah","Al Zahra","Al Muruj","Al Waha",
    "Al Salam","Ishbiliyah","Al Rimal","Al Nasr","Badr","Al Raid",
    "Al Uraija","Al Masif","Al Nuzha","Al Rawabi","Al Tawun","Al Yasmin",
    "Dhahrat Laban","Al Dar Al Baida","Al Suwaidi","Al Haeer",
  ],
  Jeddah: [
    "Al Rawdah","Al Hamra","Al Andalus","Al Nuzha","Al Zahra","Al Salamah",
    "Al Khalidiyah","Al Rehab","Al Marwah","Al Naeem","Al Shati","Al Corniche",
    "Al Balad","Al Faisaliyah","Al Rowais","Al Aziziyah","Al Sharafiyah",
    "Al Bawadi","Al Worood","Al Zuhur","Al Jamiah","Al Samer","Al Safa",
    "Al Murjan","Obhur Al Shamaliyah","Obhur Al Jnoubiyah",
    "Al Basateen","Al Muhammadiyah","Al Waha","Al Kawthar",
    "Al Misriyah","Al Rigah","Al Shifa","Al Thaghr","Al Nahdha",
  ],
  Dammam: [
    "Al Faisaliyah","Al Shula","Al Noor","Al Badiyah","Al Hamra","Al Anoud",
    "Al Mazruiyah","Al Muhammadiyah","Al Ahrar","Al Muntazah","Uhud","Al Nakheel",
  ],
  "Al Khobar": [
    "Al Corniche","Al Thuqbah","Al Aqrabiyah","Al Khobar Al Shamaliyah",
    "Al Bandariyah","Al Ulaya","Al Yarmouk","Al Murjan",
  ],
  Mecca: [
    "Al Aziziyah","Al Rusaifah","Ajyad","Al Massa","Al Zaher","Al Adl",
    "Al Haram","Al Shoubra","Al Nahda","Al Taneem",
  ],
  Medina: [
    "Al Aziziyah","Al Ranuna","Quba","Sakan","Al Haram","Al Aqoul",
    "Al Manakhah","Bani Haritha","Al Difa","Al Iskan",
  ],
  Abha: ["Al Manhal","Al Mahalah","Al Sad","Al Wusta","Al Aziziyah","Al Marooj"],
  Tabuk: ["Al Rawdah","Al Nuzha","Al Safa","Al Aziziyah","Al Wahah"],
  Buraidah: ["Al Rawdah","Al Nahdha","Al Aziziyah","Al Falah","Al Hamra"],
  Hail: ["Al Aziziyah","Al Rawdah","Al Muruj","Al Hamra"],
};

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

function SearchableDropdown({ items, value, onChange, placeholder, icon, allLabel }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

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
      {open && (
        <div className="absolute z-50 start-0 end-0 top-full mt-1 bg-slate-800 border border-slate-700
                        rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input autoFocus type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-slate-900/60 border border-slate-700 text-slate-200 text-xs
                         rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 font-mono
                         placeholder-slate-600" />
          </div>
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

export default function BrokerFilterPanel({
  loading, onSearch, selectedPlatforms, onPlatformsChange, lang,
}) {
  const [selectedCity,     setSelectedCity]     = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [showPlatforms,    setShowPlatforms]    = useState(false);

  const districts = CITY_DISTRICTS[selectedCity] || [];

  const handleCityChange = (city) => {
    setSelectedCity(city);
    setSelectedDistrict("");
  };

  const handleDistrictChange = (district) => {
    setSelectedDistrict(district);
  };

  const allSelected = PLATFORMS.every(p => selectedPlatforms.includes(p.key));
  const toggleAll   = () => onPlatformsChange(allSelected ? [] : PLATFORMS.map(p => p.key));

  const currentLocation = selectedDistrict
    ? `${selectedDistrict}, ${selectedCity}`
    : selectedCity;

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(currentLocation);
  };

  const handleAllCities = () => {
    setSelectedCity("");
    setSelectedDistrict("");
    onSearch("Saudi Arabia");
  };

  return (
    <form onSubmit={handleSearch}
      className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-5 sticky top-24">

      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-700/60">
        <div className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <circle cx="12" cy="8" r="4"/>
            <path d="M2 20c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
          </svg>
        </div>
        <span className="text-xs font-mono font-600 text-slate-400 uppercase tracking-widest">
          {t(lang, "tabBrokers")}
        </span>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
          {t(lang, "location")}
        </label>
        <SearchableDropdown
          items={CITIES}
          value={selectedCity}
          onChange={handleCityChange}
          placeholder={t(lang, "locationPlaceholder")}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          allLabel={null}
        />
        {selectedCity && districts.length > 0 && (
          <SearchableDropdown
            items={districts}
            value={selectedDistrict}
            onChange={handleDistrictChange}
            placeholder={`All ${selectedCity} districts`}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>}
            allLabel={`All ${selectedCity} districts`}
          />
        )}
        {selectedCity && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs text-slate-400 font-mono">
              {selectedDistrict ? `${selectedDistrict}, ${selectedCity}` : selectedCity}
            </span>
          </div>
        )}
      </div>

      {/* Platforms */}
      <div className="space-y-2.5">
        <button type="button" onClick={() => setShowPlatforms(s => !s)}
          className="w-full flex items-center justify-between text-xs font-mono text-slate-500
                     uppercase tracking-wider hover:text-slate-300 transition-colors">
          <span>
            {t(lang, "platforms")}{" "}
            <span className="text-emerald-400 font-600">
              ({selectedPlatforms.length}/{PLATFORMS.length})
            </span>
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform ${showPlatforms ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showPlatforms && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={toggleAll}
                className="flex-1 text-xs font-mono py-1.5 rounded-lg border border-slate-700
                           bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors">
                {allSelected ? t(lang,"deselectAll") : t(lang,"selectAll")}
              </button>
            </div>
            {TIERS.map(tier => {
              const group = PLATFORMS.filter(p => p.tier === tier);
              return (
                <div key={tier}>
                  <p className="text-xs font-mono text-slate-600 mb-1.5 uppercase tracking-wider">
                    {t(lang, TIER_KEYS[tier])}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.map(({ key, label, color }) => {
                      const on = selectedPlatforms.includes(key);
                      return (
                        <button key={key} type="button"
                          onClick={() => onPlatformsChange(
                            on ? selectedPlatforms.filter(p => p !== key)
                               : [...selectedPlatforms, key]
                          )}
                          className="text-xs font-mono px-2.5 py-1 rounded-lg border transition-all"
                          style={on
                            ? { background: color+"22", color, borderColor: color+"55" }
                            : { background: "transparent", color: "#64748b", borderColor: "#334155" }}>
                          {label}
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

      {/* Scan buttons */}
      <div className="space-y-2">
        <button type="submit" disabled={loading || !selectedCity}
          className="w-full py-3 rounded-xl font-600 text-sm transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
          style={{ background: loading ? "#064e3b" : "#10b981", color: "#0f172a" }}>
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-slate-900/40 border-t-slate-900
                               rounded-full animate-spin inline-block" />
              {t(lang, "scanning")}…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M2 20c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
              </svg>
              {t(lang, "findBrokers")}
            </>
          )}
        </button>
        {/* <button type="button" disabled={loading} onClick={handleAllCities}
          className="w-full py-2.5 rounded-xl font-600 text-xs transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2
                     bg-slate-700/40 border border-slate-600 text-slate-300
                     hover:bg-slate-700/70 hover:text-slate-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {t(lang, "allCitiesBrokers")}
        </button> */}
      </div>
    </form>
  );
}
