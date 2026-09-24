"use client";

import { useState, useRef, useEffect, useId } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Sparkles,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import clsx from "clsx";

interface DatePickerProps {
  id?: string;
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string; // YYYY-MM-DD
  showPresets?: boolean;
  className?: string;
  compact?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = "Choose target exam date",
  minDate,
  showPresets = true,
  className,
  compact = false,
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to format Date to YYYY-MM-DD in local time
  const toYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayStr = () => toYYYYMMDD(new Date());
  const todayStr = getTodayStr();
  const effectiveMin = minDate ? minDate : "";

  // Initial view year & month from value or today
  const getInitialView = () => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, d || 1);
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(getInitialView);

  // Synchronize viewDate if value changes externally
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      if (y && m) setViewDate(new Date(y, m - 1, d || 1));
    }
  }, [value]);

  // Click outside listener to close calendar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Month navigation
  const prevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setViewDate(now);
    onChange(todayStr);
    setIsOpen(false);
  };

  // Quick preset offsets in days
  const presets = [
    { label: "+1 Wk", days: 7 },
    { label: "+2 Wks", days: 14 },
    { label: "+1 Mo", days: 30 },
    { label: "+2 Mo", days: 60 },
    { label: "+3 Mo", days: 90 },
  ];

  const applyOffsetDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = toYYYYMMDD(target);
    onChange(dateStr);
    setViewDate(target);
    setIsOpen(false);
  };

  // Formatted date string with days remaining badge
  const getReadableInfo = () => {
    if (!value) return null;
    try {
      const [year, month, day] = value.split("-").map(Number);
      if (!year || !month || !day) return null;
      const targetDate = new Date(year, month - 1, day);
      const text = targetDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // Calculate days remaining from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return { text, diffDays };
    } catch {
      return null;
    }
  };

  const readableInfo = getReadableInfo();

  // Generate calendar days for current view month
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Days grid cells
  const calendarCells = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    calendarCells.push({
      dayNum,
      isCurrentMonth: false,
      dateStr: "",
      isPast: true,
      isSelected: false,
      isToday: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = effectiveMin ? cellDateStr < effectiveMin : false;
    const isSelected = value === cellDateStr;
    const isToday = cellDateStr === todayStr;

    calendarCells.push({
      dayNum: d,
      isCurrentMonth: true,
      dateStr: cellDateStr,
      isPast,
      isSelected,
      isToday,
    });
  }

  // Trailing days for grid completion (multiple of 7)
  const remainingCells = 7 - (calendarCells.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      calendarCells.push({
        dayNum: d,
        isCurrentMonth: false,
        dateStr: "",
        isPast: true,
        isSelected: false,
        isToday: false,
      });
    }
  }

  return (
    <div ref={containerRef} className={clsx("relative select-none", label ? (compact ? "space-y-1" : "space-y-2") : "", className)}>
      {label && (
        <label htmlFor={inputId} className={clsx("block font-semibold text-slate-700 dark:text-slate-200", compact ? "text-xs" : "text-sm")}>
          {label}
        </label>
      )}

      {/* Main trigger button */}
      <div
        id={inputId}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center justify-between text-left rounded-xl border transition-all duration-200 cursor-pointer shadow-sm",
          compact ? "h-[42px] px-3 text-xs sm:text-sm" : "py-2.5 px-3.5 text-sm",
          "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:shadow-emerald-500/5",
          isOpen && "ring-2 ring-emerald-500/30 border-emerald-500",
          readableInfo ? "text-slate-900 dark:text-slate-100 font-medium" : "text-slate-400 dark:text-slate-500"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={clsx("rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0", compact ? "w-6 h-6" : "w-8 h-8")}>
            <CalendarIcon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="truncate">
              {readableInfo ? readableInfo.text : placeholder}
            </span>
            {readableInfo && (
              <span className={clsx(
                "hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0",
                readableInfo.diffDays < 0
                  ? "bg-rose-500/10 text-rose-500"
                  : readableInfo.diffDays === 0
                  ? "bg-amber-500/10 text-amber-500"
                  : readableInfo.diffDays <= 7
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              )}>
                {readableInfo.diffDays === 0
                  ? "Today"
                  : readableInfo.diffDays < 0
                  ? `${Math.abs(readableInfo.diffDays)}d ago`
                  : `${readableInfo.diffDays}d left`}
              </span>
            )}
          </div>
        </div>

        {/* Clear or Calendar indicator */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              title="Clear date"
              className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <CalendarDays className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          )}
        </div>
      </div>

      {/* Floating Dark Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[340px] top-full mt-2 z-50 p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700/80 dark:border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header with Month / Year Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-wide">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={jumpToToday}
                className="text-[11px] font-semibold px-2 py-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all mr-1"
              >
                Today
              </button>
              <button
                type="button"
                onClick={prevMonth}
                title="Previous Month"
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                title="Next Month"
                className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 pt-3 pb-1 text-center">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="text-[11px] font-bold text-slate-400">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={`muted-${idx}`}
                    className="h-8 flex items-center justify-center text-xs text-slate-600/40 select-none pointer-events-none"
                  >
                    {cell.dayNum}
                  </div>
                );
              }

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  disabled={cell.isPast}
                  onClick={() => {
                    onChange(cell.dateStr);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    "h-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all duration-150 relative",
                    cell.isPast && "text-slate-600/50 cursor-not-allowed hover:bg-transparent",
                    !cell.isPast && !cell.isSelected && "text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300",
                    cell.isSelected && "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-md shadow-emerald-500/30 scale-105",
                    cell.isToday && !cell.isSelected && "ring-1 ring-emerald-400/80 text-emerald-400 font-bold bg-emerald-500/5"
                  )}
                >
                  {cell.dayNum}
                  {cell.isToday && !cell.isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* In-calendar Countdown Banner when selected */}
          {readableInfo && (
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {readableInfo.diffDays > 0
                  ? `${readableInfo.diffDays} days until exam`
                  : readableInfo.diffDays === 0
                  ? "Exam is today!"
                  : `${Math.abs(readableInfo.diffDays)} days ago`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Preset Buttons inside popover */}
          <div className="mt-3 pt-2.5 border-t border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" /> Quick Exam Target
            </div>
            <div className="grid grid-cols-5 gap-1">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyOffsetDays(p.days)}
                  className="text-[11px] font-semibold py-1 px-1 rounded-md text-slate-300 hover:text-white bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-slate-700/60 transition-all text-center"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preset Chips directly accessible below input without opening popover */}
      {showPresets && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-0.5">
            <Clock className="w-3 h-3 text-slate-400" /> Presets:
          </span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyOffsetDays(p.days)}
              className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
