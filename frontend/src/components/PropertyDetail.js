import React, { useEffect } from "react";
import { t } from "../i18n";

const PLATFORM_COLORS = {
  Bayut: "#059669", Aqar: "#0284c7", PropertyFinder: "#d97706",
  Wasalt: "#7c3aed", Sakani: "#059669", Haraj: "#d97706",
  OpenSooq: "#c026d3", Expatriates: "#2563eb", Mourjan: "#db2777",
  Satel: "#b45309", Zaahib: "#15803d", Bezaat: "#7e22ce", SaudiDeal: "#dc2626",
};
const pc = (n) => PLATFORM_COLORS[n] || "#059669";

function fmt(p) {
  if (!p || p === 0) return null;
  return p.toLocaleString("en-US");
}

export default function PropertyDetail({ listing, onClose, lang = "en" }) {
  const color = pc(listing.source_platform_name);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
    `مرحباً، أود الاستفسار عن العقار:\n${listing.title}\nالرابط: ${listing.source_url}`
  );

  const stats = [
    listing.bedrooms  !== "N/A" && { icon:"🛏", labelKey:"bedroomsLabel",  value: listing.bedrooms },
    listing.bathrooms !== "N/A" && { icon:"🚿", labelKey:"bathroomsLabel", value: listing.bathrooms },
    listing.area_sqm  >  0      && { icon:"📐", labelKey:"areaLabel",      value: `${listing.area_sqm} m²` },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl
                      shadow-2xl shadow-black/60 overflow-hidden max-h-[90vh] flex flex-col
                      animate-[fadeUp_0.3s_ease_forwards]"
           onClick={e => e.stopPropagation()}>

        {/* ── Image header ── */}
        <div className="relative h-56 sm:h-64 bg-slate-900 shrink-0">
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display="none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 40 40" fill="none" className="text-slate-700">
                <path d="M20 4L4 15v22h10V25h12v12h10V15L20 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

          <div className="absolute top-4 start-4">
            <span className="text-xs font-mono px-3 py-1.5 rounded-xl backdrop-blur-sm font-600"
                  style={{ background: color+"25", color, border:`1px solid ${color}50` }}>
              {listing.source_platform_name}
            </span>
          </div>

          <button onClick={onClose}
            className="absolute top-4 end-4 w-8 h-8 bg-slate-900/80 backdrop-blur-sm
                       border border-slate-700 rounded-xl flex items-center justify-center
                       text-slate-400 hover:text-slate-200 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          <div>
            <h2 className="font-display font-700 text-xl text-slate-100 leading-snug mb-3">
              {listing.title}
            </h2>
            <div className="flex items-baseline gap-2 flex-wrap">
              {fmt(listing.price_sar) ? (
                <>
                  <span className="font-mono font-700 text-3xl" style={{ color }}>
                    {fmt(listing.price_sar)}
                  </span>
                  <span className="text-slate-500 font-mono text-sm">{t(lang,"sar")}</span>
                  {listing.rent_period && (
                    <span className="text-slate-400 font-mono text-sm">{listing.rent_period}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 font-mono text-lg italic">{t(lang,"priceOnRequest")}</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mt-0.5 shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <div>
              <p className="text-slate-200 font-500 text-sm">{listing.location_detail}</p>
              <p className="text-slate-500 text-xs mt-0.5 font-mono">{t(lang,"saudiArabia")}</p>
            </div>
          </div>

          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {stats.map(({ icon, labelKey, value }) => (
                <div key={labelKey} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{icon}</div>
                  <div className="font-mono font-600 text-slate-200 text-sm">{value}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{t(lang, labelKey)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Broker Details ── */}
          {listing.broker_name && (
            <div className="bg-slate-900/45 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
              {listing.broker_photo ? (
                <img
                  src={listing.broker_photo}
                  alt={listing.broker_name}
                  className="w-12 h-12 rounded-full object-cover border border-slate-600 shrink-0"
                  onError={e => { e.target.style.display="none"; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <span className="text-lg">👤</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-0.5">
                  {t(lang, "brokerTitle")}
                </p>
                <h4 className="text-slate-200 font-600 text-sm truncate">{listing.broker_name}</h4>
                {listing.broker_agency && listing.broker_agency !== listing.broker_name && (
                  <p className="text-slate-400 text-xs truncate mt-0.5">{listing.broker_agency}</p>
                )}
              </div>
              {listing.broker_url && (
                <a
                  href={listing.broker_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {t(lang, "viewProfile")}
                </a>
              )}
            </div>
          )}

          {/* ── REGA Verification & Deeds ── */}
          {(listing.rega_license_number || listing.deed_number) && (
            <div className="bg-slate-900/45 border border-slate-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-600 text-emerald-400 uppercase tracking-wider">
                  {t(lang, "regaVerified")}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {listing.rega_license_number && (
                  <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-2.5">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider mb-0.5">
                      {t(lang, "regaLicense")}
                    </span>
                    {listing.rega_license_url ? (
                      <a
                        href={listing.rega_license_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-200 font-mono font-600 text-xs hover:text-emerald-400 hover:underline flex items-center gap-1.5"
                      >
                        {listing.rega_license_number}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ) : (
                      <span className="text-slate-200 font-mono font-600 text-xs">
                        {listing.rega_license_number}
                      </span>
                    )}
                  </div>
                )}
                {listing.deed_number && (
                  <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-2.5">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider mb-0.5">
                      {t(lang, "deedNumber")}
                    </span>
                    <span className="text-slate-200 font-mono font-600 text-xs">
                      {listing.deed_number}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                {t(lang,"listedOn")}
              </p>
              <p className="font-600 text-sm" style={{ color }}>{listing.source_platform_name}</p>
            </div>
            <a href={listing.source_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 transition-all
                          border hover:opacity-90 shrink-0"
               style={{ background: color+"18", color, borderColor: color+"40" }}>
              {t(lang,"viewOn")} {listing.source_platform_name}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div className="p-4 border-t border-slate-700/60 flex gap-3 shrink-0">
          {phone ? (
            <>
              <a href={`https://wa.me/${waNum}?text=${waMsg}`}
                 target="_blank" rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                            text-sm font-600 transition-all active:scale-[0.98]"
                 style={{ background:"#25d36618", color:"#25d366", border:"1px solid #25d36635" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t(lang,"whatsappBroker")}
              </a>
              <a href={`tel:+${waNum}`}
                 className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                            bg-slate-700/50 border border-slate-600 text-slate-200
                            text-sm font-600 hover:bg-slate-700 transition-all active:scale-[0.98]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.88a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {t(lang,"call")} +{waNum}
              </a>
            </>
          ) : (
            <a href={listing.source_url} target="_blank" rel="noopener noreferrer"
               className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                          text-sm font-600 transition-all active:scale-[0.98]"
               style={{ background: color+"18", color, border: `1px solid ${color}40` }}>
              {t(lang,"viewFull")} {listing.source_platform_name}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
