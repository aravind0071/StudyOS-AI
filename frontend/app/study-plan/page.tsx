"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar, Clock, Target, Plus, Trash2, CheckCircle,
  AlertTriangle, Zap, BookOpen, Sparkles, Pencil,
  CheckCircle2, Sunrise, Sun, Moon, Coffee, Timer, Flame,
  BookMarked, Bell, BellRing, ArrowRight, RotateCcw,
  ListTodo, Layers, ShieldCheck, HelpCircle
} from "lucide-react";
import clsx from "clsx";
import DatePicker from "@/components/ui/DatePicker";

export interface ManualStudyBlock {
  id: string;
  dayIndex: number; // 0 = Day 1 (Today), 1 = Day 2 (Tomorrow), etc.
  startTime: string; // e.g. "07:30 AM"
  endTime: string;   // e.g. "09:00 AM"
  durationMinutes: number; // e.g. 90
  subject: string;   // e.g. "Operating Systems"
  topic: string;     // e.g. "Virtual Memory & Demand Paging"
  actionTasks: string; // e.g. "Read lecture slides 1-45, solve 5 numerical problems"
  activityType: "reading" | "practice" | "revision" | "quiz" | "break";
  isCompleted: boolean;
}

const DEFAULT_DAYS = [
  { dayIndex: 0, label: "Today (Day 1)" },
  { dayIndex: 1, label: "Tomorrow (Day 2)" },
  { dayIndex: 2, label: "Day 3" },
  { dayIndex: 3, label: "Day 4" },
  { dayIndex: 4, label: "Day 5" },
  { dayIndex: 5, label: "Day 6" },
  { dayIndex: 6, label: "Day 7" },
];

const INITIAL_STUDY_BLOCKS: ManualStudyBlock[] = [
  {
    id: "block-1",
    dayIndex: 0,
    startTime: "07:00 AM",
    endTime: "08:30 AM",
    durationMinutes: 90,
    subject: "Operating Systems",
    topic: "Virtual Memory & Paging Algorithms",
    actionTasks: "Read textbook Chapter 8, highlight FIFO vs LRU page replacement mechanics, write notes.",
    activityType: "reading",
    isCompleted: false,
  },
  {
    id: "block-2",
    dayIndex: 0,
    startTime: "02:00 PM",
    endTime: "03:30 PM",
    durationMinutes: 90,
    subject: "Computer Networks",
    topic: "TCP 3-Way Handshake & Flow Control",
    actionTasks: "Solve 6 past-year numerical questions on sliding window protocol and sequence numbers.",
    activityType: "practice",
    isCompleted: false,
  },
  {
    id: "block-3",
    dayIndex: 0,
    startTime: "07:30 PM",
    endTime: "08:45 PM",
    durationMinutes: 75,
    subject: "DBMS",
    topic: "B-Trees & 1NF-BCNF Normalization",
    actionTasks: "Active recall flashcards on functional dependencies, candidate keys, and multi-valued dependencies.",
    activityType: "revision",
    isCompleted: false,
  },
  {
    id: "block-4",
    dayIndex: 0,
    startTime: "09:30 PM",
    endTime: "10:00 PM",
    durationMinutes: 30,
    subject: "Revision",
    topic: "Daily Diagnostic Retention Quiz",
    actionTasks: "Take quick 10-question practice quiz on topics covered today to solidify long-term memory.",
    activityType: "quiz",
    isCompleted: false,
  },
];

// ── TIME UTILITIES & AUTO-DURATION ENGINE ────────────────────────────────────
function parseTimeToMinutes(t: string): number {
  if (!t) return 420; // 07:00 AM
  const cleaned = t.trim().toUpperCase();
  const isPM = cleaned.includes("PM");
  const isAM = cleaned.includes("AM");
  const raw = cleaned.replace(/AM|PM/g, "").trim();
  const parts = raw.split(":");
  let hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + mins;
}

