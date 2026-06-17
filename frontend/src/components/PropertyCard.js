import React, { useState } from "react";
import { t } from "../i18n";

const PLATFORM_COLORS = {
  Bayut: "#059669",
  Aqar: "#0284c7",
  PropertyFinder: "#d97706",
  Wasalt: "#7c3aed",
  Sakani: "#059669",
  Haraj: "#d97706",
  OpenSooq: "#c026d3",
  Expatriates: "#2563eb",
  Mourjan: "#db2777",
  Satel: "#b45309",
  Zaahib: "#15803d",
  Bezaat: "#7e22ce",
  SaudiDeal: "#dc2626",
};
const pc = (n) => PLATFORM_COLORS[n] || "#059669";

function fmt(price) {
  if (!price || price === 0) return null;
  return price.toLocaleString("en-US");
}

export default function PropertyCard({ listing, index, onClick, lang = "en" }) {
  const [imgErr, setImgErr] = useState(false);
  const color = pc(listing.source_platform_name);
  const priceNum = fmt(listing.price_sar);
  const delay = Math.min(index * 50, 300);

  const phone = listing.contact_number;
  // Normalize: strip all non-digits, remove 00966/966/0 prefix, then prepend 966
  const waNum = (() => {
    if (!phone) return "";
    const d = String(phone).replace(/\D/g, "");
    const local = d.startsWith("00966") ? d.slice(5)
                : d.startsWith("966") && d.length > 9 ? d.slice(3)
                : d.startsWith("0") ? d.slice(1)
                : d;
    return local.length >= 8 ? `966${local}` : "";
  })();
  const waMsg = encodeURIComponent(
    `مرحباً، أود الاستفسار عن: ${listing.title}\n${listing.source_url}`
  );

  const stopProp = (e) => e.stopPropagation();
  const handleCall = (e) => {
    e.stopPropagation();
    if (phone) window.location.href = `tel:+966${phone}`;
  };
  const handleView = (e) => {
    e.stopPropagation();
    window.open(listing.source_url, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className="card-enter card-glow bg-slate-900 border border-slate-700/60 rounded-2xl
                 overflow-hidden flex flex-col cursor-pointer group transition-all duration-300
                 hover:border-emerald-500/30"
      style={{ animationDelay:`${delay}ms`, animationFillMode:"both" }}
      onClick={() => onClick?.(listing)}
    >
      {/* ── Image ── */}
      <div className="relative h-44 bg-slate-800 overflow-hidden shrink-0">
        {listing.image_url && !imgErr ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" className="text-slate-500">
              <path d="M20 4L4 15v22h10V25h12v12h10V15L20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />

        <div className="absolute top-3 start-3 flex items-center gap-1.5">
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg font-600 backdrop-blur-sm"
                style={{ background:color+"25", color, border:`1px solid ${color}50` }}>
            {listing.source_platform_name}
          </span>
        </div>

        <button
          onClick={handleView}
          className="absolute top-3 end-3 w-7 h-7 bg-slate-900/70 backdrop-blur-sm rounded-lg
                     border border-slate-700/60 flex items-center justify-center
                     text-slate-400 hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
          title={`${t(lang,"viewOn")} ${listing.source_platform_name}`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-1 gap-3">

        <p className="font-display font-600 text-slate-100 text-sm leading-snug line-clamp-2
                      group-hover:text-emerald-400 transition-colors">
          {listing.title}
        </p>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          {priceNum ? (
            <>
              <span className="font-mono font-700 text-lg leading-none" style={{ color }}>
                {priceNum}
              </span>
              <span className="text-slate-500 text-xs font-mono">{t(lang,"sar")}</span>
              {listing.rent_period && (
                <span className="text-slate-400 text-xs font-mono">{listing.rent_period}</span>
              )}
            </>
          ) : (
            <span className="text-slate-500 text-sm font-mono italic">{t(lang,"priceOnRequest")}</span>
          )}
        </div>

        {listing.location_detail && (
          <div className="flex items-start gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-slate-600 mt-0.5 shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-slate-400 text-xs line-clamp-1">{listing.location_detail}</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {listing.bedrooms  !== "N/A" && listing.bedrooms  && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              🛏 <span>{listing.bedrooms}</span>
            </span>
          )}
          {listing.bathrooms !== "N/A" && listing.bathrooms && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              🚿 <span>{listing.bathrooms}</span>
            </span>
          )}
          {listing.area_sqm > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              📐 <span>{listing.area_sqm}m²</span>
            </span>
          )}
        </div>

        <div className="border-t border-slate-700/50 mt-auto pt-3 flex gap-2">
          {phone ? (
            <>
              <a href={`https://wa.me/${waNum}?text=${waMsg}`}
                 target="_blank" rel="noopener noreferrer"
                 onClick={stopProp}
                 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                            text-xs font-600 transition-all active:scale-95 text-center"
                 style={{ background:"#25d36615", color:"#25d366", border:"1px solid #25d36630" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t(lang,"whatsapp")}
              </a>
              <button onClick={handleCall}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                           bg-slate-700/50 border border-slate-600 text-slate-300
                           text-xs font-600 hover:bg-slate-700 transition-all active:scale-95">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.88a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {t(lang,"call")}
              </button>
            </>
          ) : (
            <button onClick={handleView}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                         text-xs font-600 transition-all active:scale-95 border"
              style={{ background:color+"12", color, borderColor:color+"35" }}>
              {`${t(lang,"viewOn")} ${listing.source_platform_name}`}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
