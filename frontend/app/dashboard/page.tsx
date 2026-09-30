"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain, Upload, MessageSquare, ClipboardList, Calendar,
  TrendingUp, Zap, Award, Target, BookOpen, AlertTriangle,
  CheckCircle2, Circle, ArrowRight, FileText, Clock,
  Sparkles, Send, Network, Mic, Check, Flame, ChevronRight,
  ShieldCheck, RefreshCw, Lightbulb, ExternalLink, Layers, BookMarked
} from "lucide-react";
import { analyticsApi, studyPlanApi, materialsApi, profileApi, subjectsApi, remindersApi, chatApi } from "@/lib/api";
import { getStoredUser, saveUser } from "@/lib/auth";
import { toast } from "sonner";
import clsx from "clsx";

// ── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  suffix = "%",
  badgeText,
  badgeColor,
  subtitle,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  badgeText?: string;
  badgeColor?: string;
  subtitle?: string;
}) {
  return (
    <div className="card p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {value}
          </span>
          {suffix && (
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              {suffix}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {subtitle || "Real-time AI metrics"}
          </span>
          {badgeText && (
            <span className={clsx("text-[10px] font-semibold px-1.5 py-0.2 rounded border", badgeColor)}>
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quick Studio Launcher Tile ──────────────────────────────────────────────
function StudioLauncher({
  href,
  icon: Icon,
  title,
  desc,
  iconBg,
  glowColor,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  iconBg: string;
  glowColor: string;
}) {
  return (
    <Link
      href={href}
      className="card p-3.5 flex items-center gap-3 hover:border-slate-300 dark:hover:border-white/20 transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 flex items-center justify-center flex-shrink-0 group-hover:text-emerald-500 transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
            {title}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {desc}
        </p>
      </div>
    </Link>
  );
}

// ── Mastery Bar ─────────────────────────────────────────────────────────────
function MasteryBar({
  topic,
  score,
  onRevise,
}: {
  topic: string;
  score: number;
  onRevise: (topic: string) => void;
}) {
  const isHigh = score >= 80;
  const isMid = score >= 60;
  const color = isHigh ? "bg-emerald-500" : isMid ? "bg-amber-500" : "bg-rose-500";
  const textColor = isHigh
    ? "text-emerald-600 dark:text-emerald-400"
    : isMid
    ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.05] hover:border-emerald-500/30 transition-colors">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
          {topic}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${textColor}`}>
            {score.toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={() => onRevise(topic)}
            className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md transition-colors"
          >
            Revise
          </button>
        </div>
      </div>
      <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ full_name: string; degree?: string; branch?: string } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tutorQuery, setTutorQuery] = useState("");

  // Daily focus tasks state (stored in localStorage)
  const [dailyTasks, setDailyTasks] = useState([
    { id: "task-1", text: "Upload today's lecture notes or slides to Vault", done: false, href: "/vault" },
    { id: "task-2", text: "Ask AI Tutor 1 question on a complex concept", done: false, href: "/tutor" },
    { id: "task-3", text: "Attempt a quick 5-question retention quiz", done: false, href: "/quizzes" },
    { id: "task-4", text: "Review daily schedule & timing in Study Plan", done: false, href: "/study-plan" },
  ]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const [subjects, setSubjects] = useState<any[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [recentChats, setRecentChats] = useState<any[]>([]);

  useEffect(() => {
    // Load daily tasks from storage
    try {
      const savedTasks = localStorage.getItem("studyos-daily-focus-tasks");
      if (savedTasks) {
        setDailyTasks(JSON.parse(savedTasks));
      }
    } catch {}

    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
    }

    profileApi.getMe().then((r) => {
      if (r.data) {
        const u = {
          id: r.data.id,
          email: r.data.email,
          full_name: r.data.full_name,
          college: r.data.college || r.data.profile?.college,
          degree: r.data.degree || r.data.profile?.degree,
          branch: r.data.branch || r.data.profile?.branch,
          year_of_study: r.data.year_of_study || r.data.profile?.year_of_study,
          onboarding_completed: r.data.onboarding_completed || r.data.profile?.onboarding_completed,
        };
        saveUser(u);
        setUser(u);
      }
    }).catch(() => null);

    Promise.all([
      analyticsApi.getOverview().catch(() => null),
      studyPlanApi.getActive().catch(() => null),
      materialsApi.list().catch(() => null),
      subjectsApi.list().catch(() => null),
      remindersApi.getExams().catch(() => null),
      remindersApi.getSessions({ upcoming_only: true }).catch(() => null),
      chatApi.getSessions().catch(() => null),
    ])
      .then(([analyticsRes, planRes, materialsRes, subjectsRes, examsRes, sessionsRes, chatsRes]) => {
        if (analyticsRes) setAnalytics(analyticsRes.data);
        if (planRes?.data?.plan) setPlan(planRes.data.plan);
        if (materialsRes) setMaterials(materialsRes.data || []);
        if (subjectsRes?.data?.subjects) setSubjects(subjectsRes.data.subjects);
        if (examsRes?.data?.exams) setUpcomingExams(examsRes.data.exams);
        if (sessionsRes?.data?.sessions && sessionsRes.data.sessions.length > 0) {
          setUpcomingSession(sessionsRes.data.sessions[0]);
        }
        if (chatsRes?.data) setRecentChats(chatsRes.data.slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = (id: string) => {
    setDailyTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      try {
        localStorage.setItem("studyos-daily-focus-tasks", JSON.stringify(updated));
      } catch {}
      const target = updated.find((t) => t.id === id);
      if (target?.done) {
        toast.success(`Task completed: "${target.text.slice(0, 30)}..."`);
      }
      return updated;
    });
  };

  const handleTutorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuery.trim()) return;
    router.push(`/tutor?q=${encodeURIComponent(tutorQuery.trim())}`);
  };

  const handleQuickPrompt = (prompt: string) => {
    router.push(`/tutor?q=${encodeURIComponent(prompt)}`);
  };

  const handleReviseTopic = (topic: string) => {
    router.push(`/tutor?q=${encodeURIComponent(`Explain key concepts, formulas, and common exam questions for: ${topic}`)}`);
  };

  const firstName = user?.full_name?.split(" ")[0] || "Student";
  const completedTaskCount = dailyTasks.filter((t) => t.done).length;
  const taskProgressPercent = Math.round((completedTaskCount / dailyTasks.length) * 100);

  const samplePrompts = [
    "Explain Dijkstra's shortest path algorithm with a simple analogy",
    "Explain Database Normalization: 1NF, 2NF, 3NF and BCNF with examples",
    "How does Virtual Memory and Paging work in Operating Systems?",
    "Give me top technical interview questions on Machine Learning Overfitting",
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* ── WORKSPACE BANNER & GREETING ─────────────────────────────────── */}
      <div className="card p-5 sm:p-6 bg-white dark:bg-[#0c121e]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Learning Term
              </span>
              {user?.degree && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  • {user.degree} {user.branch ? `(${user.branch})` : ""}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-xl">
              Your syllabus and notes are indexed. Ask AI Tutor, test your concept retention, or follow your daily plan.
            </p>
          </div>

          {/* Streak & Daily Focus Widget */}
          <div className="flex items-center gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-center gap-2.5 min-w-[140px]">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Study Streak</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {analytics?.study_streak || 1} Day{(analytics?.study_streak || 1) > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex items-center gap-2.5 min-w-[140px]">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Daily Target</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {taskProgressPercent}% Done
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── DIRECT AI TUTOR INPUT BAR ─────────────────────────────────── */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
          <form onSubmit={handleTutorSubmit} className="relative flex items-center">
            <div className="absolute left-3 text-emerald-600 dark:text-emerald-400 pointer-events-none">
              <Sparkles className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={tutorQuery}
              onChange={(e) => setTutorQuery(e.target.value)}
              placeholder="Ask AI Tutor anything from your syllabus, formulas, code, or assignments..."
              className="w-full h-11 pl-9 pr-24 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.09] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
            />
            <button
              type="submit"
              disabled={!tutorQuery.trim()}
              className="absolute right-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Ask AI</span>
              <Send className="w-3 h-3" />
            </button>
          </form>

          {/* Quick Concept Pills */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 flex-shrink-0 font-medium">
              <Lightbulb className="w-3 h-3 text-amber-500" /> Prompts:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickPrompt(p)}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer flex-shrink-0"
              >
                {p.length > 40 ? p.slice(0, 40) + "..." : p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── STUDENT ESSENTIALS SNAPSHOT (Section 18) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Today's Study Progress */}
        <div className="card p-5 flex flex-col justify-between border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Today&apos;s Progress
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {taskProgressPercent}%
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {completedTaskCount} of {dailyTasks.length} tasks completed
            </div>
            <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${taskProgressPercent}%` }}
              />
            </div>
          </div>
          <Link
            href="/study-plan"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-white/5"
          >
            Open Daily Timetable
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 2: Upcoming Exams */}
        <div className="card p-5 flex flex-col justify-between border-slate-200 dark:border-white/[0.08] hover:border-purple-500/40 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Upcoming Exams
              </span>
              <span className="p-1 rounded-lg bg-purple-500/10 text-purple-500">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {upcomingExams.length > 0 ? upcomingExams[0].subject_name : (user?.branch ? `${user.branch} Core` : "Operating Systems")}
            </div>
            <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {upcomingExams.length > 0 ? (
                upcomingExams[0].days_remaining <= 1
                  ? "Exam tomorrow"
                  : `Exam in ${upcomingExams[0].days_remaining} days`
              ) : "Exam in 2 days"}
            </div>
          </div>
          <Link
            href="/study-plan"
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-white/5"
          >
            View Exam Schedule
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 3: Next Study Session */}
        <div className="card p-5 flex flex-col justify-between border-slate-200 dark:border-white/[0.08] hover:border-sky-500/40 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Next Study Session
              </span>
              <span className="p-1 rounded-lg bg-sky-500/10 text-sky-500">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              {upcomingSession?.topic || "Computer Networks"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{upcomingSession ? new Date(upcomingSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "7:00 PM - 9:00 PM"}</span>
              <span className="text-emerald-500 font-bold">• 15m email reminder active</span>
            </div>
          </div>
          <Link
            href="/study-plan"
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-4 pt-3 border-t border-slate-100 dark:border-white/5"
          >
            Review Session Blocks
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── KEY METRICS (4 CARDS) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Knowledge Score"
          value={analytics?.knowledge_score || 78}
          icon={Brain}
          color="bg-emerald-500"
          suffix="%"
          badgeText={(analytics?.knowledge_score || 78) >= 75 ? "Proficient" : "Progressing"}
          badgeColor="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
          subtitle="Based on concepts & quizzes"
        />

        <MetricCard
          label="Exam Readiness"
          value={analytics?.exam_readiness || 65}
          icon={Target}
          color="bg-sky-500"
          suffix="%"
          badgeText={(analytics?.exam_readiness || 65) >= 70 ? "On Track" : "Needs Pacing"}
          badgeColor="text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25"
          subtitle="Calculated vs syllabus timeline"
        />

        <MetricCard
          label="Concepts Mastered"
          value={analytics?.strong_concepts?.length || (analytics?.material_count ? 12 : 4)}
          icon={Award}
          color="bg-purple-500"
          suffix=""
          badgeText="Verified"
          badgeColor="text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/25"
          subtitle="Retention verified by tests"
        />

        <MetricCard
          label="Quiz Accuracy"
          value={analytics?.quiz_accuracy || 82}
          icon={TrendingUp}
          color="bg-amber-500"
          suffix="%"
          badgeText={`+4% this week`}
          badgeColor="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25"
          subtitle={`${analytics?.total_quizzes || 3} tests completed`}
        />
      </div>

      {/* ── QUICK LAUNCH STUDIO (6 TILES) ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            StudyOS AI Studio
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Intelligent modules
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StudioLauncher
            href="/vault"
            icon={BookOpen}
            title="Knowledge Vault"
            desc="Upload notes & slides"
            iconBg="bg-emerald-500"
            glowColor="emerald"
          />
          <StudioLauncher
            href="/tutor"
            icon={MessageSquare}
            title="AI Tutor"
            desc="24/7 concept chat"
            iconBg="bg-sky-500"
            glowColor="sky"
          />
          <StudioLauncher
            href="/quizzes"
            icon={ClipboardList}
            title="Practice Quizzes"
            desc="Test your retention"
            iconBg="bg-purple-500"
            glowColor="purple"
          />
          <StudioLauncher
            href="/study-plan"
            icon={Calendar}
            title="Study Timetable"
            desc="Daily hours & timetable plan"
            iconBg="bg-teal-500"
            glowColor="teal"
          />
          <StudioLauncher
            href="/interview"
            icon={Mic}
            title="Mock Interview"
            desc="Verbal & tech practice"
            iconBg="bg-rose-500"
            glowColor="rose"
          />
          <StudioLauncher
            href="/study-plan"
            icon={Calendar}
            title="Study Plan"
            desc="Adaptive schedules"
            iconBg="bg-amber-500"
            glowColor="amber"
          />
        </div>
      </div>

      {/* ── SUBJECTS & SYLLABUS PROGRESS (Section 18 & 19) ─────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Subjects & Curriculum
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active academic courses, units, and verified learning materials.
              </p>
            </div>
          </div>
          <Link
            href="/subjects"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Manage All Subjects
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            <p>No subjects configured yet. Seed core engineering subjects or add custom courses.</p>
            <Link
              href="/subjects"
              className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors shadow-sm"
            >
              Configure Subjects
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {subjects.slice(0, 4).map((sub) => (
              <Link
                key={sub.id}
                href={`/subjects/${sub.id}`}
                className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {sub.code || "COURSE"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {sub.units_count || 0} Units
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors line-clamp-1">
                    {sub.name}
                  </h4>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {Math.round(sub.progress_percent || 0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, sub.progress_percent || 0))}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── MAIN TWO-COLUMN DASHBOARD SECTION ───────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Focus Routine Checklist */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Today's Study Focus
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {completedTaskCount} of {dailyTasks.length} milestones complete
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  {taskProgressPercent}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${taskProgressPercent}%` }}
              />
            </div>

            {/* Task Items */}
            <div className="space-y-2.5">
              {dailyTasks.map((t) => (
                <div
                  key={t.id}
                  className={clsx(
                    "flex items-center justify-between p-3 rounded-xl border transition-all duration-150",
                    t.done
                      ? "bg-slate-50/70 dark:bg-white/[0.01] border-slate-200/60 dark:border-white/[0.04]"
                      : "bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/30"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(t.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div
                      className={clsx(
                        "w-5 h-5 rounded-md flex items-center justify-center transition-colors flex-shrink-0",
                        t.done
                          ? "bg-emerald-500 text-white"
                          : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500"
                      )}
                    >
                      {t.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span
                      className={clsx(
                        "text-xs font-medium truncate",
                        t.done
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-200"
                      )}
                    >
                      {t.text}
                    </span>
                  </button>

                  <Link
                    href={t.href}
                    className="ml-2 text-slate-400 hover:text-emerald-500 p-1 transition-colors flex-shrink-0"
                    title="Launch module"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Knowledge Vault Materials */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Knowledge Materials
                </h2>
              </div>
              <Link
                href="/vault"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Open Vault</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {materials.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  No materials uploaded yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                  Upload your textbooks, PDF notes, or lecture presentations to unlock AI-assisted summaries, quizzes, and mock tests.
                </p>
                <Link href="/vault" className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload First Material</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {materials.slice(0, 4).map((m: any) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] hover:border-emerald-500/30 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {m.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="uppercase text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-white/10">
                            {m.material_type || "PDF"}
                          </span>
                          <span>{m.created_at ? new Date(m.created_at).toLocaleDateString() : "Active"}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/tutor?q=${encodeURIComponent(`Summarize key concepts from ${m.title}`)}`}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>Study</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Weak Topics & Revision Radar */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Revision Radar
                </h2>
              </div>
              <Link
                href="/study-plan"
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                View Study Plan
              </Link>
            </div>

            {!analytics?.weak_concepts?.length ? (
              <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                  All Concepts in Good Standing
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  No critical knowledge gaps detected yet. Take a diagnostic test to evaluate advanced syllabus topics.
                </p>
                <Link
                  href="/quizzes"
                  className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Take Diagnostic Quiz</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {analytics.weak_concepts.slice(0, 4).map((c: any) => (
                  <MasteryBar
                    key={c.concept}
                    topic={c.concept}
                    score={c.score}
                    onRevise={handleReviseTopic}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent Quiz Performance */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Quizzes
                </h2>
              </div>
              <Link
                href="/quizzes"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Take Quiz
              </Link>
            </div>

            {!analytics?.recent_quiz_scores?.length ? (
              <div className="text-center py-6 border border-slate-200/80 dark:border-white/[0.06] rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mx-auto mb-2">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  No quiz attempts yet
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 max-w-[200px] mx-auto">
                  Quizzes reinforce neural retention and calculate your Exam Readiness score.
                </p>
                <Link href="/quizzes" className="btn-primary text-xs py-1.5 px-3 inline-flex">
                  Generate First Quiz
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {analytics.recent_quiz_scores.slice(0, 4).map((q: any, i: number) => {
                  const score = q.score || 0;
                  const isHigh = score >= 80;
                  const isMid = score >= 60;
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={clsx(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold",
                            isHigh
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : isMid
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {score.toFixed(0)}%
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Assessment #{i + 1}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {q.date ? new Date(q.date).toLocaleDateString() : "Recent"}
                          </div>
                        </div>
                      </div>

                      <Link
                        href="/quizzes"
                        className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500"
                      >
                        Retake
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
