"use client";

import { useState, useEffect } from "react";
import { interviewApi, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  Mic, Brain, Send, Loader2, ChevronRight, ChevronLeft,
  CheckCircle, Award, ArrowLeft, Zap, Sparkles, CheckCircle2,
  BookOpen, Code2, ShieldAlert, Cpu, Network, Lightbulb, Clock,
  RefreshCw, LogOut, SkipForward, Pencil, Terminal
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
  userAnswer: string;
  feedback: any | null;
  isSubmitted: boolean;
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
  const [loadingNext, setLoadingNext] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Performance history during current session
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Scroll to top whenever question index changes so header is never scrolled off
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
        userAnswer: "",
        feedback: null,
        isSubmitted: false,
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

      // Record score if evaluated
      if (data.correctness_score !== undefined) {
        setScoreHistory((prev) => [...prev, data.correctness_score]);
      }

      // Update question state with evaluation feedback
      setQuestions((prev) =>
        prev.map((q, idx) =>
          idx === currentIndex
            ? {
                ...q,
                feedback: data,
                isSubmitted: true,
              }
            : q
        )
      );

      toast.success("Answer evaluated!");

      if (data.session_complete) {
        toast.success("Interview session completed!");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Backward navigation: Move to previous question (never locks, retains user draft)
  const handlePrev = () => {
    if (currentIndex > 0) {
      navigateToQuestion(currentIndex - 1);
    }
  };

  // Forward navigation: Move to next question (generates/fetches if not created, without forcing 0% skip)
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
        userAnswer: "",
        feedback: null,
        isSubmitted: false,
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

    // 4. If current question is unsubmitted, generate next question without marking current as skipped!
    setLoadingNext(true);
    try {
      const { data } = await interviewApi.nextQuestion(sessionId, currentQ?.order ?? currentIndex);
      if (data.next_question) {
        const nextQ: QuestionState = {
          id: data.next_question.id,
          question: data.next_question.question,
          order: data.next_question.order,
          difficulty: data.next_question.difficulty,
          userAnswer: "",
          feedback: null,
          isSubmitted: false,
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
      prev.map((q, idx) => (idx === currentIndex ? { ...q, feedback: null } : q))
    );
  };

  const handleExitInterview = () => {
    setShowExitModal(false);
    setPhase("setup");
    setQuestions([]);
    setCurrentIndex(0);
    toast.info("Exited interview session.");
  };

  // ── SETUP PHASE ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="space-y-6 animate-fadeIn w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-500" /> Interview Mode
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              AI conducts a real mock technical interview with progressive difficulty and live instant feedback.
            </p>
          </div>
        </div>

        {/* Full-width Responsive Grid matching Quizzes page */}
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
                    desc: "Topic-based concept, algorithmic & architectural questioning",
                    icon: Brain,
                  },
                  {
                    id: "project_viva",
                    label: "Project Viva",
                    desc: "Rigorous defense of your capstone or semester project",
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
                        "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between",
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
                  placeholder="e.g. Operating Systems, Machine Learning, Python, DBMS"
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
                      "text-[11px] px-2.5 py-0.5 rounded-full transition-all border",
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
              <div className="animate-fadeIn">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Project Description & Architecture Summary
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Describe your project briefly — tech stack (e.g. Next.js, FastAPI, PostgreSQL), problem solved, design patterns, and key features..."
                  rows={4}
                  className="input-field resize-none text-sm"
                />
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={startSession}
              disabled={loading || !topic.trim()}
              className="btn-primary w-full py-3.5 shadow-lg shadow-emerald-500/20 text-sm font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Initializing AI Interviewer...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" /> Start Interview Session
                </>
              )}
            </button>
          </div>

          {/* Quick Interview Tracks & Evaluation Criteria (Right 1 col) */}
          <div className="space-y-4">
            {/* Quick Track Presets */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-amber-500" /> Curated Interview Tracks
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-click launch mock interviews for top industry and university rounds:
              </p>
              <div className="space-y-2 pt-1">
                {CURATED_TRACKS.map((track) => (
                  <button
                    key={track.title}
                    type="button"
                    onClick={() => {
                      setTopic(track.topic);
                      setMode(track.mode);
                      toast.success(`Loaded "${track.title}" track.`);
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-purple-500/40 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-purple-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-purple-400">
                        {track.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold badge badge-slate">
                        {track.level}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                      {track.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Evaluation Standard */}
            <div className="card p-5 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Award className="w-4 h-4 text-purple-500" /> Real-time Scoring Standard
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Accuracy:</strong> Algorithmic correctness & exact technical terminology</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Depth:</strong> Internal mechanism, edge cases & Big-O complexity</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Clarity:</strong> Structured reasoning & direct, confident explanations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Adaptive AI:</strong> Progressive difficulty calibrated to your answers</span>
                </div>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-bold text-purple-400 mb-1">
                <Lightbulb className="w-3.5 h-3.5" /> Interviewer Advice
              </div>
              State your assumptions upfront, mention time & space trade-offs, and explain your thought process before jumping to conclusions.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── INTERVIEW PHASE ──────────────────────────────────────────────────────
  if (phase === "interview") {
    const avgScore = scoreHistory.length
      ? Math.round(scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length)
      : null;

    return (
      <div className="space-y-5 animate-fadeIn w-full">
        {/* Sticky Header with Exit Button & Badges */}
        <div className="sticky top-0 z-30 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md pt-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" /> {topic} Mock Interview
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Question {currentIndex + 1} of ~10 · AI evaluates your technical depth, accuracy, and communication
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="badge badge-slate capitalize text-xs">
                {currentQ?.difficulty || "medium"} difficulty
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                {mode === "project_viva" ? "Project Viva" : "Technical Round"}
              </span>

              {/* SINGLE EXIT & CONCLUDE BUTTON */}
              <button
                type="button"
                onClick={() => setShowExitModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 text-xs font-bold transition-all shadow-sm"
                title="Exit and conclude interview"
              >
                <LogOut className="w-3.5 h-3.5" /> Exit & Conclude
              </button>
            </div>
          </div>

          {/* Quick Question Stepper / Jump Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 scrollbar-none">
            <span className="text-xs font-semibold text-slate-400 mr-1.5 shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" /> Questions:
            </span>
            {questions.map((q, idx) => (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => navigateToQuestion(idx)}
                className={clsx(
                  "h-7 min-w-7 px-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1 border",
                  idx === currentIndex
                    ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30 ring-2 ring-purple-500/30 scale-105"
                    : q.isSubmitted
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-white/10 hover:text-white"
                )}
              >
                {q.isSubmitted && <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />}
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Screen-fitting 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">
          {/* Main Interview Q&A Section (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Question Card */}
            <div className="card p-6 border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                      Interviewer Question
                    </span>
                    <span className="text-xs font-semibold text-slate-400 ml-2">
                      Q#{currentIndex + 1}
                    </span>
                  </div>
                </div>

                {/* Clean question header without redundant small arrows */}
              </div>

              <p className="text-slate-900 dark:text-white text-base sm:text-lg leading-relaxed font-semibold pt-1">
                {currentQ?.question}
              </p>
            </div>

            {/* ALWAYS SHOW ANSWER INPUT BOX BY DEFAULT (Screenshots 1 UI) */}
            {!currentQ?.feedback ? (
              <div className="space-y-4">
                {/* Professional Impressive Technical Response Console */}
                <div className="card p-0 border border-slate-700/80 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all duration-200">
                  {/* Console Header Bar */}
                  <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 dark:bg-slate-950/90 border-b border-slate-800 text-xs gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-purple-400" /> Technical Response Console
                        </span>
                      </div>

                      {/* Quick Helper Format Chips */}
                      <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = "\n```python\n# Implementation logic\n\n```\n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + snippet);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 hover:bg-purple-500/20 text-slate-400 hover:text-purple-300 border border-slate-700/60 transition-all"
                          title="Insert code snippet template"
                        >
                          + Code
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const complexity = "\nComplexity Analysis:\n• Time: O()\n• Space: O()\n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + complexity);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 hover:bg-purple-500/20 text-slate-400 hover:text-purple-300 border border-slate-700/60 transition-all"
                          title="Insert Time & Space complexity template"
                        >
                          + Complexity (O(n))
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const steps = "\nKey Technical Steps:\n1. \n2. \n3. \n";
                            updateCurrentAnswer((currentQ?.userAnswer || "") + steps);
                          }}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 hover:bg-purple-500/20 text-slate-400 hover:text-purple-300 border border-slate-700/60 transition-all"
                          title="Insert key points template"
                        >
                          + Points
                        </button>
                      </div>
                    </div>

                    {/* Word Counter & Clear Button */}
                    <div className="flex items-center gap-3">
                      {currentQ?.userAnswer && (
                        <button
                          type="button"
                          onClick={() => updateCurrentAnswer("")}
                          className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
                        <span className="text-purple-400 font-bold">
                          {currentQ?.userAnswer.trim().split(/\s+/).filter(Boolean).length || 0}
                        </span>{" "}
                        words ·{" "}
                        <span>{currentQ?.userAnswer.length || 0}</span> chars
                      </div>
                    </div>
                  </div>

                  {/* Spacious Technical Textarea */}
                  <div className="relative">
                    <textarea
                      value={currentQ?.userAnswer || ""}
                      onChange={(e) => updateCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          submitAnswer();
                        }
                      }}
                      placeholder="Type your technical response here...&#10;&#10;• State the core concept, internal execution mechanism, and edge cases.&#10;• Mention Time & Space complexity (e.g. O(log n), O(n)).&#10;• Write code snippets or architectural patterns where relevant.&#10;&#10;Shortcut: Press Ctrl + Enter to submit for evaluation."
                      rows={12}
                      className="w-full bg-slate-950/80 text-slate-100 p-5 text-sm sm:text-base font-mono leading-relaxed placeholder:text-slate-500/70 focus:outline-none resize-y min-h-[290px] selection:bg-purple-500/30"
                    />
                  </div>

                  {/* Console Bottom Status Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 bg-slate-900/90 dark:bg-slate-950/90 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Interviewer Expectation:</strong> 50–150 words with precise definitions & trade-offs.
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono hidden sm:inline-block">
                      Ctrl + Enter to Submit
                    </div>
                  </div>
                </div>

                {/* Symmetrical Navigation & Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  {/* Backward Button */}
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className={clsx(
                      "flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all w-full sm:w-auto justify-center",
                      currentIndex === 0
                        ? "opacity-30 cursor-not-allowed border-slate-800 text-slate-600 bg-slate-900/40"
                        : "border-slate-700 hover:border-purple-500/50 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous Question
                  </button>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    {/* Submit Answer Button */}
                    <button
                      type="button"
                      onClick={submitAnswer}
                      disabled={submitting || !currentQ?.userAnswer.trim()}
                      className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Evaluating...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Submit Answer
                        </>
                      )}
                    </button>

                    {/* Forward Button (Seamlessly goes to next question without 0% skip lock) */}
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={loadingNext}
                      className="btn-secondary py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      {loadingNext ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Next Question <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* When evaluated, show feedback card WITH Edit / Re-attempt Answer button */
              <div className="space-y-4">
                {/* Your Submitted Answer Card */}
                <div className="card p-5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10">
                  <div className="text-slate-500 dark:text-slate-400 text-xs mb-1.5 font-semibold flex items-center justify-between">
                    <span>Your Answer</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> Evaluated
                      </span>
                      <button
                        type="button"
                        onClick={handleReattempt}
                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline flex items-center gap-1 ml-2"
                      >
                        <Pencil className="w-3 h-3" /> Edit Answer
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {currentQ.userAnswer}
                  </p>
                </div>

                {/* AI Feedback & Score Breakdown */}
                <div className="card p-6 border border-emerald-500/20 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                      <Sparkles className="w-4 h-4 text-emerald-500" /> AI Diagnostic Feedback
                    </h3>
                    <button
                      type="button"
                      onClick={handleReattempt}
                      className="btn-secondary py-1 px-3 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3 text-purple-400" /> Re-attempt Answer
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: "Accuracy",
                        value: currentQ.feedback.correctness_score,
                        color: "text-emerald-500",
                        bg: "bg-emerald-500/10 border-emerald-500/20",
                      },
                      {
                        label: "Depth",
                        value: currentQ.feedback.depth_score,
                        color: "text-sky-500",
                        bg: "bg-sky-500/10 border-sky-500/20",
                      },
                      {
                        label: "Clarity",
                        value: currentQ.feedback.clarity_score,
                        color: "text-purple-500",
                        bg: "bg-purple-500/10 border-purple-500/20",
                      },
                    ].map(({ label, value, color, bg }) => (
                      <div
                        key={label}
                        className={clsx("text-center p-3 rounded-xl border", bg)}
                      >
                        <div className={clsx("text-2xl font-black", color)}>
                          {value !== undefined ? `${value.toFixed(0)}%` : "N/A"}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5 font-semibold">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5">
                    <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                      {currentQ.feedback.feedback}
                    </p>
                  </div>

                  {currentQ.feedback.missing_points?.length > 0 && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                      <p className="text-amber-500 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
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

                  {/* Navigation Bar after evaluation */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className={clsx(
                        "flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all w-full sm:w-auto justify-center",
                        currentIndex === 0
                          ? "opacity-30 cursor-not-allowed border-slate-800 text-slate-600 bg-slate-900/40"
                          : "border-slate-700 hover:border-purple-500/50 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous Question
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={loadingNext}
                      className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      {loadingNext ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentIndex < questions.length - 1 || currentQ.feedback.next_question ? (
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
                  Active
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Questions Explored</span>
                  <span className="font-bold text-white">{currentIndex + 1} / 10</span>
                </div>
                <div className="progress-bar h-2">
                  <div
                    className="progress-fill bg-purple-500"
                    style={{ width: `${Math.min(100, ((currentIndex + 1) / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {avgScore !== null && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <div className="text-2xl font-black text-purple-400">{avgScore}%</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Average Answer Score</div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Topic:</span>
                  <span className="font-semibold text-slate-200">{topic}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="font-semibold text-slate-200 capitalize">{mode.replace("_", " ")}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="card p-6 max-w-md w-full border border-rose-500/30 shadow-2xl space-y-4 bg-slate-900 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Exit Mock Interview?</h3>
                  <p className="text-xs text-slate-400">Are you sure you want to exit this session?</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
                Your submitted answers and AI scores will remain in your interview history. You will be returned to the interview setup overview.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                >
                  Continue Interview
                </button>
                <button
                  type="button"
                  onClick={handleExitInterview}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Yes, Exit & Conclude
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── COMPLETE PHASE ───────────────────────────────────────────────────────
  const finalScore = scoreHistory.length
    ? Math.round(scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length)
    : 85;

  return (
    <div className="w-full space-y-6 animate-fadeIn py-6">
      <div className="card p-8 sm:p-12 text-center max-w-2xl mx-auto border border-purple-500/20 shadow-2xl">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-500/30">
          <Award className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
          Interview Complete!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
          Great performance on <strong>{topic}</strong>! The AI interviewer evaluated your technical reasoning and answer depth.
        </p>

        {/* Score Card */}
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-3xl font-black text-purple-400">{finalScore}%</div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Overall Mastery</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10">
            <div className="text-3xl font-black text-emerald-400">{scoreHistory.length || questions.length}</div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Questions Evaluated</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setQuestions([]);
              setCurrentIndex(0);
              setPhase("setup");
            }}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" /> Start Another Interview
          </button>
          <a href="/analytics" className="btn-secondary flex items-center justify-center gap-2">
            View Analytics Progress
          </a>
        </div>
      </div>
    </div>
  );
}