function formatMinutesToTime(totalMinutes: number): string {
  let normalized = Math.round(totalMinutes) % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  let hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";

  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;

  const hh = String(displayHours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  return `${hh}:${mm} ${period}`;
}

function getDurationBetween(startTime: string, endTime: string): number {
  const startMins = parseTimeToMinutes(startTime);
  let endMins = parseTimeToMinutes(endTime);
  if (endMins <= startMins) {
    endMins += 24 * 60; // crossed midnight
  }
  return Math.max(15, endMins - startMins);
}

function calculateEndTimeFromDuration(startTime: string, durationMinutes: number): string {
  const startMins = parseTimeToMinutes(startTime);
  return formatMinutesToTime(startMins + Math.max(15, durationMinutes));
}

function formatDurationText(mins: number): string {
  const safeMins = Math.max(15, Number(mins) || 60);
  const h = Math.floor(safeMins / 60);
  const m = safeMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m (${safeMins} mins)`;
  if (h > 0) return `${h} hr${h > 1 ? "s" : ""} (${safeMins} mins)`;
  return `${safeMins} mins`;
}

function extractTimeParts(timeStr: string) {
  const cleaned = (timeStr || "07:00 AM").trim().toUpperCase();
  const period: "AM" | "PM" = cleaned.includes("PM") ? "PM" : "AM";
  const raw = cleaned.replace(/AM|PM/g, "").trim();
  const parts = raw.split(":");
  let h = parseInt(parts[0] || "7", 10);
  if (isNaN(h) || h < 1 || h > 12) h = 7;
  const hour = String(h).padStart(2, "0");

  let m = parseInt(parts[1] || "0", 10);
  if (isNaN(m)) m = 0;
  // Round minute to nearest 15 for dropdown
  const allowedMins = [0, 15, 30, 45];
  const closest = allowedMins.reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev, 0);
  const minute = String(closest).padStart(2, "0");

  return { hour, minute, period };
}

export default function StudyPlanPage() {
  // Days and Active Day Index
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [activeDay, setActiveDay] = useState(0);

  // Manual Time Blocks list
  const [blocks, setBlocks] = useState<ManualStudyBlock[]>(INITIAL_STUDY_BLOCKS);

  // Exam Deadline & Notification state
  const [examDate, setExamDate] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState(true);

  // Daily target hours and reading logger
  const [dailyTargetHours, setDailyTargetHours] = useState(4.0);
  const [quickLoggedMinutes, setQuickLoggedMinutes] = useState(0);

  // Modal State for Adding / Editing a Block
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Form Fields
  const [formSubject, setFormSubject] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formActionTasks, setFormActionTasks] = useState("");

  // Start Time Parts (change hour for hour, min for min, AM/PM toggle)
  const [startHour, setStartHour] = useState("07");
  const [startMinute, setStartMinute] = useState("00");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("AM");

  // End Time Parts (change hour for hour, min for min, AM/PM toggle)
  const [endHour, setEndHour] = useState("08");
  const [endMinute, setEndMinute] = useState("30");
  const [endPeriod, setEndPeriod] = useState<"AM" | "PM">("AM");

  // Duration input (string to allow blank erasing)
  const [formDurationInput, setFormDurationInput] = useState("90");
  const [formActivityType, setFormActivityType] = useState<ManualStudyBlock["activityType"]>("reading");

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedBlocks = localStorage.getItem("studyos_manual_study_blocks_v3");
      if (savedBlocks) setBlocks(JSON.parse(savedBlocks));

      const savedExamDate = localStorage.getItem("studyos_target_exam_date");
      if (savedExamDate) setExamDate(savedExamDate);

      const savedSubject = localStorage.getItem("studyos_target_subject");
      if (savedSubject) setExamSubject(savedSubject);

      const savedReminders = localStorage.getItem("studyos_daily_reminders_enabled");
      if (savedReminders !== null) setDailyRemindersEnabled(savedReminders === "true");

      const savedTarget = localStorage.getItem("studyos_daily_target_hours");
      if (savedTarget) setDailyTargetHours(parseFloat(savedTarget));

      const savedQuickLog = localStorage.getItem("studyos_quick_logged_minutes");
      if (savedQuickLog) setQuickLoggedMinutes(parseInt(savedQuickLog, 10));
    } catch (e) {}
  }, []);

  // Sync blocks to localStorage
  const saveBlocks = (newBlocks: ManualStudyBlock[]) => {
    setBlocks(newBlocks);
    try {
      localStorage.setItem("studyos_manual_study_blocks_v3", JSON.stringify(newBlocks));
    } catch (e) {}
  };

  // Exam Date handler
  const handleExamDateChange = (newDate: string) => {
    setExamDate(newDate);
    try {
      localStorage.setItem("studyos_target_exam_date", newDate);
    } catch (e) {}

    if (newDate) {
      triggerExamReminderNotification(newDate, examSubject);
    }
  };

  const handleExamSubjectChange = (val: string) => {
    setExamSubject(val);
    try {
      localStorage.setItem("studyos_target_subject", val);
    } catch (e) {}
  };

  const toggleDailyReminders = () => {
    const nextVal = !dailyRemindersEnabled;
    setDailyRemindersEnabled(nextVal);
    try {
      localStorage.setItem("studyos_daily_reminders_enabled", nextVal.toString());
    } catch (e) {}
    toast.success(nextVal ? "Daily exam countdown reminders enabled!" : "Daily reminders muted.");
  };

  // Quick 1-click preset offset for exam deadline
  const applyExamPresetDays = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    handleExamDateChange(dateStr);
    toast.success(`Exam deadline scheduled for ${dateStr} (${daysOffset} days from today)!`);
  };

  // Dispatch daily countdown notification to StudyOS Notification Center
  const triggerExamReminderNotification = (dateStr: string, subj: string) => {
    if (!dateStr) return;
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const targetDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const title = diffDays <= 0
        ? `🚨 Exam Day Today: ${subj || "Your Exam"}`
        : diffDays === 1
        ? `⚠️ Final Day Countdown: 1 Day to ${subj || "Exam"}!`
        : `⏳ Exam Countdown: ${diffDays} Days Left (${subj || "Target Exam"})`;

      const message = diffDays <= 0
        ? `Your exam is today! Review your formula sheets and stay calm.`
        : `Only ${diffDays} days left until your exam on ${targetDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}. Keep to today's study timetable!`;

      // Dispatch to NotificationCenter via custom event
      window.dispatchEvent(
        new CustomEvent("studyos-notify", {
          detail: {
            id: `exam-remind-${Date.now()}`,
            title,
            message,
            category: "study",
            timestamp: "Just now",
            read: false,
            link: "/study-plan",
            actionText: "View Timetable",
          },
        })
      );

      toast.success("Exam reminder notification sent to Notification Center!");
    } catch (e) {
      toast.error("Could not calculate exam reminder.");
    }
  };

  // Time helper: compute end time string from start and duration
  const syncEndTimeFromStartAndDuration = (sHour: string, sMin: string, sPeriod: "AM" | "PM", durMins: number) => {
    const startTimeStr = `${sHour}:${sMin} ${sPeriod}`;
    const endStr = calculateEndTimeFromDuration(startTimeStr, durMins);
    const parts = extractTimeParts(endStr);
    setEndHour(parts.hour);
    setEndMinute(parts.minute);
    setEndPeriod(parts.period);
  };

  // Hour for Hour, Minute for Minute, AM/PM for AM/PM
  const handleStartHourChange = (newHour: string) => {
    setStartHour(newHour);
    const dur = parseInt(formDurationInput, 10);
    if (!isNaN(dur) && dur > 0) {
      syncEndTimeFromStartAndDuration(newHour, startMinute, startPeriod, dur);
    }
  };

  const handleStartMinuteChange = (newMin: string) => {
    setStartMinute(newMin);
    const dur = parseInt(formDurationInput, 10);
    if (!isNaN(dur) && dur > 0) {
      syncEndTimeFromStartAndDuration(startHour, newMin, startPeriod, dur);
    }
  };

  const handleStartPeriodToggle = (newPeriod: "AM" | "PM") => {
    setStartPeriod(newPeriod);
    const dur = parseInt(formDurationInput, 10);
    if (!isNaN(dur) && dur > 0) {
      syncEndTimeFromStartAndDuration(startHour, startMinute, newPeriod, dur);
    }
  };

  const handleEndHourChange = (newHour: string) => {
    setEndHour(newHour);
    const newEndTime = `${newHour}:${endMinute} ${endPeriod}`;
    const diff = getDurationBetween(`${startHour}:${startMinute} ${startPeriod}`, newEndTime);
    setFormDurationInput(String(diff));
  };

  const handleEndMinuteChange = (newMin: string) => {
    setEndMinute(newMin);
    const newEndTime = `${endHour}:${newMin} ${endPeriod}`;
    const diff = getDurationBetween(`${startHour}:${startMinute} ${startPeriod}`, newEndTime);
    setFormDurationInput(String(diff));
  };

  const handleEndPeriodToggle = (newPeriod: "AM" | "PM") => {
    setEndPeriod(newPeriod);
    const newEndTime = `${endHour}:${endMinute} ${newPeriod}`;
    const diff = getDurationBetween(`${startHour}:${startMinute} ${startPeriod}`, newEndTime);
    setFormDurationInput(String(diff));
  };

  // Duration Input: when user erases, it stays completely blank! No "0" forced!
  const handleDurationInputChange = (val: string) => {
    if (val === "") {
      setFormDurationInput("");
      return;
    }
    const cleaned = val.replace(/\D/g, "");
    setFormDurationInput(cleaned);
    const mins = parseInt(cleaned, 10);
    if (!isNaN(mins) && mins > 0) {
      syncEndTimeFromStartAndDuration(startHour, startMinute, startPeriod, mins);
    }
  };

  const handleDurationPreset = (presetMins: number) => {
    const safe = Math.max(15, presetMins);
    setFormDurationInput(String(safe));
    syncEndTimeFromStartAndDuration(startHour, startMinute, startPeriod, safe);
  };

  // Action plan helper functions
  const appendActionTask = (textToAppend: string) => {
    setFormActionTasks((prev) => {
      if (!prev.trim()) return textToAppend;
      return prev.endsWith("\n") ? `${prev}${textToAppend}` : `${prev}\n${textToAppend}`;
    });
  };

  const addBulletItem = () => {
    setFormActionTasks((prev) => {
      if (!prev.trim()) return "• ";
      return prev.endsWith("\n") ? `${prev}• ` : `${prev}\n• `;
    });
  };

  const prependTopicTag = (tag: string) => {
    setFormTopic((prev) => {
      if (!prev) return tag + " ";
      if (prev.includes(tag)) return prev;
      return `${tag} ${prev}`;
    });
  };

  // Open modal for a new block
  const openNewBlockModal = () => {
    setEditingBlockId(null);
    setFormSubject(examSubject || "Core Subject");
    setFormTopic("");
    setFormActionTasks("");
    setStartHour("07");
    setStartMinute("00");
    setStartPeriod("AM");
    setEndHour("08");
    setEndMinute("30");
    setEndPeriod("AM");
    setFormDurationInput("90");
    setFormActivityType("reading");
    setIsModalOpen(true);
  };

  // Open modal to edit an existing block
  const openEditBlockModal = (block: ManualStudyBlock) => {
    setEditingBlockId(block.id);
    setFormSubject(block.subject);
    setFormTopic(block.topic);
    setFormActionTasks(block.actionTasks);
    const sParts = extractTimeParts(block.startTime);
    setStartHour(sParts.hour);
    setStartMinute(sParts.minute);
    setStartPeriod(sParts.period);
    const eParts = extractTimeParts(block.endTime);
    setEndHour(eParts.hour);
    setEndMinute(eParts.minute);
    setEndPeriod(eParts.period);
    const dur = block.durationMinutes || getDurationBetween(block.startTime, block.endTime);
    setFormDurationInput(String(dur));
    setFormActivityType(block.activityType);
    setIsModalOpen(true);
  };

  // Save Block (Create or Edit)
  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopic.trim()) {
      toast.error("Please enter what topic or task to study.");
      return;
    }

    const sTime = `${startHour}:${startMinute} ${startPeriod}`;
    const eTime = `${endHour}:${endMinute} ${endPeriod}`;
    const parsedDur = parseInt(formDurationInput, 10);
    const durationMinutes = (!isNaN(parsedDur) && parsedDur > 0)
      ? parsedDur
      : getDurationBetween(sTime, eTime);

    if (editingBlockId) {
      // Update
      const updated = blocks.map((b) =>
        b.id === editingBlockId
          ? {
              ...b,
              subject: formSubject.trim() || "Subject",
              topic: formTopic.trim(),
              actionTasks: formActionTasks.trim(),
              startTime: sTime,
              endTime: eTime,
              durationMinutes,
              activityType: formActivityType,
            }
          : b
      );
      saveBlocks(updated);
      toast.success("Study block updated!");
    } else {
      // Create new
      const newBlock: ManualStudyBlock = {
        id: `block-${Date.now()}`,
        dayIndex: activeDay,
        subject: formSubject.trim() || "Subject",
        topic: formTopic.trim(),
        actionTasks: formActionTasks.trim(),
        startTime: sTime,
        endTime: eTime,
        durationMinutes,
        activityType: formActivityType,
        isCompleted: false,
      };
      saveBlocks([...blocks, newBlock]);
      toast.success("New study block scheduled for this day!");
    }

    setIsModalOpen(false);
  };

  // Toggle complete state of a block
  const toggleBlockCompleted = (blockId: string) => {
    const updated = blocks.map((b) =>
      b.id === blockId ? { ...b, isCompleted: !b.isCompleted } : b
    );
    saveBlocks(updated);
  };

  // Delete a block
  const deleteBlock = (blockId: string) => {
    const updated = blocks.filter((b) => b.id !== blockId);
    saveBlocks(updated);
    toast.success("Study block removed from timetable.");
  };

  // Quick preset template filler
  const loadPresetTemplate = () => {
    const presetForDay: ManualStudyBlock[] = [
      {
        id: `preset-1-${Date.now()}`,
        dayIndex: activeDay,
        startTime: "07:30 AM",
        endTime: "09:00 AM",
        durationMinutes: 90,
        subject: examSubject || "Core Engineering",
        topic: "High-Yield Chapter Deep-Dive",
        actionTasks: "Read lecture notes, highlight primary definitions, write summary bullet points.",
        activityType: "reading",
        isCompleted: false,
      },
      {
        id: `preset-2-${Date.now()}`,
        dayIndex: activeDay,
        startTime: "02:00 PM",
        endTime: "03:30 PM",
        durationMinutes: 90,
        subject: examSubject || "Problem Solving",
        topic: "Formulas & PYQ Numerical Practice",
        actionTasks: "Solve 10 university examination numericals without looking at solutions.",
        activityType: "practice",
        isCompleted: false,
      },
      {
        id: `preset-3-${Date.now()}`,
        dayIndex: activeDay,
        startTime: "07:30 PM",
        endTime: "08:45 PM",
        durationMinutes: 75,
        subject: examSubject || "Revision",
        topic: "Active Recall & Spaced Repetition",
        actionTasks: "Self-test flashcards and summarize weak concepts from memory.",
        activityType: "revision",
        isCompleted: false,
      },
    ];

    saveBlocks([...blocks.filter((b) => b.dayIndex !== activeDay), ...presetForDay]);
    toast.success("Loaded balanced 4.2-hour study schedule for this day!");
  };

  // Clear blocks for active day
  const clearDayBlocks = () => {
    const updated = blocks.filter((b) => b.dayIndex !== activeDay);
    saveBlocks(updated);
    toast.info("Cleared schedule for this day.");
  };

  // Quick log minutes
  const logMinutes = (mins: number) => {
    const newVal = Math.max(0, quickLoggedMinutes + mins);
    setQuickLoggedMinutes(newVal);
    try {
      localStorage.setItem("studyos_quick_logged_minutes", newVal.toString());
    } catch (e) {}
    toast.success(`Logged +${mins}m of study reading!`);
  };

  // Filter blocks for active day
  const dayBlocks = blocks.filter((b) => b.dayIndex === activeDay);

  // Calculate day metrics
  const totalPlannedMinutes = dayBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
  const totalPlannedHours = (totalPlannedMinutes / 60).toFixed(1);

  const completedBlocksMinutes = dayBlocks
    .filter((b) => b.isCompleted)
    .reduce((acc, b) => acc + b.durationMinutes, 0);
  const totalDoneMinutes = completedBlocksMinutes + quickLoggedMinutes;
  const totalDoneHours = (totalDoneMinutes / 60).toFixed(1);

  const dayProgressPercent = totalPlannedMinutes > 0
    ? Math.min(100, Math.round((totalDoneMinutes / totalPlannedMinutes) * 100))
    : 0;

  // Days remaining until exam
  const calculateDaysLeft = () => {
    if (!examDate) return null;
    try {
      const [year, month, day] = examDate.split("-").map(Number);
      const target = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  const daysLeft = calculateDaysLeft();

  // Helper for badge styling
  const getActivityBadge = (type: ManualStudyBlock["activityType"]) => {
    switch (type) {
      case "reading":
        return { label: "Concept Reading", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
      case "practice":
        return { label: "Problem Practice", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "revision":
        return { label: "Active Recall", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      case "quiz":
        return { label: "Mock Quiz", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
      case "break":
        return { label: "Rest Break", color: "text-teal-400 bg-teal-500/10 border-teal-500/20" };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 w-full">
      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-emerald-500" /> Manual Study Timetable & Daily Schedule
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            You dictate your own study timetable: what to do, what exact hours to read, and track your daily hours.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openNewBlockModal}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 font-bold"
          >
            <Plus className="w-4 h-4" /> Add Time Block
          </button>
          <button
            type="button"
            onClick={loadPresetTemplate}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Load recommended template for this day"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Load Preset
          </button>
          <button
            type="button"
            onClick={clearDayBlocks}
            className="btn-secondary text-xs py-2 px-2.5 text-slate-400 hover:text-rose-400"
            title="Clear all blocks for this day"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── EXAM DEADLINE & DAY-TO-DAY NOTIFICATION REMINDER CARD ─────────── */}
      <div className="card p-5 sm:p-6 border border-slate-700/80 dark:border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 shadow-xl relative z-30">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Exam Inputs */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Target Exam Deadline
              </span>
              {daysLeft !== null && (
                <span className={clsx(
                  "text-xs font-bold px-2.5 py-0.5 rounded-full border",
                  daysLeft <= 0
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    : daysLeft <= 3
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : daysLeft <= 7
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                )}>
                  {daysLeft <= 0
                    ? "Exam is Today!"
                    : daysLeft === 1
                    ? "1 Day Remaining!"
                    : `${daysLeft} Days Remaining`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl items-start">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Target Subject / Course
                </label>
                <div className="relative flex items-center">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={examSubject}
                    onChange={(e) => handleExamSubjectChange(e.target.value)}
                    placeholder="e.g. Operating Systems, Python"
                    style={{ paddingLeft: "2.4rem" }}
                    className="w-full h-[42px] rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-3 transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Exam Date
                </label>
                <DatePicker
                  id="target_exam_deadline_picker"
                  value={examDate}
                  onChange={handleExamDateChange}
                  placeholder="Set Exam Date"
                  showPresets={false}
                  compact={true}
                />
              </div>
            </div>

            {/* Quick 1-Click Presets row spanning cleanly underneath both columns */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 max-w-xl">
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> Quick Exam Presets:
              </span>
              {[
                { label: "+3 Days", days: 3 },
                { label: "+1 Wk", days: 7 },
                { label: "+2 Wks", days: 14 },
                { label: "+1 Mo", days: 30 },
                { label: "+2 Mo", days: 60 },
                { label: "+3 Mo", days: 90 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyExamPresetDays(p.days)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800/90 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/80 transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Day-to-Day Notification Reminders Toggle & Test */}
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-4 rounded-xl shrink-0 flex flex-col justify-between sm:w-80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                <BellRing className="w-4 h-4 text-amber-400" /> Day-to-Day Reminders
              </div>
              <button
                type="button"
                onClick={toggleDailyReminders}
                className={clsx(
                  "text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all",
                  dailyRemindersEnabled
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-700 text-slate-400 border-slate-600"
                )}
              >
                {dailyRemindersEnabled ? "Active" : "Muted"}
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
              Sends daily morning countdown & timetable reminders to your top notification bell.
            </p>

            <button
              type="button"
              onClick={() => triggerExamReminderNotification(examDate, examSubject)}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" /> Send Reminder Notification Now
            </button>
          </div>
        </div>
      </div>

      {/* ── DAY SELECTOR TABS ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-white/10">
        {days.map((d) => {
          const count = blocks.filter((b) => b.dayIndex === d.dayIndex).length;
          const isActive = activeDay === d.dayIndex;
          return (
            <button
              key={d.dayIndex}
              type="button"
              onClick={() => setActiveDay(d.dayIndex)}
              className={clsx(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border",
                isActive
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/25 scale-105"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-500/40"
              )}
            >
              <span>{d.label}</span>
              <span className={clsx(
                "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              )}>
                {count} blocks
              </span>
            </button>
          );
        })}
      </div>

      {/* ── METRICS SUMMARY FOR ACTIVE DAY ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" /> Planned Hours
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalPlannedHours} <span className="text-xs text-slate-400 font-normal">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {dayBlocks.length} study blocks scheduled
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed
          </div>
          <div className="text-2xl font-black text-emerald-500">
            {totalDoneHours} <span className="text-xs text-slate-400 font-normal">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {dayBlocks.filter((b) => b.isCompleted).length} blocks checked off
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Completion Rate
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {dayProgressPercent}%
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              style={{ width: `${dayProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="card p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-purple-400" /> Quick Log Time
            </span>
            {quickLoggedMinutes > 0 && (
              <button
                type="button"
                onClick={() => logMinutes(-quickLoggedMinutes)}
                className="text-[10px] text-slate-500 hover:text-rose-400"
              >
                Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2">
            {[15, 30, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => logMinutes(m)}
                className="py-1 text-[11px] font-bold rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all text-center"
              >
                +{m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCHEDULED TIME BLOCKS LIST FOR ACTIVE DAY ───────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-emerald-500" /> Timetable for {days.find((d) => d.dayIndex === activeDay)?.label}
          </h2>
          <span className="text-xs font-semibold text-slate-400">
            {dayBlocks.length} Blocks · {totalPlannedHours} Hours Total
          </span>
        </div>

        {dayBlocks.length === 0 ? (
          <div className="card p-12 text-center border border-dashed border-slate-300 dark:border-slate-800">
            <Clock className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              No Study Blocks Scheduled for This Day
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Schedule your hours, what topics you plan to read, and what numericals or tasks to solve.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={openNewBlockModal}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold"
              >
                <Plus className="w-4 h-4" /> Schedule First Time Block
              </button>
              <button
                type="button"
                onClick={loadPresetTemplate}
                className="btn-secondary text-xs py-2 px-4"
              >
                Load Preset Schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {dayBlocks.map((block) => {
              const badge = getActivityBadge(block.activityType);
              return (
                <div
                  key={block.id}
                  className={clsx(
                    "card p-5 border transition-all duration-200 relative group flex flex-col sm:flex-row sm:items-start justify-between gap-4",
                    block.isCompleted
                      ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-white/5 opacity-70"
                      : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-white/10 hover:border-emerald-500/40 hover:shadow-md"
                  )}
                >
                  {/* Left: Checkmark & Content */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleBlockCompleted(block.id)}
                      className={clsx(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all",
                        block.isCompleted
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 dark:border-slate-600 hover:border-emerald-500"
                      )}
                      title={block.isCompleted ? "Mark incomplete" : "Mark completed"}
                    >
                      {block.isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                    </button>

                    <div className="space-y-1 min-w-0 flex-1">
                      {/* Top Meta Line: Time Range & Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {block.startTime} – {block.endTime}
                        </span>

                        <span className="text-xs text-slate-400 font-semibold">
                          ({block.durationMinutes} min · {(block.durationMinutes / 60).toFixed(1)} hrs)
                        </span>

                        <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-md border", badge.color)}>
                          {badge.label}
                        </span>

                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {block.subject}
                        </span>
                      </div>

                      {/* Main Title / Topic */}
                      <h3 className={clsx(
                        "text-base font-bold pt-1",
                        block.isCompleted ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                      )}>
                        {block.topic}
                      </h3>

                      {/* What to do / Action checklist */}
                      {block.actionTasks && (
                        <div className="pt-1.5 space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Action Plan & Tasks:
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {block.actionTasks.split("\n").filter(Boolean).map((taskLine, tIdx) => {
                              const cleaned = taskLine.replace(/^[•\-\*]\s*/, "");
                              return (
                                <div key={tIdx} className="flex items-start gap-2 text-xs text-slate-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">{cleaned}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                    <button
                      type="button"
                      onClick={() => openEditBlockModal(block)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 text-slate-400 hover:text-purple-300 transition-all"
                      title="Edit this study block"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBlock(block.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all"
                      title="Delete this study block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: SCHEDULE / EDIT TIME BLOCK (FIT TO SCREEN 2-COLUMN) ───── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-hidden animate-fadeIn">
          <form
            onSubmit={handleSaveBlock}
            className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl bg-gradient-to-b from-slate-900 via-slate-900/98 to-slate-950 text-left overflow-hidden animate-scaleUp"
          >
            {/* FIXED MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:px-6 shrink-0 bg-slate-900/95">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    {editingBlockId ? "Edit Study Time Block" : "Schedule New Study Block"}
                    <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {days.find((d) => d.dayIndex === activeDay)?.label}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Configure focused topics, synchronized study hours, and specific execution checklist.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SCROLLABLE 2-COLUMN BODY THAT FITS THE VIEWPORT */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* ── LEFT COLUMN: Topic & Action Plan (7 cols on md+) ── */}
                <div className="md:col-span-7 space-y-3">
                  {/* Subject & Activity Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Subject / Course
                      </label>
                      <input
                        type="text"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        placeholder="e.g. Operating Systems, DBMS"
                        className="input-field text-xs sm:text-sm py-1.5 bg-slate-900/90"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" /> Activity Focus
                      </label>
                      <select
                        value={formActivityType}
                        onChange={(e) => setFormActivityType(e.target.value as any)}
                        className="input-field text-xs sm:text-sm py-1.5 bg-slate-900/90 text-slate-200"
                      >
                        <option value="reading">📖 Concept Reading & Theory</option>
                        <option value="practice">⚡ Problem Solving & Coding</option>
                        <option value="revision">🧠 Active Recall & Flashcards</option>
                        <option value="quiz">📝 Diagnostic Quiz & PYQs</option>
                        <option value="break">☕ Rest & Cognitive Break</option>
                      </select>
                    </div>
                  </div>

                  {/* Topic / Chapter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        What to Study (Topic / Chapter) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Quick tags:</span>
                    </div>
                    <input
                      type="text"
                      value={formTopic}
                      onChange={(e) => setFormTopic(e.target.value)}
                      placeholder="e.g. Demand Paging, Inverted Page Tables & TLB Hit Ratio"
                      className="input-field text-xs sm:text-sm py-1.5 bg-slate-900/90 font-medium"
                      required
                    />
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {[
                        "[Deep Dive]",
                        "[Numericals]",
                        "[Formulas]",
                        "[PYQs]",
                        "[Recap]",
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => prependTopicTag(tag)}
                          className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700/60 transition-all cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specific Tasks / Action Plan container */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                        Specific Tasks / Action Plan
                      </label>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formActionTasks ? `${formActionTasks.split("\n").filter(Boolean).length} tasks defined` : "Checklist"}
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex items-center gap-1 flex-wrap bg-slate-800/70 p-1 rounded-lg border border-slate-700/60">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Insert:</span>
                      <button
                        type="button"
                        onClick={addBulletItem}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/90 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 transition-all cursor-pointer"
                      >
                        + Bullet (•)
                      </button>
                      <button
                        type="button"
                        onClick={() => appendActionTask("• Read lecture slides 1-45 & annotate definitions")}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/90 hover:bg-sky-500/20 text-slate-200 hover:text-sky-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        📖 Read Notes
                      </button>
                      <button
                        type="button"
                        onClick={() => appendActionTask("• Solve 5 past-year numerical questions with steps")}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/90 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        ⚡ Numericals
                      </button>
                      <button
                        type="button"
                        onClick={() => appendActionTask("• Active recall & self-test formula sheet from memory")}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/90 hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        🧠 Formulas
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormActionTasks("")}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all ml-auto cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Textarea with balanced height */}
                    <div className="relative">
                      <textarea
                        value={formActionTasks}
                        onChange={(e) => setFormActionTasks(e.target.value)}
                        placeholder={`• Read textbook Chapter 8 on Virtual Memory & TLB architecture\n• Solve 5 numerical problems comparing FIFO vs LRU page faults\n• Write down 1-page formula cheatsheet and self-test\n• Review weak quiz questions from yesterday`}
                        rows={5}
                        className="w-full rounded-xl bg-slate-950/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-100 placeholder:text-slate-500 text-xs font-mono leading-relaxed p-2.5 resize-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Time Scheduling & Duration Console (5 cols on md+) ── */}
                <div className="md:col-span-5 space-y-2.5">
                  <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400" /> Time & Duration
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {formatDurationText(parseInt(formDurationInput, 10) || 0)}
                      </span>
                    </div>

                    {/* Start Time */}
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">Start Time</span>
                        <span className="font-mono text-emerald-400 font-bold text-xs">
                          {startHour}:{startMinute} {startPeriod}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">Hour</span>
                          <select
                            value={startHour}
                            onChange={(e) => handleStartHourChange(e.target.value)}
                            className="w-full bg-slate-800 text-white text-xs font-semibold py-1 px-1 rounded border border-slate-700 text-center cursor-pointer"
                          >
                            {["01","02","03","04","05","06","07","08","09","10","11","12"].map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">Min</span>
                          <select
                            value={startMinute}
                            onChange={(e) => handleStartMinuteChange(e.target.value)}
                            className="w-full bg-slate-800 text-white text-xs font-semibold py-1 px-1 rounded border border-slate-700 text-center cursor-pointer"
                          >
                            {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                              <option key={m} value={m}>:{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">AM/PM</span>
                          <div className="flex rounded overflow-hidden border border-slate-700 bg-slate-800 h-[26px] p-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartPeriodToggle("AM")}
                              className={clsx(
                                "flex-1 text-[9px] font-bold rounded transition-all cursor-pointer flex items-center justify-center",
                                startPeriod === "AM" ? "bg-emerald-500 text-white shadow" : "text-slate-400 hover:text-white"
                              )}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartPeriodToggle("PM")}
                              className={clsx(
                                "flex-1 text-[9px] font-bold rounded transition-all cursor-pointer flex items-center justify-center",
                                startPeriod === "PM" ? "bg-emerald-500 text-white shadow" : "text-slate-400 hover:text-white"
                              )}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* End Time */}
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">End Time</span>
                        <span className="font-mono text-purple-400 font-bold text-xs">
                          {endHour}:{endMinute} {endPeriod}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">Hour</span>
                          <select
                            value={endHour}
                            onChange={(e) => handleEndHourChange(e.target.value)}
                            className="w-full bg-slate-800 text-white text-xs font-semibold py-1 px-1 rounded border border-slate-700 text-center cursor-pointer"
                          >
                            {["01","02","03","04","05","06","07","08","09","10","11","12"].map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">Min</span>
                          <select
                            value={endMinute}
                            onChange={(e) => handleEndMinuteChange(e.target.value)}
                            className="w-full bg-slate-800 text-white text-xs font-semibold py-1 px-1 rounded border border-slate-700 text-center cursor-pointer"
                          >
                            {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                              <option key={m} value={m}>:{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-400 uppercase font-semibold mb-0.5 text-center">AM/PM</span>
                          <div className="flex rounded overflow-hidden border border-slate-700 bg-slate-800 h-[26px] p-0.5">
                            <button
                              type="button"
                              onClick={() => handleEndPeriodToggle("AM")}
                              className={clsx(
                                "flex-1 text-[9px] font-bold rounded transition-all cursor-pointer flex items-center justify-center",
                                endPeriod === "AM" ? "bg-purple-500 text-white shadow" : "text-slate-400 hover:text-white"
                              )}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEndPeriodToggle("PM")}
                              className={clsx(
                                "flex-1 text-[9px] font-bold rounded transition-all cursor-pointer flex items-center justify-center",
                                endPeriod === "PM" ? "bg-purple-500 text-white shadow" : "text-slate-400 hover:text-white"
                              )}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Duration input */}
                    <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">Duration (Mins)</span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">
                          {formDurationInput ? `${formDurationInput}m` : "blank"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDurationPreset(Math.max(15, (parseInt(formDurationInput, 10) || 60) - 15))}
                          className="w-8 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer shrink-0"
                          title="Decrease 15 mins"
                        >
                          -15
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formDurationInput}
                            onChange={(e) => handleDurationInputChange(e.target.value)}
                            placeholder="Minutes"
                            className="w-full text-center bg-slate-950 border border-slate-700 rounded py-0.5 text-xs sm:text-sm font-mono font-bold text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDurationPreset((parseInt(formDurationInput, 10) || 60) + 15)}
                          className="w-8 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer shrink-0"
                          title="Increase 15 mins"
                        >
                          +15
                        </button>
                      </div>
                    </div>

                    {/* Quick Duration Badges */}
                    <div>
                      <div className="text-[9px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" /> Quick Presets:
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: "30m", mins: 30 },
                          { label: "45m", mins: 45 },
                          { label: "60m", mins: 60 },
                          { label: "90m", mins: 90 },
                          { label: "120m", mins: 120 },
                          { label: "180m", mins: 180 },
                        ].map((preset) => {
                          const isActive = formDurationInput === String(preset.mins);
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleDurationPreset(preset.mins)}
                              className={clsx(
                                "py-0.5 px-1 rounded-md text-[11px] font-bold border transition-all text-center cursor-pointer",
                                isActive
                                  ? "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20"
                                  : "bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/70"
                              )}
                            >
                              <div>{preset.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FIXED MODAL FOOTER */}
            <div className="flex items-center justify-between border-t border-slate-800 p-3 sm:px-6 shrink-0 bg-slate-900/95">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Scheduled: <strong className="text-white">{startHour}:{startMinute} {startPeriod} → {endHour}:{endMinute} {endPeriod}</strong>
              </span>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-1.5 px-4 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Time Block
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
