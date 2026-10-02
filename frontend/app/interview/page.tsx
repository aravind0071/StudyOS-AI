"use client";

import { useState, useEffect } from "react";
import { interviewApi, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  Mic, Brain, Send, Loader2, ChevronRight, ChevronLeft,
  CheckCircle, Award, ArrowLeft, Zap, Sparkles, CheckCircle2,
  BookOpen, Code2, ShieldAlert, Cpu, Network, Lightbulb, Clock,
  RefreshCw, LogOut, SkipForward, Pencil, Terminal, AlertCircle,
  HelpCircle, BarChart3, Layers, Check, X
} from "lucide-react";
import clsx from "clsx";

const TOPICS = [
  "Python", "Java", "C++", "DBMS", "Operating Systems",
  "Computer Networks", "Machine Learning", "Data Science",
  "Data Structures & Algorithms", "System Design", "Project Viva",
];

const CURATED_TRACKS = [
  {
    title: "FAANG DSA & Problem Solving",
    topic: "Data Structures & Algorithms",
    mode: "technical",
    level: "Hard",
    desc: "Trees, Graphs, DP & algorithmic complexity trade-offs.",
  },
  {
    title: "Backend & Systems Design",
    topic: "System Design",
    mode: "technical",
    level: "Hard",
    desc: "Distributed caching, DB sharding, CAP theorem & microservices.",
  },
  {
    title: "Core CS: OS & Networks",
    topic: "Operating Systems",
    mode: "technical",
    level: "Medium",
    desc: "Concurrency, deadlocks, virtual memory & TCP/IP handshake.",
  },
  {
    title: "Final Year Project Viva Defense",
    topic: "Project Viva",
    mode: "project_viva",
    level: "Viva",
    desc: "Architecture defense, tech stack rationale & edge-case handling.",
  },
];

type Phase = "setup" | "interview" | "complete";

interface QuestionState {
  id: string;
  question: string;
  order: number;
  difficulty: string;
  stage?: string;
  userAnswer: string;
  feedback: any | null;
  isSubmitted: boolean;
  isSkipped: boolean;
}

