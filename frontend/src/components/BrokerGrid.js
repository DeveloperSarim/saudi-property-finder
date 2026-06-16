import React from "react";
import BrokerCard from "./BrokerCard";
import { t } from "../i18n";

export default function BrokerGrid({ brokers, loading, hasSearched, lang = "en" }) {
  if (!hasSearched && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full scale-150" />
          <div className="relative w-24 h-24 border border-emerald-500/20 rounded-2xl bg-slate-800/50
                          flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-emerald-500/60">
              <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="max-w-sm">
          <h2 className="font-display font-700 text-2xl text-slate-200 mb-2">
            {t(lang, "brokerHeroTitle")}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {t(lang, "brokerHeroDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (hasSearched && !loading && brokers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
            <circle cx="12" cy="8" r="4"/><path d="M2 20c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="font-600 text-slate-300 mb-1">{t(lang, "noBrokers")}</p>
          <p className="text-slate-500 text-sm">{t(lang, "noBrokersHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Count + loading indicator */}
      {brokers.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-600 text-2xl text-slate-100">{brokers.length}</span>
            <span className="text-slate-400 text-sm">{t(lang, "brokersFound")}</span>
          </div>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 ms-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {t(lang, "scanning")}…
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {brokers.map((broker, i) => (
          <BrokerCard key={broker.phone || i} broker={broker} index={i} lang={lang} />
        ))}
      </div>
    </div>
  );
}
