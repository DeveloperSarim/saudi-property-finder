import React, { useState, useMemo, useEffect } from "react";
import PropertyCard from "./PropertyCard";
import { t } from "../i18n";

function getSortOptions(lang) {
  return [
    { value:"default",    labelKey:"sortDefault" },
    { value:"price_asc",  labelKey:"sortPriceAsc" },
    { value:"price_desc", labelKey:"sortPriceDesc" },
    { value:"beds_asc",   labelKey:"sortBedsAsc" },
    { value:"beds_desc",  labelKey:"sortBedsDesc" },
    { value:"area_asc",   labelKey:"sortAreaAsc" },
    { value:"area_desc",  labelKey:"sortAreaDesc" },
  ];
}

function Skeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl overflow-hidden">
      <div className="h-44 shimmer-bg" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 shimmer-bg rounded" />
        <div className="h-4 w-1/2 shimmer-bg rounded" />
        <div className="h-6 w-28 shimmer-bg rounded" />
        <div className="h-3.5 w-2/3 shimmer-bg rounded" />
        <div className="flex gap-3">
          <div className="h-3 w-12 shimmer-bg rounded" />
          <div className="h-3 w-12 shimmer-bg rounded" />
        </div>
        <div className="h-px w-full bg-slate-700/40" />
        <div className="flex gap-2">
          <div className="flex-1 h-8 shimmer-bg rounded-xl" />
          <div className="flex-1 h-8 shimmer-bg rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function PropertyGrid({ listings, loading, hasSearched, onCardClick, lang = "en" }) {
  const [sort, setSort] = useState("default");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // Reset to first page when data or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [listings, sort, platformFilter]);

  const SORT_OPTIONS = getSortOptions(lang);

  const platforms = useMemo(
    () => ["all", ...new Set(listings.map(l => l.source_platform_name))],
    [listings]
  );

  const sorted = useMemo(() => {
    let list = platformFilter === "all"
      ? [...listings]
      : listings.filter(l => l.source_platform_name === platformFilter);

    switch (sort) {
      case "price_asc":  list.sort((a,b) => (a.price_sar||0)-(b.price_sar||0)); break;
      case "price_desc": list.sort((a,b) => (b.price_sar||0)-(a.price_sar||0)); break;
      case "beds_asc":   list.sort((a,b) => (parseInt(a.bedrooms)||0)-(parseInt(b.bedrooms)||0)); break;
      case "beds_desc":  list.sort((a,b) => (parseInt(b.bedrooms)||0)-(parseInt(a.bedrooms)||0)); break;
      case "area_asc":   list.sort((a,b) => (a.area_sqm||0)-(b.area_sqm||0)); break;
      case "area_desc":  list.sort((a,b) => (b.area_sqm||0)-(a.area_sqm||0)); break;
      default: break;
    }
    return list;
  }, [listings, sort, platformFilter]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  if (hasSearched && !loading && listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4
                      border border-dashed border-slate-700 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="font-display font-600 text-slate-300 mb-1">{t(lang,"noListings")}</p>
          <p className="text-slate-500 text-sm max-w-xs">{t(lang,"noListingsHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Controls bar ── */}
      {(listings.length > 0 || loading) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              {t(lang,"sortLabel")}
            </span>
            <div className="flex gap-1 flex-wrap">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSort(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all
                    ${sort===opt.value
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600"}`}>
                  {t(lang, opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {platforms.length > 2 && (
            <div className="flex gap-1 flex-wrap ms-auto">
              {platforms.map(p => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all capitalize
                    ${platformFilter===p
                      ? "bg-slate-600 border-slate-500 text-slate-200"
                      : "border-slate-700 text-slate-600 hover:text-slate-400"}`}>
                  {p === "all" ? `${t(lang,"allLabel")} (${listings.length})` : p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && listings.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          {t(lang,"resultsSoFar",listings.length)}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {paginatedListings.map((listing, i) => (
          <PropertyCard
            key={`${listing.source_url}-${i}`}
            listing={listing}
            index={i}
            onClick={onCardClick}
            lang={lang}
          />
        ))}
        {loading && Array.from({ length: listings.length === 0 ? 6 : 3 }).map((_,i) => (
          <Skeleton key={`sk-${i}`} />
        ))}
      </div>

      {!loading && sorted.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-center text-xs font-mono text-slate-600">
            {t(lang,"showingOf",sorted.length,listings.length)}
          </p>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-4">
              <button 
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage(p => p - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-4 py-2 rounded-xl text-sm font-mono font-500 bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-all"
              >
                {t(lang, "prevPage")}
              </button>
              
              <span className="text-sm font-mono text-slate-400">
                {t(lang, "pageOf", currentPage, totalPages)}
              </span>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage(p => p + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-4 py-2 rounded-xl text-sm font-mono font-500 bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-all"
              >
                {t(lang, "nextPage")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