export default function InterviewPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("technical");
  const [projectDesc, setProjectDesc] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Questions array supporting seamless backward & forward navigation
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Performance history during current session (tracks overall scores of submitted questions)
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Scroll to top whenever question index changes
  const navigateToQuestion = (targetIndex: number) => {
    setCurrentIndex(targetIndex);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const startSession = async () => {
    if (!topic.trim()) {
      toast.error("Please enter or select a topic.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await interviewApi.start(topic.trim(), mode, projectDesc || undefined);
      setSessionId(data.session_id);

      const firstQ: QuestionState = {
        id: data.first_question.id,
        question: data.first_question.question,
        order: data.first_question.order || 0,
        difficulty: data.first_question.difficulty || "easy",
        stage: data.first_question.stage || "Basic Concept",
        userAnswer: "",
        feedback: null,
        isSubmitted: false,
        isSkipped: false,
      };

      setQuestions([firstQ]);
      setCurrentIndex(0);
      setScoreHistory([]);
      setPhase("interview");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentIndex] || null;

  const updateCurrentAnswer = (val: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === currentIndex ? { ...q, userAnswer: val } : q))
    );
  };

  const submitAnswer = async () => {
    if (!currentQ) return;
    if (!currentQ.userAnswer.trim()) {
      toast.error("Please provide an answer before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await interviewApi.answer(sessionId, currentQ.id, currentQ.userAnswer);

      // Record score only after real answer submission
      const evScore = data.overall_score !== undefined ? data.overall_score : data.correctness_score;
      if (typeof evScore === "number") {
        setScoreHistory((prev) => [...prev, evScore]);
      }

      // Update question state with evaluation feedback
      setQuestions((prev) =>
        prev.map((q, idx) =>
          idx === currentIndex
            ? {
                ...q,
                feedback: data,
                isSubmitted: true,
                isSkipped: false,
              }
            : q
        )
      );

      toast.success("Answer evaluated across 5 dimensions!");

      if (data.session_complete) {
        toast.success("Interview session completed!");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = async () => {
    if (!currentQ || submitting || skipping) return;
    setSkipping(true);
    try {
      const { data } = await interviewApi.skip(sessionId, currentQ.id);

      setQuestions((prev) =>
        prev.map((q, idx) =>
          idx === currentIndex
            ? {
                ...q,
                userAnswer: "[Candidate skipped question]",
                feedback: data,
                isSubmitted: true,
                isSkipped: true,
              }
            : q
        )
      );

      toast.info("Question marked as skipped.");

      if (data.next_question) {
        const nextData = data.next_question;
        const nextQ: QuestionState = {
          id: nextData.id,
          question: nextData.question,
          order: nextData.order || questions.length,
          difficulty: nextData.difficulty || "medium",
          stage: nextData.stage,
          userAnswer: "",
          feedback: null,
          isSubmitted: false,
          isSkipped: false,
        };
        setQuestions((prev) => [...prev, nextQ]);
        navigateToQuestion(currentIndex + 1);
      } else if (data.session_complete) {
        setPhase("complete");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSkipping(false);
    }
  };

  // Backward navigation
  const handlePrev = () => {
    if (currentIndex > 0) {
      navigateToQuestion(currentIndex - 1);
    }
  };

  // Forward navigation
  const handleNext = async () => {
    // 1. If next question already exists in our array, simply move to it
    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
      return;
    }

    // 2. If current question was evaluated and returned a next_question
    if (currentQ?.feedback?.next_question) {
      const nextData = currentQ.feedback.next_question;
      const nextQ: QuestionState = {
        id: nextData.id,
        question: nextData.question,
        order: nextData.order || questions.length,
        difficulty: nextData.difficulty || "medium",
        stage: nextData.stage,
        userAnswer: "",
        feedback: null,
        isSubmitted: false,
        isSkipped: false,
      };
      setQuestions((prev) => [...prev, nextQ]);
      navigateToQuestion(currentIndex + 1);
      return;
    }

    // 3. If session is complete
    if (currentQ?.feedback && !currentQ.feedback.next_question) {
      setPhase("complete");
      return;
    }

    // 4. Generate next question without marking current as skipped
    setLoadingNext(true);
    try {
      const { data } = await interviewApi.nextQuestion(sessionId, currentQ?.order ?? currentIndex);
      if (data.next_question) {
        const nextQ: QuestionState = {
          id: data.next_question.id,
          question: data.next_question.question,
          order: data.next_question.order,
          difficulty: data.next_question.difficulty,
          stage: data.next_question.stage,
          userAnswer: "",
          feedback: null,
          isSubmitted: false,
          isSkipped: false,
        };
        setQuestions((prev) => [...prev, nextQ]);
        navigateToQuestion(currentIndex + 1);
      } else if (data.session_complete) {
        setPhase("complete");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingNext(false);
    }
  };

  // Allow re-editing an already evaluated question
  const handleReattempt = () => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === currentIndex ? { ...q, feedback: null, isSubmitted: false, isSkipped: false } : q))
    );
  };

  const handleExitInterview = () => {
    setShowExitModal(false);
    setPhase("setup");
    setQuestions([]);
    setCurrentIndex(0);
    setScoreHistory([]);
    toast.info("Exited interview session.");
  };

  // ── SETUP PHASE ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="space-y-6 animate-fadeIn w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Mic className="w-5 h-5 text-purple-500" /> AI Interview & Project Viva
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Adaptive 10-stage mock interview with progressive depth, zero duplicate questions, and rigorous 5D scoring.
            </p>
          </div>
        </div>

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Interview Config Form (Left 2 cols) */}
          <div className="card p-6 space-y-5 lg:col-span-2">
            {/* Mode selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Interview Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "technical",
                    label: "Technical Interview",
                    desc: "Topic-based concept, algorithmic, architectural & edge-case questioning",
                    icon: Brain,
                  },
                  {
                    id: "project_viva",
                    label: "Project Viva",
                    desc: "Rigorous defense of your capstone project, tech stack & architecture",
                    icon: Code2,
                  },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMode(m.id);
                        if (m.id === "project_viva" && !topic) {
                          setTopic("Project Viva");
                        }
                      }}
                      className={clsx(
                        "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer",
                        mode === m.id
                          ? "bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 font-semibold ring-2 ring-purple-500/20 shadow-sm"
                          : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 hover:border-slate-400 dark:hover:border-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={clsx("w-4 h-4", mode === m.id ? "text-purple-500" : "text-slate-400")} />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{m.label}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {m.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Topic Input & Quick pick chips */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Topic or Subject <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Operating Systems, Machine Learning, Python, DBMS, System Design"
                  style={{ paddingLeft: "2.75rem" }}
                  className="input-field text-sm"
                />
              </div>

              {/* Quick Pick Topic Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" /> Quick pick:
                </span>
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTopic(t);
                      if (t === "Project Viva") setMode("project_viva");
                    }}
                    className={clsx(
                      "text-[11px] px-2.5 py-0.5 rounded-full transition-all border cursor-pointer",
                      topic === t
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-300 font-bold shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-purple-500/15 hover:text-purple-500 hover:border-purple-500/30 border-slate-200 dark:border-white/[0.08]"
                    )}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Project viva description */}
            {mode === "project_viva" && (
              <div className="animate-fadeIn space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Project Description & Technology Stack <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Enter details about your capstone or semester project:&#10;• Technologies: e.g. Next.js, FastAPI, PostgreSQL, Redis, Docker&#10;• Core Problem: What does it solve and for whom?&#10;• Key Features: Authentication, real-time messaging, payments, etc."
                  rows={4}
                  className="input-field resize-none text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  The AI interviewer will analyze your specific technologies and architecture to generate 10 unique, non-duplicate viva questions.
                </p>
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={startSession}
              disabled={loading || !topic.trim()}
              className="btn-primary w-full py-3.5 shadow-lg shadow-purple-500/20 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Initializing Adaptive Interviewer...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" /> Start Mock Interview
                </>
              )}
            </button>
          </div>

          {/* 10-Stage Progression & 5D Rubric (Right 1 col) */}
          <div className="space-y-4">
            {/* 10-Stage Blueprint */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Layers className="w-4 h-4 text-purple-500" /> 10-Stage Interview Progression
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every question is genuinely distinct and calibrated to a specific technical stage:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 pt-1">
                {[
                  "1. Basic Concept",
                  "2. Why It Is Used",
                  "3. How It Works",
                  "4. Architecture & Design",
                  "5. Implementation",
                  "6. Technical Details",
                  "7. Practical Example",
                  "8. Problem / Edge Case",
                  "9. Project Application",
                  "10. Deeper Follow-up",
                ].map((st, i) => (
                  <div key={i} className="flex items-center gap-1.5 p-1 rounded bg-slate-50 dark:bg-white/[0.03]">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">{st}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5-Dimensional Scoring Standard */}
            <div className="card p-5 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Award className="w-4 h-4 text-purple-500" /> 5-Dimensional Scoring Standard
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Correctness (30%)</span>
                  <span className="text-slate-400">Accuracy & exact definitions</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Technical Depth (25%)</span>
                  <span className="text-slate-400">Internal flow & Big-O trade-offs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Relevance (20%)</span>
                  <span className="text-slate-400">Directly answers question</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Completeness (15%)</span>
                  <span className="text-slate-400">Covers all required facets</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Communication (10%)</span>
                  <span className="text-slate-400">Clarity & professional tone</span>
                </div>
              </div>
            </div>

            {/* Curated Track Presets */}
            <div className="card p-5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Curated Track Presets
              </div>
              <div className="space-y-1.5">
                {CURATED_TRACKS.map((track) => (
                  <button
                    key={track.title}
                    type="button"
                    onClick={() => {
                      setTopic(track.topic);
                      setMode(track.mode);
                      toast.success(`Selected "${track.title}" track.`);
                    }}
                    className="w-full text-left p-2 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:border-purple-500/40 bg-slate-50/50 dark:bg-white/[0.02] transition-all text-xs"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{track.title}</div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{track.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── INTERVIEW PHASE ──────────────────────────────────────────────────────
  if (phase === "interview") {
    // Only calculate average if answers were actually submitted
    const avgScore = scoreHistory.length
      ? Math.round(scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length)
      : null;

    return (
      <div className="space-y-5 animate-fadeIn w-full">
        {/* Sticky Header with Exit Button & Badges */}
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md pt-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" /> {topic} Mock Interview
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Question {currentIndex + 1} of 10 · {currentQ?.stage || "Adaptive Stage"} · Real-time 5D evaluation
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="badge badge-slate capitalize text-xs">
                {currentQ?.difficulty || "medium"} difficulty
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
                {mode === "project_viva" ? "Project Viva" : "Technical Round"}
              </span>

              {/* SINGLE EXIT & CONCLUDE BUTTON */}
              <button
                type="button"
                onClick={() => setShowExitModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 text-xs font-semibold transition-colors cursor-pointer"
                title="Exit and conclude interview"
              >
                <LogOut className="w-3.5 h-3.5" /> Exit & Conclude
              </button>
            </div>
          </div>

          {/* Quick Question Stepper */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 scrollbar-none">
            <span className="text-xs font-medium text-slate-400 mr-1.5 shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-500" /> Questions:
            </span>
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => navigateToQuestion(idx)}
                className={clsx(
                  "h-7 min-w-7 px-2.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center justify-center gap-1 border cursor-pointer",
                  idx === currentIndex
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : q.isSkipped
                    ? "bg-slate-200/60 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-white/10"
                    : q.isSubmitted
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]"
                )}
              >
                {q.isSkipped ? (
                  <span className="text-[10px] text-slate-400 font-mono">Skip</span>
                ) : q.isSubmitted ? (
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                ) : null}
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          {/* Main Interview Q&A Section (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Question Card */}
            <div className="card p-6 border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Interviewer Question
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                        Stage {currentIndex + 1}: {currentQ?.stage || "Technical Inquiry"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-slate-900 dark:text-white text-base sm:text-lg leading-relaxed font-semibold pt-1">
                {currentQ?.question}
              </p>
            </div>

            {/* ANSWER INPUT BOX (When unsubmitted) */}
            {!currentQ?.isSubmitted ? (
              <div className="space-y-4">
                {/* Response Console */}
                <div className="card p-0 border border-slate-200 dark:border-white/[0.08] shadow-sm rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all duration-200">
                  {/* Console Header Bar */}
                  <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.08] text-xs gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-purple-500" /> Technical Response Console
                        </span>
                      </div>

                      {/* Quick Helper Format Chips */}
                      <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = "\n```python\n# Implementation logic\n\n```\n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + snippet);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-white/[0.06] hover:bg-purple-500/10 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                        >
                          + Code
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const complexity = "\nComplexity Analysis:\n• Time: O()\n• Space: O()\n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + complexity);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-white/[0.06] hover:bg-purple-500/10 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                        >
                          + Complexity
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const steps = "\nKey Technical Steps:\n1. \n2. \n3. \n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + steps);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-white/[0.06] hover:bg-purple-500/10 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200 dark:border-white/[0.08] transition-colors cursor-pointer"
                        >
                          + Steps
                        </button>
                      </div>
                    </div>

                    {/* Word Counter & Clear */}
                    <div className="flex items-center gap-3">
                      {currentQ?.userAnswer && (
                        <button
                          type="button"
                          onClick={() => updateCurrentAnswer("")}
                          className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-white/[0.04] px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/[0.08]">
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          {currentQ?.userAnswer.trim().split(/\s+/).filter(Boolean).length || 0}
                        </span>{" "}
                        words
                      </div>
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                    value={currentQ?.userAnswer || ""}
                    onChange={(e) => updateCurrentAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        submitAnswer();
                      }
                    }}
                    placeholder="Type your technical response here...&#10;&#10;• State the core concept, operational mechanism, and algorithmic details.&#10;• Mention Time & Space complexity (e.g. O(log n), O(n)).&#10;• Include code patterns, trade-offs, or real-world use-cases where relevant.&#10;&#10;Shortcut: Press Ctrl + Enter to submit."
                    rows={12}
                    className="w-full bg-white dark:bg-[#080b12] text-slate-900 dark:text-slate-100 p-4 sm:p-5 text-sm font-mono leading-relaxed placeholder:text-slate-400 focus:outline-none resize-y min-h-[290px]"
                  />

                  {/* Console Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border-t border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>
                        <strong>Interviewer Expectation:</strong> 40–120 words with precise technical terms & trade-offs.
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                      Ctrl + Enter to Submit
                    </div>
                  </div>
                </div>

                {/* Symmetrical Navigation & Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  {/* Previous Button */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all w-full sm:w-auto justify-center cursor-pointer",
                      currentIndex === 0
                        ? "opacity-30 cursor-not-allowed border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900/40"
                        : "border-slate-300 dark:border-slate-700 hover:border-purple-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-white"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous Question
                  </button>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                    {/* Explicit Skip Question Button */}
                    <button
                      type="button"
                      onClick={handleSkipQuestion}
                      disabled={skipping || submitting}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 hover:border-amber-500/50 bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:text-amber-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Skip this question without penalty"
                    >
                      {skipping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <SkipForward className="w-3.5 h-3.5" />
                      )}
                      <span>Skip Question</span>
                    </button>

                    {/* Submit Answer Button */}
                    <button
                      type="button"
                      onClick={submitAnswer}
                      disabled={submitting || skipping || !currentQ?.userAnswer.trim()}
                      className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Evaluating 5D Metrics...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Submit Answer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* When evaluated, show diagnostic feedback card with 5D Score breakdown */
              <div className="space-y-4">
                {/* Your Submitted Answer Card */}
                <div className="card p-5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10">
                  <div className="text-slate-500 dark:text-slate-400 text-xs mb-1.5 font-semibold flex items-center justify-between">
                    <span>Candidate Submission</span>
                    <div className="flex items-center gap-2">
                      {currentQ.isSkipped ? (
                        <span className="text-amber-500 flex items-center gap-1 text-xs font-bold">
                          <AlertCircle className="w-3.5 h-3.5" /> Skipped by Candidate
                        </span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> Evaluated
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleReattempt}
                        className="text-xs text-purple-500 hover:text-purple-400 font-semibold underline flex items-center gap-1 ml-2 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Re-attempt
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                    {currentQ.userAnswer}
                  </p>
                </div>

                {/* 5-Dimensional AI Feedback & Score Breakdown */}
                <div className="card p-6 border border-purple-500/20 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                      <Sparkles className="w-4 h-4 text-purple-500" /> AI Diagnostic Evaluation
                    </h3>
                    <div className="flex items-center gap-2">
                      {currentQ.feedback?.overall_score !== undefined && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Overall: {Math.round(currentQ.feedback.overall_score)}%
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleReattempt}
                        className="btn-secondary py-1 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3 text-purple-500" /> Edit Answer
                      </button>
                    </div>
                  </div>

                  {/* 5D Score Pills Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      {
                        label: "Correctness",
                        value: currentQ.feedback?.correctness_score,
                        color: "text-emerald-500",
                        bg: "bg-emerald-500/10 border-emerald-500/20",
                        weight: "30%",
                      },
                      {
                        label: "Relevance",
                        value: currentQ.feedback?.relevance_score ?? currentQ.feedback?.correctness_score,
                        color: "text-teal-500",
                        bg: "bg-teal-500/10 border-teal-500/20",
                        weight: "20%",
                      },
                      {
                        label: "Depth",
                        value: currentQ.feedback?.depth_score,
                        color: "text-sky-500",
                        bg: "bg-sky-500/10 border-sky-500/20",
                        weight: "25%",
                      },
                      {
                        label: "Completeness",
                        value: currentQ.feedback?.completeness_score ?? currentQ.feedback?.depth_score,
                        color: "text-indigo-500",
                        bg: "bg-indigo-500/10 border-indigo-500/20",
                        weight: "15%",
                      },
                      {
                        label: "Communication",
                        value: currentQ.feedback?.communication_score ?? currentQ.feedback?.clarity_score,
                        color: "text-purple-500",
                        bg: "bg-purple-500/10 border-purple-500/20",
                        weight: "10%",
                      },
                    ].map(({ label, value, color, bg, weight }) => (
                      <div
                        key={label}
                        className={clsx("text-center p-2.5 rounded-xl border", bg)}
                      >
                        <div className={clsx("text-xl font-bold tracking-tight", color)}>
                          {value !== undefined ? `${Math.round(value)}%` : "N/A"}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 text-[10px] mt-0.5 font-bold">{label}</div>
                        <div className="text-slate-400 text-[9px]">{weight} weight</div>
                      </div>
                    ))}
                  </div>

                  {/* Feedback Narrative */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5">
                    <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                      {currentQ.feedback?.feedback || "Evaluation complete."}
                    </p>
                  </div>

                  {/* High-Impact Points Missed */}
                  {currentQ.feedback?.missing_points?.length > 0 && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                      <p className="text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> High-Impact Points to Include:
                      </p>
                      <ul className="text-slate-700 dark:text-slate-300 text-xs space-y-1.5 pl-2">
                        {currentQ.feedback.missing_points.map((p: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Follow-up question if provided */}
                  {currentQ.feedback?.follow_up_question && (
                    <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs text-purple-700 dark:text-purple-300 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Interviewer Follow-up Probe:</strong> {currentQ.feedback.follow_up_question}
                      </div>
                    </div>
                  )}

                  {/* Navigation Bar after evaluation */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className={clsx(
                        "flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all w-full sm:w-auto justify-center cursor-pointer",
                        currentIndex === 0
                          ? "opacity-30 cursor-not-allowed border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-900/40"
                          : "border-slate-300 dark:border-slate-700 hover:border-purple-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-white"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous Question
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={loadingNext}
                      className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
                    >
                      {loadingNext ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentIndex < questions.length - 1 || currentQ.feedback?.next_question ? (
                        <>
                          Next Question <ChevronRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" /> View Final Performance Report
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Session Radar & Structure Guide (1 col) */}
          <div className="space-y-4">
            {/* Live Progress Card */}
            <div className="card p-5 space-y-4 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Live Session Progress
                </span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Round
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Questions Explored</span>
                  <span className="font-bold text-slate-900 dark:text-white">{currentIndex + 1} / 10</span>
                </div>
                <div className="progress-bar h-2">
                  <div
                    className="progress-fill bg-purple-500"
                    style={{ width: `${Math.min(100, ((currentIndex + 1) / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Only show average answer score if at least one question has been evaluated */}
              {avgScore !== null ? (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{avgScore}%</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Average Submitted Score ({scoreHistory.length} answered)</div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] text-center">
                  <div className="text-xs text-slate-400">Score evaluates upon first answer submission</div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Topic:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{topic}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{mode.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Stage:</span>
                  <span className="font-semibold text-purple-500 dark:text-purple-400">{currentQ?.stage || "Basic Concept"}</span>
                </div>
              </div>
            </div>

            {/* Answer Structure Checklist */}
            <div className="card p-5 space-y-3 border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Answer Framework (STAR)
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-purple-400">1.</span>
                  <span><strong>Definition:</strong> State the core concept in 1 sentence.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-purple-400">2.</span>
                  <span><strong>Mechanism:</strong> Walk through internal data flow / execution.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-purple-400">3.</span>
                  <span><strong>Trade-offs:</strong> Mention Time / Space complexity and edge cases.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-purple-400">4.</span>
                  <span><strong>Practical Example:</strong> Reference a real-world software system.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── EXIT CONFIRMATION MODAL ────────────────────────────────────── */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="card p-6 max-w-md w-full border border-slate-200 dark:border-white/10 shadow-2xl space-y-4 bg-white dark:bg-[#111827] text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Exit Mock Interview?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to conclude this session?</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/[0.04] p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06]">
                Your submitted answers and AI scores will remain in your interview history. You can view your final evaluation report or start a fresh session.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                >
                  Continue Interview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitModal(false);
                    setPhase("complete");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> View Performance Report
                </button>
                <button
                  type="button"
                  onClick={handleExitInterview}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Exit to Setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── COMPLETE PHASE ───────────────────────────────────────────────────────
  const submittedQuestions = questions.filter((q) => q.isSubmitted && !q.isSkipped);
  const skippedQuestions = questions.filter((q) => q.isSkipped);
  const submittedScores = submittedQuestions
    .map((q) => q.feedback?.overall_score ?? q.feedback?.correctness_score)
    .filter((s): s is number => typeof s === "number");

  // Calculate score ONLY from the answers actually submitted (never fallback to 85%!)
  const finalScore = submittedScores.length
    ? Math.round(submittedScores.reduce((a, b) => a + b, 0) / submittedScores.length)
    : null;

  // Average by dimension for submitted answers
  const avgDim = (dim: string) => {
    const vals = submittedQuestions
      .map((q) => q.feedback?.[dim])
      .filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgCorrectness = avgDim("correctness_score");
  const avgRelevance = avgDim("relevance_score") ?? avgCorrectness;
  const avgDepth = avgDim("depth_score");
  const avgCompleteness = avgDim("completeness_score") ?? avgDepth;
  const avgCommunication = avgDim("communication_score") ?? avgDim("clarity_score");

  return (
    <div className="w-full space-y-6 animate-fadeIn py-4 max-w-4xl mx-auto">
      {/* Hero Performance Card */}
      <div className="card p-6 sm:p-10 border border-purple-500/20 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-sm ring-4 ring-purple-500/10">
          <Award className="w-8 h-8 text-white" />
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Interview Completed
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mt-1">
            Performance report for <strong>{topic}</strong> ({mode === "project_viva" ? "Project Viva Defense" : "Technical Interview"}).
          </p>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {finalScore !== null ? `${finalScore}%` : "No Answers"}
            </div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Overall Mastery</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {submittedQuestions.length}
            </div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Answers Evaluated</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-500">
              {skippedQuestions.length}
            </div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Questions Skipped</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-700 dark:text-slate-300">
              {questions.length}
            </div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Total Presented</div>
          </div>
        </div>

        {/* 5-Dimensional Competency Breakdown (If answers submitted) */}
        {submittedQuestions.length > 0 && (
          <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] max-w-2xl mx-auto space-y-3 text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-purple-500" /> 5-Dimensional Competency Breakdown
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { label: "Accuracy", val: avgCorrectness, color: "text-emerald-500" },
                { label: "Relevance", val: avgRelevance, color: "text-teal-500" },
                { label: "Tech Depth", val: avgDepth, color: "text-sky-500" },
                { label: "Completeness", val: avgCompleteness, color: "text-indigo-500" },
                { label: "Communication", val: avgCommunication, color: "text-purple-500" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                  <div className={clsx("text-lg font-bold", color)}>
                    {val !== null ? `${val}%` : "N/A"}
                  </div>
                  <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Question Review List */}
        <div className="text-left space-y-3 max-w-2xl mx-auto pt-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" /> Question-by-Question Audit
          </h3>

          <div className="space-y-2.5">
            {questions.map((q, idx) => {
              const isSk = q.isSkipped || q.userAnswer === "[Candidate skipped question]";
              const sc = q.feedback?.overall_score ?? q.feedback?.correctness_score;
              return (
                <div
                  key={q.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900/50 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      Q{idx + 1}: {q.stage || "Stage Inquiry"}
                    </span>
                    {isSk ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Skipped
                      </span>
                    ) : sc !== undefined ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Score: {Math.round(sc)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Unanswered</span>
                    )}
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-medium">
                    {q.question}
                  </div>
                  {q.userAnswer && !isSk && (
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2 italic">
                      &quot;{q.userAnswer}&quot;
                    </div>
                  )}
                  {q.feedback?.feedback && !isSk && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                      💡 {q.feedback.feedback}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <button
            onClick={() => {
              setQuestions([]);
              setCurrentIndex(0);
              setScoreHistory([]);
              setPhase("setup");
            }}
            className="btn-primary flex items-center justify-center gap-2 cursor-pointer"
          >
            <Mic className="w-4 h-4" /> Start Another Interview
          </button>
          <a href="/analytics" className="btn-secondary flex items-center justify-center gap-2 cursor-pointer">
            View Analytics Progress
          </a>
        </div>
      </div>
    </div>
  );
}
