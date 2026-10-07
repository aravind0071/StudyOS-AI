"use client";

import { useState, useEffect } from "react";

export interface ISTTimeData {
  timeStr: string;     // e.g. "12:15:30 AM"
  dateStr: string;     // e.g. "Sun, 13 Sep 2026"
  shortDate: string;   // e.g. "13 Sep 2026"
  fullStr: string;     // e.g. "Sun, 13 Sep 2026 • 12:15:30 AM IST"
  displayStr: string;  // e.g. "13 Sep 2026, 12:15 AM IST"
}

export function useISTClock(): ISTTimeData {
  const [data, setData] = useState<ISTTimeData>({
    timeStr: "",
    dateStr: "",
    shortDate: "",
    fullStr: "",
    displayStr: "",
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      
      const timeStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now);

      const timeShort = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(now);

      const shortDate = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(now);

      setData({
        timeStr,
        dateStr,
        shortDate,
        fullStr: `${dateStr} • ${timeStr} IST`,
        displayStr: `${shortDate}, ${timeShort} IST`,
      });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return data;
}
