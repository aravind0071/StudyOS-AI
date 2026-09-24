"use client";

import { useISTClock } from "@/lib/useISTClock";
import { Clock } from "lucide-react";

export function ISTClockBadge({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { dateStr, timeStr, displayStr } = useISTClock();

  if (!timeStr) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs ${className}`}>
        <Clock className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
        <span>Loading IST...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-[10.5px] font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap ${className}`} title="Indian Standard Time (UTC+5:30)">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="whitespace-nowrap">{displayStr}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-white/[0.08] shadow-sm font-mono text-xs transition-colors ${className}`}
      title="Live Indian Standard Time (Asia/Kolkata)"
    >
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
      <div className="flex flex-col text-left">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">IST (UTC+5:30)</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold leading-tight">{dateStr} • {timeStr}</span>
      </div>
    </div>
  );
}
