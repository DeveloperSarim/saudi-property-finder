import React, { useState } from "react";
import { t } from "../i18n";

const PLATFORM_COLORS = {
  Bayut: "#10b981", Aqar: "#38bdf8", PropertyFinder: "#f59e0b",
  Wasalt: "#a78bfa", Sakani: "#34d399", Haraj: "#fb923c",
  OpenSooq: "#e879f9", Expatriates: "#60a5fa", Mourjan: "#f472b6",
  Satel: "#fbbf24", Zaahib: "#4ade80", Bezaat: "#c084fc", SaudiDeal: "#f87171",
};
const pc = (n) => PLATFORM_COLORS[n] || "#10b981";

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

export default function BrokerCard({ broker, index, lang = "en" }) {
  const [imgErr, setImgErr] = useState(false);
  const delay = Math.min(index * 40, 250);

  const phone = broker.phone;
  const waMsg = encodeURIComponent(
    `مرحباً، أود الاستفسار عن خدماتكم العقارية في ${broker.areas?.[0] || ""}`
  );
  const waNum = phone ? `966${phone}` : "";

  const displayName  = broker.name  || t(lang, "unknownBroker");
  const displayAgency = broker.agency || "";
  const areas = (broker.areas || []).filter(Boolean).slice(0, 3);
  const extraAreas = Math.max(0, (broker.areas || []).filter(Boolean).length - 3);

  const primaryColor = broker.platforms?.[0] ? pc(broker.platforms[0]) : "#10b981";

  return (
    <article
      className="card-enter bg-slate-800/60 border border-slate-700/60 rounded-2xl
                 overflow-hidden flex flex-col transition-all duration-300
                 hover:border-slate-600/80 hover:shadow-lg hover:shadow-black/30"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: primaryColor }} />

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* Avatar + name row */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {broker.photo_url && !imgErr ? (
              <img
                src={broker.photo_url}
                alt={displayName}
                className="w-14 h-14 rounded-2xl object-cover border-2"
                style={{ borderColor: primaryColor + "40" }}
                onError={() => setImgErr(true)}
                loading="lazy"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-700 font-mono border-2"
                style={{
                  background: primaryColor + "18",
                  borderColor: primaryColor + "40",
                  color: primaryColor,
                }}
              >
                {initials(broker.name)}
              </div>
            )}
            {/* Active dot */}
            <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 bg-emerald-500 rounded-full
                             border-2 border-slate-800 block" />
          </div>

          {/* Name + agency */}
          <div className="flex-1 min-w-0">
            <p className="font-display font-700 text-slate-100 text-sm leading-snug line-clamp-1">
              {displayName}
            </p>
            {displayAgency && (
              <p className="text-slate-400 text-xs mt-0.5 line-clamp-1 font-mono">
                {displayAgency}
              </p>
            )}
            {/* Listing count */}
            {broker.listing_count > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <span
                  className="text-xs font-mono font-600 px-2 py-0.5 rounded-full"
                  style={{ background: primaryColor + "18", color: primaryColor }}
                >
                  {broker.listing_count} {broker.listing_count === 1 ? t(lang, "listingFound") : t(lang, "listingsFound")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Platform badges */}
        {broker.platforms?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {broker.platforms.map(p => (
              <span
                key={p}
                className="text-xs font-mono px-2 py-0.5 rounded-lg font-600"
                style={{ background: pc(p) + "20", color: pc(p), border: `1px solid ${pc(p)}40` }}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Areas */}
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-slate-600 mt-0.5 shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {areas.map((area, i) => (
              <span key={i} className="text-xs text-slate-500 font-mono line-clamp-1">
                {area}{i < areas.length - 1 ? " ·" : ""}
              </span>
            ))}
            {extraAreas > 0 && (
              <span className="text-xs text-slate-600 font-mono">+{extraAreas}</span>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className="mt-auto pt-1 flex flex-col gap-2">
          {waNum ? (
            <div className="flex gap-2">
              <a
                href={`https://wa.me/${waNum}?text=${waMsg}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                           text-xs font-600 transition-all active:scale-95"
                style={{ background: "#25d36618", color: "#25d366", border: "1px solid #25d36630" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t(lang, "whatsapp")}
              </a>
              <a
                href={`tel:+${waNum}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                           bg-slate-700/50 border border-slate-600 text-slate-200
                           text-xs font-600 hover:bg-slate-700 transition-all active:scale-95"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.88a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {t(lang, "call")}
              </a>
            </div>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl bg-slate-700/30 border border-slate-700/40
                            text-xs font-mono text-slate-600 text-center">
              {t(lang, "noContact")}
            </div>
          )}
          {broker.profile_url && (
            <a
              href={broker.profile_url}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                         text-xs font-600 transition-all active:scale-95 border"
              style={{ background: primaryColor + "10", color: primaryColor, borderColor: primaryColor + "30" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M2 20c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
              </svg>
              {t(lang, "viewProfile")}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
