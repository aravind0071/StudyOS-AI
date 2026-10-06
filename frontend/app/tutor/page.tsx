"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare, Brain, FileText, Video, Loader2,
  Sparkles, ChevronDown, BookOpen, ExternalLink, Info,
  Plus, Mic, MicOff, ArrowUp, CheckCircle2,
  GraduationCap, Award, Lightbulb, HelpCircle as QuizIcon,
  Trash2, PanelLeftClose, PanelLeft, Clock, RefreshCw,
  ClipboardList, Network, Database, Cpu, Binary,
  Layers, ArrowRight, Search, Bookmark, Zap,
  Volume2, Pause, AlertTriangle
} from "lucide-react";
import { chatApi, materialsApi, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import clsx from "clsx";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

// ── ACADEMIC CONFIGURATION & DOMAIN DATA ────────────────────────────────────────

const SUBJECT_DOMAINS = [
  { id: "all", label: "All Subjects", icon: Sparkles },
  { id: "networks", label: "Computer Networks", icon: Network },
  { id: "dbms", label: "DBMS & Architecture", icon: Database },
  { id: "os", label: "Operating Systems", icon: Cpu },
  { id: "algorithms", label: "Algorithms & DS", icon: Binary },
];

const EXPLAIN_LEVELS = [
  { id: "beginner", label: "Beginner Intuition", desc: "Simple analogies, everyday mental models & zero jargon" },
  { id: "btech_student", label: "B.Tech Student", desc: "Engineering depth, technical terminology, formulas & code" },
  { id: "exam", label: "University Exam (10 Marks)", desc: "Strict university rubric with diagrams, worked steps & proofs" },
  { id: "interview", label: "Tech Interview / Viva", desc: "Trade-offs, time/space complexity & architectural edge cases" },
];

const EXAM_MARKS = [
  { marks: 2, label: "2 Marks", hint: "Direct definition + 1-line formula for viva", prefix: "Explain for 2 marks: " },
  { marks: 5, label: "5 Marks", hint: "Analogy + 4-step mechanism & diagram breakdown", prefix: "Explain simply for 5 marks: " },
  { marks: 10, label: "10 Marks", hint: "Comprehensive university answer with worked numerical problem", prefix: "Provide a comprehensive 10 marks university exam answer with numerical problem solving for: " },
];

const QUICK_ACTIONS = [
  { label: "Explain simply", prefix: "Explain simply for 5 marks with intuitive real-world analogies: ", icon: Sparkles, color: "text-emerald-500" },
  { label: "2 Marks viva note", prefix: "Give a 2 marks exam answer with formula and key definition for: ", icon: Award, color: "text-amber-500" },
  { label: "5 Marks numerical", prefix: "Solve a worked numerical problem with step-by-step calculations for 5 marks: ", icon: Binary, color: "text-teal-500" },
  { label: "10 Marks master answer", prefix: "Provide a comprehensive 10 marks university exam breakdown with a worked-out problem for: ", icon: GraduationCap, color: "text-purple-500" },
  { label: "Make 3 quiz questions", prefix: "Generate 3 university-standard quiz questions with detailed solutions on: ", icon: QuizIcon, color: "text-cyan-500" },
  { label: "Real-world analogy", prefix: "Give a memorable real-world analogy and industry engineering application for: ", icon: Lightbulb, color: "text-yellow-500" },
  { label: "Step-by-step solver", prefix: "Break this down into exact mathematical/engineering steps with all formulas: ", icon: Layers, color: "text-blue-500" },
];

const ALL_PREFIX_STRINGS = [
  ...EXAM_MARKS.map(m => m.prefix.trim()),
  ...QUICK_ACTIONS.map(q => q.prefix.trim()),
];

const PREFIX_REGEX = /^(?:Explain\s+(?:simply\s+)?for\s+\d+\s*marks?|Provide\s+a\s+comprehensive\s+\d+\s*marks?[^:]*|Give\s+a\s+\d+\s*marks?[^:]*|Solve\s+a\s+worked\s+numerical[^:]*|Generate\s+\d+\s+university-standard[^:]*|Give\s+a\s+memorable\s+real-world[^:]*|Break\s+this\s+down[^:]*):\s*/i;

function stripKnownPrefixes(text: string): string {
  let cleaned = (text || "").trim();
  let changed = true;
  while (changed && cleaned.length > 0) {
    changed = false;
    // 1. Try regex pattern for mark/prompt prefixes
    const match = cleaned.match(PREFIX_REGEX);
    if (match) {
      cleaned = cleaned.slice(match[0].length).trim();
      changed = true;
      continue;
    }
    // 2. Try known exact prefixes
    for (const prefix of ALL_PREFIX_STRINGS) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.slice(prefix.length).trim();
        if (cleaned.startsWith(":")) {
          cleaned = cleaned.slice(1).trim();
        }
        changed = true;
        break;
      }
    }
  }
  return cleaned;
}

