import React, { useEffect, useState } from "react";
import { t } from "../i18n";

const SCAN_MESSAGES = {
  en: [
    "Connecting to Saudi real estate networks…",
    "Scanning Bayut listings…",
    "Scanning Aqar listings…",
    "Extracting property details…",
    "Parsing price data…",
    "Aggregating results…",
    "Filtering by your criteria…",
    "Almost there…",
  ],
  ar: [
    "الاتصال بشبكات العقارات السعودية…",
    "مسح قوائم بيوت…",
    "مسح قوائم عقار…",
    "استخراج تفاصيل العقارات…",
    "تحليل بيانات الأسعار…",
    "تجميع النتائج…",
    "تصفية وفق معاييرك…",
    "يكاد ينتهي…",
  ],
};

const PLATFORM_LABELS = {
  Bayut:       { color: "text-emerald-400", dot: "bg-emerald-500", badge: "badge-bayut" },
  Aqar:        { color: "text-sky-400",     dot: "bg-sky-500",     badge: "badge-aqar"  },
  Initialising:{ color: "text-slate-400",   dot: "bg-slate-500",   badge: ""            },
};

export default function LoadingOverlay({ scanStatus, listingsFound, lang = "en", onStop }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stopping, setStopping]  = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SCAN_MESSAGES[lang].length);
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 1800);
    return () => clearInterval(interval);
  }, [lang]);

  const platform      = scanStatus?.platform || "Initialising";
  const config        = PLATFORM_LABELS[platform] || PLATFORM_LABELS["Initialising"];
  const displayMessage= scanStatus?.message || SCAN_MESSAGES[lang][msgIndex];

  function handleStop() {
    setStopping(true);
    setTimeout(() => {
      if (onStop) onStop();
    }, 250); // tiny delay for button animation
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md mx-4 bg-slate-800/95 backdrop-blur-xl
                   border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60
                   overflow-hidden animate-[fadeUp_0.4s_ease_forwards]"
      >
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-700 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-y-0 left-0 w-full opacity-60"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)",
              animation: "scan 1.8s ease-in-out infinite",
            }}
          />
        </div>

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${stopping ? "bg-red-500" : config.dot}`}
                    style={{
                      animation: "pulseDot 1.4s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
              <span className="font-display font-600 text-slate-200 text-sm">
                {stopping ? (lang === "ar" ? "جارٍ الإيقاف…" : "Stopping…") : t(lang, "liveScan")}
              </span>
            </div>

            {listingsFound > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400
                              bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {listingsFound} {t(lang, "found")}
              </div>
            )}
          </div>

          {/* Status message */}
          <div className="mb-4">
            <p className="text-slate-300 text-sm font-mono leading-relaxed">
              {stopping
                ? (lang === "ar" ? "إيقاف الفحص…" : "Stopping scan, results so far are saved…")
                : displayMessage}
            </p>
          </div>

          {/* Platform pills + Stop button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-slate-600 font-mono shrink-0">{t(lang, "scanningLabel")}</span>
              <div className="flex gap-2 flex-wrap">
                {["Bayut", "Aqar"].map((p) => {
                  const cfg     = PLATFORM_LABELS[p];
                  const isActive= platform === p;
                  const isDone  = scanStatus?.counts?.[p] !== undefined;
                  return (
                    <span
                      key={p}
                      className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all duration-300 ${
                        isDone
                          ? "border-slate-600/40 bg-slate-700/30 text-slate-500"
                          : isActive
                          ? `${cfg.badge} ring-1 ring-inset ring-current ring-opacity-30`
                          : "border-slate-700/60 text-slate-600"
                      }`}
                    >
                      {isDone ? (
                        <span className="flex items-center gap-1.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            className="text-emerald-500">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {p} ({scanStatus.counts[p]})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {isActive && (
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse inline-block`} />
                          )}
                          {p}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* ── STOP button ── */}
            {onStop && (
              <button
                id="stop-scan-btn"
                onClick={handleStop}
                disabled={stopping}
                className={`
                  shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                  text-xs font-mono font-700 border transition-all duration-200
                  ${stopping
                    ? "border-slate-600 bg-slate-700/40 text-slate-500 cursor-not-allowed"
                    : "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 active:scale-95"
                  }
                `}
              >
                {stopping ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="30 50"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                )}
                {lang === "ar" ? "إيقاف" : "Stop"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