const CURATED_PROMPTS_BY_SUBJECT: Record<string, Array<{
  category: string;
  icon: React.ElementType;
  badge: string;
  q: string;
  desc: string;
  iconBg: string;
}>> = {
  all: [
    {
      category: "Computer Networks",
      icon: Network,
      badge: "5 Marks · Worked Numerical",
      q: "Explain Checksum algorithm with a worked 16-bit binary problem for 5 marks",
      desc: "Step-by-step binary sum, 1's complement, & verification check",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
    {
      category: "Database Systems",
      icon: Database,
      badge: "10 Marks · University Rubric",
      q: "Compare 1NF, 2NF, 3NF and BCNF with functional dependency anomalies for 10 marks",
      desc: "Complete exam format with insertion, deletion, & update anomalies",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
    {
      category: "Operating Systems",
      icon: Cpu,
      badge: "5 Marks · Step-by-Step",
      q: "How does Banker's Deadlock Avoidance algorithm work? 5 marks breakdown",
      desc: "Available, Allocation, Max, and Need matrices with safety state trace",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
    {
      category: "Algorithms & DS",
      icon: Binary,
      badge: "10 Marks · Master Trace",
      q: "Explain Dijkstra's shortest path algorithm with a worked graph trace for 10 marks",
      desc: "Vertex relaxation table, greedy choice proof, and time complexity",
      iconBg: "bg-cyan-500/10 text-cyan-500",
    },
  ],
  networks: [
    {
      category: "Computer Networks",
      icon: Network,
      badge: "5 Marks · Numerical",
      q: "Explain Checksum calculation with a 16-bit worked numerical problem",
      desc: "Carry wraparound, 1's complement, and receiver verification",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
    {
      category: "Computer Networks",
      icon: Network,
      badge: "10 Marks · CRC Polynomial",
      q: "Solve CRC error detection with Generator Polynomial G(x) = x³ + x + 1 for 10 marks",
      desc: "Modulo-2 binary division, transmitted codeword, & error syndrome check",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
    {
      category: "Computer Networks",
      icon: Network,
      badge: "5 Marks · Protocol",
      q: "Compare TCP 3-Way Handshake vs UDP connectionless transport for 5 marks",
      desc: "SYN, SYN-ACK, ACK packet exchange sequence and reliability tradeoffs",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
    {
      category: "Computer Networks",
      icon: Network,
      badge: "2 Marks · Viva",
      q: "Define Subnet Mask and CIDR notation (/24 vs /28) for 2 marks viva",
      desc: "Network bits vs host bits calculation formula",
      iconBg: "bg-emerald-500/10 text-emerald-500",
    },
  ],
  dbms: [
    {
      category: "Database Systems",
      icon: Database,
      badge: "10 Marks · Normalization",
      q: "Explain Normalization from 1NF to BCNF with real table decomposition for 10 marks",
      desc: "Covers lossy vs lossless join property and dependency preservation",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
    {
      category: "Database Systems",
      icon: Database,
      badge: "5 Marks · Concurrency",
      q: "Explain Two-Phase Locking (2PL) and how it guarantees Conflict Serializability",
      desc: "Growing phase vs shrinking phase with lock release rules",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
    {
      category: "Database Systems",
      icon: Database,
      badge: "10 Marks · ACID Properties",
      q: "Explain ACID properties in DBMS with WAL (Write-Ahead Logging) for 10 marks",
      desc: "Atomicity, Consistency, Isolation levels, Durability checkpointing",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
    {
      category: "Database Systems",
      icon: Database,
      badge: "2 Marks · Viva",
      q: "State the difference between Primary Key, Candidate Key, and Super Key for 2 marks",
      desc: "Formal mathematical definitions with minimal super key proof",
      iconBg: "bg-purple-500/10 text-purple-500",
    },
  ],
  os: [
    {
      category: "Operating Systems",
      icon: Cpu,
      badge: "10 Marks · Scheduling",
      q: "Compare Round Robin vs SJF Scheduling with Gantt Chart and Turnaround Time for 10 marks",
      desc: "Calculates Average Waiting Time (AWT) and Turnaround Time (ATT)",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
    {
      category: "Operating Systems",
      icon: Cpu,
      badge: "5 Marks · Deadlock",
      q: "Solve Banker's Algorithm with Allocation, Max, and Available vectors for 5 marks",
      desc: "Need matrix computation, safety state sequence, and resource request algorithm",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
    {
      category: "Operating Systems",
      icon: Cpu,
      badge: "10 Marks · Memory Management",
      q: "Explain Paging vs Segmentation and Virtual Memory Page Replacement (LRU vs FIFO) for 10 marks",
      desc: "Page table translation, TLB hits/misses, and Belady's anomaly",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
    {
      category: "Operating Systems",
      icon: Cpu,
      badge: "2 Marks · Viva",
      q: "What is a Race Condition and Critical Section Problem? Define for 2 marks",
      desc: "Mutual exclusion, progress, and bounded waiting requirements",
      iconBg: "bg-amber-500/10 text-amber-500",
    },
  ],
  algorithms: [
    {
      category: "Algorithms & DS",
      icon: Binary,
      badge: "10 Marks · Graph",
      q: "Explain Dijkstra's single-source shortest path algorithm with worked graph trace for 10 marks",
      desc: "Relaxation invariant, priority queue implementation, and negative edge limitations",
      iconBg: "bg-cyan-500/10 text-cyan-500",
    },
    {
      category: "Algorithms & DS",
      icon: Binary,
      badge: "10 Marks · Dynamic Programming",
      q: "Solve 0/1 Knapsack Problem using Dynamic Programming with table trace for 10 marks",
      desc: "Recurrence relation DP[i][w], optimal substructure, and backtracking items",
      iconBg: "bg-cyan-500/10 text-cyan-500",
    },
    {
      category: "Algorithms & DS",
      icon: Binary,
      badge: "5 Marks · Trees",
      q: "Explain AVL Tree rotations (LL, RR, LR, RL) with balance factor worked example for 5 marks",
      desc: "Height rebalancing proofs and O(log n) insertion guarantee",
      iconBg: "bg-cyan-500/10 text-cyan-500",
    },
    {
      category: "Algorithms & DS",
      icon: Binary,
      badge: "2 Marks · Viva",
      q: "State Master Theorem with 3 cases and solve T(n) = 2T(n/2) + O(n) for 2 marks",
      desc: "Direct polynomial comparisons and asymptotic bounds",
      iconBg: "bg-cyan-500/10 text-cyan-500",
    },
  ],
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  used_external?: boolean;
  explain_level?: string;
  source_type?: string;
  source_label?: string;
  source_detail?: string;
}

interface ChatSessionItem {
  id: string;
  title: string;
  created_at?: string;
}

function SourceCard({ source }: { source: any }) {
  const icons: Record<string, React.ElementType> = {
    pdf: FileText,
    docx: FileText,
    pptx: FileText,
    youtube: Video,
    audio: BookOpen,
    website: ExternalLink,
  };
  const Icon = icons[source.material_type] || FileText;

  const handleClick = () => {
    toast.info(`Source: "${source.material_title}"${source.page_number ? ` (Page ${source.page_number})` : ""}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 dark:bg-[#1a2336] hover:bg-slate-200 dark:hover:bg-[#22304a] rounded-xl border border-slate-300/60 dark:border-white/[0.08] transition-all text-left group shadow-xs hover:border-emerald-500/40"
    >
      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <Icon className="w-3 h-3" />
      </div>
      <div className="min-w-0 max-w-[220px]">
        <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
          {source.material_title}
        </div>
        <div className="text-[9.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          {source.page_number && source.page_number > 0 ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Page {source.page_number}</span>
          ) : source.timestamp_start !== undefined && source.timestamp_start !== null ? (
            <span>
              {Math.floor(source.timestamp_start / 60)}:
              {String(Math.round(source.timestamp_start % 60)).padStart(2, "0")}
            </span>
          ) : (
            <span>Course Section</span>
          )}
        </div>
      </div>
    </button>
  );
}

function AssistantMessage({
  msg,
  onFollowUp,
  onPlaySpeech,
  isSpeakingThis,
  onStopSpeech,
  onRegenerate,
}: {
  msg: Message;
  onFollowUp: (prompt: string) => void;
  onPlaySpeech: (text: string, msgId: string) => void;
  isSpeakingThis: boolean;
  onStopSpeech: () => void;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    toast.success("Answer copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToNotes = () => {
    navigator.clipboard.writeText(msg.content);
    toast.success("Copied to clipboard! Ready to paste into Study Notes.");
  };

  return (
    <div className="flex gap-3 animate-fadeIn">
      {/* Assistant Avatar */}
      <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-white">
        <Brain className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 w-full min-w-0 space-y-2">
        {/* Main Assistant Card */}
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.08] shadow-xs w-full">
          {/* Card Header with Level, Grounding & TTS Audio Lecture */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/70 dark:border-white/[0.06] gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white">StudyOS Intelligence</span>
              {msg.explain_level && (
                <span className="badge badge-green text-[9.5px] py-0.5 px-2">
                  {msg.explain_level.replace("_", " ")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Audio Listen Button */}
              {isSpeakingThis ? (
                <button
                  type="button"
                  onClick={onStopSpeech}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-medium shadow-xs"
                  title="Pause Audio Lecture"
                >
                  <Pause className="w-2.5 h-2.5" />
                  <span>Playing audio</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPlaySpeech(msg.content, msg.id)}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-500 text-slate-600 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-white/[0.08] transition-colors"
                  title="Listen to explanation"
                >
                  <Volume2 className="w-3 h-3 text-emerald-500" />
                  <span className="hidden sm:inline">Listen</span>
                </button>
              )}

              {msg.used_external ? (
                <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Not in Uploaded Notes · Curriculum Answer
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Grounded in Uploaded Materials
                </span>
              )}
            </div>
          </div>

          {/* Formatted Markdown Content */}
          <div className="pt-0.5">
            {msg.content ? (
              <MarkdownRenderer content={msg.content} />
            ) : (
              <div className="flex items-center gap-2 py-3 px-1 text-slate-500 dark:text-slate-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="animate-pulse">Synthesizing verified academic answer...</span>
              </div>
            )}
          </div>

          {/* Action Toolbar: Copy, Regenerate, Thumbs, Quick Follow-ups */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200/60 dark:border-white/[0.06] text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardList className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium">{copied ? "Copied" : "Copy"}</span>
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Regenerate this answer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] font-medium hidden sm:inline">Regenerate</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveToNotes}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Save this answer to study notes"
              >
                <Bookmark className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-[11px] font-medium hidden sm:inline">Save</span>
              </button>

              <div className="h-3 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

              <button
                type="button"
                onClick={() => {
                  setRating(rating === "up" ? null : "up");
                  toast.success("Thank you for your feedback!");
                }}
                className={clsx(
                  "p-1 rounded-lg transition-colors",
                  rating === "up" ? "text-emerald-500 bg-emerald-500/10" : "hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                )}
                title="Helpful explanation"
              >
                👍
              </button>

              <button
                type="button"
                onClick={() => {
                  setRating(rating === "down" ? null : "down");
                  toast.info("Feedback recorded. Refining the model depth.");
                }}
                className={clsx(
                  "p-1 rounded-lg transition-colors",
                  rating === "down" ? "text-rose-500 bg-rose-500/10" : "hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                )}
                title="Not helpful"
              >
                👎
              </button>
            </div>

            {/* Quick Next-Step Followup Suggestions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onFollowUp("Generate a 3-question university practice quiz based on this explanation with answers")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold transition-colors border border-emerald-500/20"
                title="Generate practice quiz questions on this topic"
              >
                <QuizIcon className="w-3 h-3" />
                <span>Quiz Me</span>
              </button>

              <button
                type="button"
                onClick={() => onFollowUp("Expand this explanation into a full 10-marks university exam answer with numerical examples and rubrics")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-semibold transition-colors border border-purple-500/20"
                title="Expand to comprehensive 10-mark university answer"
              >
                <GraduationCap className="w-3 h-3" />
                <span>10-Mark Expansion</span>
              </button>
            </div>
          </div>
        </div>

        {/* Source Attribution Section Below Every Answer */}
        {msg.sources && msg.sources.length > 0 ? (
          <div className="p-2.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              <span>Source: <strong>Uploaded Notes</strong> (From your course materials)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {msg.sources.map((s, i) => (
                <SourceCard key={i} source={s} />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-slate-50 dark:bg-[#121927] rounded-xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                  Source: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{msg.source_label || "Standard University Curriculum"}</span>
                </div>
                <div className="text-[9.5px] text-slate-500 dark:text-slate-400">
                  High-scoring semester exam answer synthesized for full marks
                </div>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
              Academic Knowledge
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; lastPrompt: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [explainLevel, setExplainLevel] = useState("btech_student");
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [selectedMarkDepth, setSelectedMarkDepth] = useState<number | null>(null);
  const [studyMode, setStudyMode] = useState<"learn" | "exam" | "quiz" | "interview" | "revision" | "summary">("learn");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [materialsCount, setMaterialsCount] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Audio Lecture Speech Synthesis (TTS)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Battle-tested auto-resizing textarea line-after-line like ChatGPT
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;
    const minH = 28;
    const maxH = 260;
    const targetH = Math.max(minH, Math.min(scrollHeight, maxH));
    el.style.height = `${targetH}px`;
    el.style.overflowY = scrollHeight > maxH ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    toast.info("AI response generation stopped.");
  };

  // Web Speech Synthesis (TTS Audio Overview)
  const playSpeech = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/[#*_`$]/g, "")
      .slice(0, 1200);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      setSpeakingMsgId(msgId);
      toast.info("Playing audio explanation...");
    };
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    }
  };

  // Load chat sessions list from backend
  const loadSessions = useCallback(async () => {
    try {
      const { data } = await chatApi.getSessions();
      setSessions(data || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  // Load vault materials count to display live RAG status
  const loadMaterialsCount = useCallback(async () => {
    try {
      const { data } = await materialsApi.list();
      setMaterialsCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setMaterialsCount(0);
    }
  }, []);

  // Load history for a given session
  const selectSession = async (id: string) => {
    try {
      setLoading(true);
      const { data } = await chatApi.getHistory(id);
      const msgs: Message[] = (data || []).map((m: any) => {
        let source_label = undefined;
        let source_detail = undefined;
        if (m.sources && m.sources.length > 0) {
          source_label = "Uploaded Notes";
        } else if (m.content) {
          const match = m.content.match(/📌\s*\*\*Source:\*\*\s*\*\*([^*]+)\*\*(.*)/);
          if (match) {
            source_label = match[1].trim();
            source_detail = match[2].trim();
          }
        }
        return {
          id: m.id || Date.now().toString(),
          role: m.role,
          content: m.content,
          sources: m.sources,
          explain_level: m.explain_level,
          used_external: !m.sources || m.sources.length === 0,
          source_label: source_label || (!m.sources || m.sources.length === 0 ? "Standard University Curriculum" : "Uploaded Notes"),
          source_detail: source_detail,
        };
      });
      setSessionId(id);
      setMessages(msgs);
      if (typeof window !== "undefined") {
        localStorage.setItem("studyos_active_chat_session_id", id);
      }
    } catch (err) {
      toast.error("Failed to load conversation history.");
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    stopSpeech();
    setSessionId(undefined);
    setMessages([]);
    setSelectedMarkDepth(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("studyos_active_chat_session_id");
    }
    textareaRef.current?.focus();
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await chatApi.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (sessionId === id) {
        startNewChat();
      }
      toast.success("Chat deleted.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Initial load
  useEffect(() => {
    loadSessions();
    loadMaterialsCount();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get("q");
      const sub = urlParams.get("subject");
      const mode = urlParams.get("mode");
      const marks = urlParams.get("marks");

      if (sub) setSelectedSubject(sub);
      if (mode && ["learn", "exam", "quiz", "interview", "revision", "summary"].includes(mode)) {
        setStudyMode(mode as any);
      }
      if (marks) {
        setSelectedMarkDepth(parseInt(marks, 10));
      }

      if (q) {
        setInput(q);
        setTimeout(() => textareaRef.current?.focus(), 150);
      } else {
        const savedSession = localStorage.getItem("studyos_active_chat_session_id");
        if (savedSession) {
          selectSession(savedSession);
        }
      }
    }

    return () => {
      stopSpeech();
    };
  }, [loadSessions, loadMaterialsCount]);

  // Voice dictation using Web Speech API
  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening... Speak clearly.");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== "no-speech") {
          toast.error(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
      toast.error("Unable to start microphone.");
    }
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.label.includes("2 Marks")) {
      setSelectedMarkDepth(2);
    } else if (action.label.includes("5 Marks")) {
      setSelectedMarkDepth(5);
    } else if (action.label.includes("10 Marks")) {
      setSelectedMarkDepth(10);
    }

    const cleaned = stripKnownPrefixes(input);
    const nextVal = cleaned ? `${action.prefix}${cleaned}` : action.prefix;
    setInput(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleExamMarkPick = (em: typeof EXAM_MARKS[0]) => {
    // If user clicks the currently active mark pill, toggle it OFF cleanly
    if (selectedMarkDepth === em.marks) {
      setSelectedMarkDepth(null);
      const cleaned = stripKnownPrefixes(input);
      setInput(cleaned);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 0);
      return;
    }

    // Switch to selected mark depth and replace any previous mark prefix cleanly
    setSelectedMarkDepth(em.marks);
    const cleaned = stripKnownPrefixes(input);
    const nextVal = cleaned ? `${em.prefix}${cleaned}` : em.prefix;
    setInput(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      await materialsApi.upload(formData);
      toast.success(`${file.name} uploaded! Vault grounding updated.`, { id: toastId });
      loadMaterialsCount();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    setErrorState(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      explain_level: explainLevel,
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const tempId = (Date.now() + 1).toString();
    let currentAssistantId = tempId;

    try {
      // Add empty assistant placeholder message for real-time streaming
      const initialAssistantMsg: Message = {
        id: tempId,
        role: "assistant",
        content: "",
        sources: [],
        used_external: false,
        explain_level: explainLevel,
      };
      setMessages(prev => [...prev, initialAssistantMsg]);

      let streamedText = "";

      await chatApi.stream(
        {
          message: content,
          session_id: sessionId,
          explain_level: explainLevel,
          study_mode: studyMode,
          marks: selectedMarkDepth ? String(selectedMarkDepth) : undefined,
          subject: selectedSubject !== "all" ? selectedSubject : undefined,
        },
        (token) => {
          streamedText += token;
          setMessages(prev =>
            prev.map(m =>
              m.id === tempId || m.id === currentAssistantId
                ? { ...m, content: streamedText }
                : m
            )
          );
        },
        (meta) => {
          if (meta.session_id) {
            setSessionId(meta.session_id);
            if (typeof window !== "undefined") {
              localStorage.setItem("studyos_active_chat_session_id", meta.session_id);
            }
            loadSessions();
          }
          if (meta.message_id) {
            currentAssistantId = meta.message_id;
          }
          setMessages(prev =>
            prev.map(m =>
              m.id === tempId || m.id === currentAssistantId
                ? {
                    ...m,
                    id: currentAssistantId,
                    content: streamedText.length > 0 ? streamedText : m.content,
                    sources: meta.sources !== undefined ? meta.sources : m.sources,
                    source_type: meta.source_type !== undefined ? meta.source_type : m.source_type,
                    source_label: meta.source_label !== undefined ? meta.source_label : m.source_label,
                    source_detail: meta.source_detail !== undefined ? meta.source_detail : m.source_detail,
                    used_external:
                      meta.used_external_knowledge !== undefined
                        ? meta.used_external_knowledge
                        : m.used_external,
                  }
                : m
            )
          );
        },
        controller.signal
      );

      // Lock in final streamed content
      if (streamedText.length > 0) {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId || m.id === currentAssistantId
              ? { ...m, id: currentAssistantId, content: streamedText }
              : m
          )
        );
      } else {
        throw new Error("No response generated from stream");
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message === "canceled") {
        return;
      }
      // If streaming fails, fallback smoothly to standard send endpoint
      try {
        const { data } = await chatApi.send(
          content,
          sessionId,
          explainLevel,
          studyMode,
          selectedMarkDepth ? String(selectedMarkDepth) : undefined,
          selectedSubject !== "all" ? selectedSubject : undefined
        );
        if (data.session_id) {
          setSessionId(data.session_id);
          if (typeof window !== "undefined") {
            localStorage.setItem("studyos_active_chat_session_id", data.session_id);
          }
          loadSessions();
        }

        setMessages(prev =>
          prev.map(m =>
            m.id === tempId || m.id === currentAssistantId
              ? {
                  ...m,
                  id: data.message_id || currentAssistantId,
                  content: data.answer,
                  sources: data.sources,
                  source_type: data.source_type,
                  source_label: data.source_label,
                  source_detail: data.source_detail,
                  used_external: data.used_external_knowledge,
                  explain_level: data.explain_level || explainLevel,
                }
              : m
          )
        );
      } catch (fallbackErr: any) {
        setMessages(prev => prev.filter(m => (m.id !== tempId && m.id !== currentAssistantId) || m.content.length > 0));
        const errMsg = getErrorMessage(fallbackErr);
        toast.error(errMsg);
        setErrorState({ message: errMsg, lastPrompt: content });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = (assistantMsg: Message) => {
    if (loading) return;
    const idx = messages.findIndex(m => m.id === assistantMsg.id);
    if (idx >= 0) {
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          const userQuery = messages[i].content;
          setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
          sendMessage(userQuery);
          return;
        }
      }
    }
  };

  const activeLevel = EXPLAIN_LEVELS.find(l => l.id === explainLevel);

  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions;
    return sessions.filter(s =>
      s.title?.toLowerCase().includes(sessionSearch.toLowerCase())
    );
  }, [sessions, sessionSearch]);

  const activePrompts = CURATED_PROMPTS_BY_SUBJECT[selectedSubject] || CURATED_PROMPTS_BY_SUBJECT.all;

  return (
    <div className="flex h-full w-full max-w-full min-w-0 gap-2.5 sm:gap-3 overflow-hidden relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.mp3,.mp4"
        className="hidden"
      />

      {/* ── 1. CHAT HISTORY SIDEBAR ─────────────────────────────────── */}
      <aside
        className={clsx(
          "flex-col card overflow-hidden transition-all duration-300 z-20 flex-shrink-0 h-full",
          showSidebar
            ? "flex fixed inset-y-16 left-3 w-72 md:static md:w-56 lg:w-60 md:inset-auto shadow-2xl md:shadow-none"
            : "hidden md:flex md:w-56 lg:w-60"
        )}
      >
        <div className="p-3 border-b border-slate-200 dark:border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={startNewChat}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 btn-primary text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSidebar(false)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Filter conversations search input */}
          {sessions.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder="Filter chats..."
                className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-md font-semibold">
              {filteredSessions.length}
            </span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center text-slate-400">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">No chats found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Ask a question to start!</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[10.5px] text-slate-500 dark:text-slate-400 text-left mt-3">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mr-1">
                  <Lightbulb className="w-3 h-3 text-emerald-500" /> Exam Tip:
                </span>
                Ask for <strong>10 marks depth</strong> to receive complete worked numericals with rubric formatting.
              </div>
            </div>
          ) : (
            filteredSessions.map(s => {
              const isActive = sessionId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    selectSession(s.id);
                    if (window.innerWidth < 768) setShowSidebar(false);
                  }}
                  className={clsx(
                    "group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all",
                    isActive
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className={clsx("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500")} />
                    <span className="truncate text-[12px]">{s.title || "Untitled Session"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={e => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity rounded"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── 2. FULL-WIDTH SPACIOUS MAIN CHAT STUDIO ──────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full min-w-0 max-w-full card p-2.5 sm:p-4 overflow-hidden relative">
        {/* Studio Top Navigation Bar (Clean & Uncluttered) */}
        <div className="flex-shrink-0 flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-white/[0.08] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowSidebar(v => !v)}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Toggle Chat History"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <h1 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                    AI Tutor & Intelligence
                  </h1>
                  <span className="text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-Saved
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-2 truncate">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>
                    {materialsCount !== null && materialsCount > 0
                      ? `Knowledge Vault Active · ${materialsCount} course ${materialsCount === 1 ? "file" : "files"} indexed`
                      : "Knowledge Vault Ready · Upload course materials to ground answers"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Controls: Marks Pills + Depth Selector + Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Quick Marks Pills */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-white/[0.08]">
              {EXAM_MARKS.map(em => (
                <button
                  key={em.marks}
                  type="button"
                  onClick={() => handleExamMarkPick(em)}
                  className={clsx(
                    "text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-lg transition-all",
                    selectedMarkDepth === em.marks
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/10"
                  )}
                  title={em.hint}
                >
                  {em.label}
                </button>
              ))}
            </div>

            {/* Depth Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLevelPicker(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-white/[0.12] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">{activeLevel?.label}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showLevelPicker && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-xl z-30 overflow-hidden py-1 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/[0.06]">
                    Academic Reasoning Depth
                  </div>
                  {EXPLAIN_LEVELS.map(level => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => {
                        setExplainLevel(level.id);
                        setShowLevelPicker(false);
                        toast.success(`Set to ${level.label} mode.`);
                      }}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs transition-colors",
                        explainLevel === level.id
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{level.label}</span>
                        {explainLevel === level.id && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <div className="text-[9.5px] text-slate-500 font-normal mt-0.5">{level.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Reset Chat */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={startNewChat}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Start fresh conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Scroll Area (Full Width Fitted to Screen) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 md:px-6 py-4 w-full scroll-smooth flex flex-col space-y-4 relative">
          {messages.length === 0 ? (
            <div className="relative my-auto py-6 sm:py-10 flex flex-col items-center justify-center text-center w-full max-w-5xl mx-auto px-2">
              {/* Version & Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium tracking-wide mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Academic Assistant · Ready to help</span>
              </div>

              {/* Glowing Brain Avatar */}
              <div className="relative mb-3 group cursor-default">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-4 ring-emerald-500/10">
                  <Brain className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Main Headline */}
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                Master Any Concept with{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  StudyOS Intelligence
                </span>
              </h2>

              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-lg mb-4 leading-relaxed">
                Trained to craft university exam answers, solve step-by-step engineering numericals, and format master solutions for <strong>2 marks</strong>, <strong>5 marks</strong>, or <strong>10 marks</strong> depth.
              </p>

              {/* Subject Domain Filter Chips */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
                {SUBJECT_DOMAINS.map(sub => {
                  const Icon = sub.icon;
                  const isActive = selectedSubject === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubject(sub.id)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border shadow-xs",
                        isActive
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recommended University Prompts (Curated by Active Subject) */}
              <div className="w-full text-left">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Recommended University Questions (Click to Send):
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">Tap any card to run immediately</span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                  {activePrompts.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.q}
                        type="button"
                        onClick={() => sendMessage(item.q)}
                        className="group text-left p-3.5 rounded-2xl bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-800/90 border border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-500/50 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-2.5 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className={clsx("w-6 h-6 rounded-lg flex items-center justify-center", item.iconBg)}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {item.category}
                            </span>
                          </div>
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {item.badge}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          &quot;{item.q}&quot;
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.04] text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="truncate max-w-[220px]">{item.desc}</span>
                          <div className="flex items-center gap-0.5 font-bold text-emerald-500 group-hover:translate-x-1 transition-transform">
                            <span>Ask</span>
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              {messages.map(msg =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end gap-3 animate-fadeIn">
                    <div className="max-w-[80%] rounded-xl px-4 py-2.5 bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-xs">
                      <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={msg.id}
                    msg={msg}
                    onFollowUp={prompt => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    onPlaySpeech={playSpeech}
                    isSpeakingThis={speakingMsgId === msg.id}
                    onStopSpeech={stopSpeech}
                    onRegenerate={() => handleRegenerate(msg)}
                  />
                )
              )}

              {loading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 animate-fadeIn">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white shadow-xs">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="p-3 sm:p-4 rounded-2xl rounded-tl-xs bg-white dark:bg-[#141b2a] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-2.5 shadow-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                      Retrieving syllabus notes, checking formulas & streaming answer...
                    </span>
                  </div>
                </div>
              )}

              {errorState && (
                <div className="flex gap-3 animate-fadeIn">
                  <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center flex-shrink-0 text-white shadow-xs">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-2xl rounded-tl-xs bg-rose-50/90 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs w-full">
                    <div>
                      <p className="font-semibold text-xs mb-0.5">Response Generation Failed</p>
                      <p className="text-[11px] opacity-90">{errorState.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const p = errorState.lastPrompt;
                        setErrorState(null);
                        sendMessage(p);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors flex-shrink-0 shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Question</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── 3. BOTTOM COMPOSER DOCK (Full Width Fitted to Screen) ────────────── */}
        <div className="flex-shrink-0 px-1 sm:px-3 pb-2 pt-1 w-full max-w-full min-w-0 space-y-1.5">
          {/* AI Study Modes & Quick Actions Toolbar */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none w-full min-w-0 max-w-full text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              Mode:
            </span>
            {[
              { id: "learn", label: "Learn", icon: Lightbulb },
              { id: "exam", label: "Exam Rubric", icon: GraduationCap },
              { id: "quiz", label: "Quiz", icon: QuizIcon },
              { id: "interview", label: "Interview", icon: Mic },
              { id: "revision", label: "Revision", icon: Zap },
              { id: "summary", label: "Summary", icon: FileText },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setStudyMode(m.id as any);
                  if (m.id === "exam" && !selectedMarkDepth) setSelectedMarkDepth(5);
                  toast.success(`Active Mode: ${m.label}`);
                }}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex-shrink-0 border",
                  studyMode === m.id
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.06] hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <m.icon className="w-3 h-3" />
                <span>{m.label}</span>
              </button>
            ))}

            <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-700 mx-1 flex-shrink-0" />

            {QUICK_ACTIONS.slice(0, 4).map(qa => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => handleQuickAction(qa)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/[0.05] rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <Icon className="w-3 h-3" />
                  <span>{qa.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Composer Box */}
          <div className="relative flex flex-col bg-white dark:bg-[#0c121e] rounded-xl border border-slate-200 dark:border-white/[0.1] focus-within:border-emerald-500/60 dark:focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 shadow-xs transition-colors p-2.5 sm:px-3.5 sm:py-2.5 w-full min-w-0 max-w-full">
            {/* Top: Auto-expanding textarea line after line */}
            <textarea
              ref={textareaRef}
              value={input}
              onInput={adjustHeight}
              onChange={e => {
                setInput(e.target.value);
                adjustHeight();
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask StudyOS AI anything (numerical problem, 2/5/10 marks concept, or formula proof)..."
              rows={1}
              style={{ minHeight: "28px" }}
              className="w-full min-w-0 bg-transparent px-1 pt-0 pb-1 text-[14px] sm:text-base text-slate-900 dark:text-[#ececec] placeholder-slate-400 dark:placeholder-[#8e8e8e] focus:outline-none resize-none leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
            />

            {/* Bottom Row: Attach (+), Think Pill, Mic, Circular Send/Stop Button */}
            <div className="flex items-center justify-between pt-1 mt-0.5 w-full min-w-0 gap-2">
              {/* Left Action: Upload (+) */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-[#b4b4b4] hover:text-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 transition-colors"
                  title="Attach lecture notes, PDF, or document for RAG grounding"
                >
                  <Plus className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>

              {/* Right Actions: Think Pill + Mic + Circular Send/Stop */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* Reasoning Depth Think button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLevelPicker(v => !v)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                      showLevelPicker || explainLevel !== "btech_student"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 border-slate-200 dark:border-white/10"
                    )}
                    title="Select Explanation Depth / Reasoning Mode"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Think</span>
                    <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                      • {activeLevel?.label || "B.Tech"}
                    </span>
                  </button>

                  {showLevelPicker && (
                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl z-30 overflow-hidden py-1">
                      <div className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Reasoning Depth
                      </div>
                      {EXPLAIN_LEVELS.map(level => (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() => {
                            setExplainLevel(level.id);
                            setShowLevelPicker(false);
                            toast.success(`Mode set to ${level.label}`);
                          }}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-xs transition-colors",
                            explainLevel === level.id
                              ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{level.label}</span>
                            {explainLevel === level.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">{level.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voice Dictation (Mic) */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-slate-500 dark:text-[#b4b4b4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                  )}
                  title={isListening ? "Listening... click to stop" : "Voice dictation"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Circular Action Button (Send / Stop) */}
                {loading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                    title="Stop generating"
                  >
                    <div className="w-2.5 h-2.5 bg-white rounded-xs" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                      input.trim()
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/25 cursor-pointer scale-100 active:scale-95"
                        : "bg-slate-200 dark:bg-[#283244] text-slate-400 dark:text-[#67778e] cursor-not-allowed"
                    )}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Disclaimer Footer like ChatGPT */}
          <div className="text-[11px] text-center text-slate-400 dark:text-[#8e8e8e] pb-0.5">
            StudyOS AI can make mistakes. Verify important formulas against your course syllabus.
          </div>
        </div>
      </main>
    </div>
  );
}
