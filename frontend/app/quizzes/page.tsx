"use client";

import { useState } from "react";
import { quizApi, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  ClipboardList, Loader2, CheckCircle, XCircle, ChevronRight,
  BarChart3, Target, RefreshCw, AlertTriangle, LogOut,
  Zap, Award, CheckCircle2
} from "lucide-react";
import clsx from "clsx";

type Phase = "setup" | "taking" | "results";

interface Question {
  id: string;
  question: string;
  options: string[];
  topic: string;
  difficulty: string;
  type: string;
}

interface Result {
  score: number;
  correct: number;
  wrong: number;
  total: number;
  topic_performance: Record<string, { correct: number; total: number; percentage: number }>;
  weak_topics: string[];
  message: string;
}

export default function QuizzesPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);

  // Setup state
  const [topics, setTopics] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [quizType, setQuizType] = useState("mcq");
  const [numQuestions, setNumQuestions] = useState(10);

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizId, setQuizId] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  const generateQuiz = async () => {
    const topicList = topics.split(",").map(t => t.trim()).filter(Boolean);
    if (!topicList.length) { toast.error("Enter at least one topic."); return; }
    setLoading(true);
    try {
      const { data } = await quizApi.generate({
        topics: topicList, subject, difficulty, quiz_type: quizType, num_questions: numQuestions,
      });
      setQuizId(data.quiz_id);
      setQuestions(data.questions);

      // Start attempt
      const { data: attemptData } = await quizApi.start(data.quiz_id);
      setAttemptId(attemptData.attempt_id);
      setCurrentIdx(0);
      setAnswers({});
      setPhase("taking");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async () => {
    const answerList = Object.entries(answers).map(([question_id, user_answer]) => ({ question_id, user_answer }));
    setLoading(true);
    try {
      const { data } = await quizApi.submit(attemptId, answerList);
      setResult(data);
      setPhase("results");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("studyos-notify", {
            detail: {
              id: "quiz-" + Date.now(),
              title: "Quiz Completed!",
              message: `You scored ${data.score?.toFixed(0)}% (${data.correct}/${data.total} correct).`,
              category: "quiz",
              timestamp: "Just now",
              read: false,
              link: "/quizzes",
              actionText: "Review Score",
            },
          })
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentIdx];
  const progress = questions.length ? ((currentIdx + 1) / questions.length) * 100 : 0;

  // ── SETUP PHASE ──────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-500" /> Practice & Generate Quizzes
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Adaptive AI assessments generated from your study materials and university curriculum.
            </p>
          </div>
        </div>

        {/* Responsive Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Quiz Generator Form (Left 2 cols) */}
          <div className="card p-6 space-y-5 lg:col-span-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Topics <span className="text-red-500">*</span>
              </label>
              <input
                value={topics}
                onChange={e => setTopics(e.target.value)}
                placeholder="e.g. Checksum & CRC, CPU Scheduling, Normalization"
                className="input-field"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Quick pick:</span>
                {[
                  { label: "Checksum & CRC", subj: "Computer Networks" },
                  { label: "CPU Scheduling", subj: "Operating Systems" },
                  { label: "DBMS Normalization", subj: "Database Systems" },
                  { label: "Dijkstra & Graph", subj: "Algorithms" },
                  { label: "Virtual Memory & Paging", subj: "Operating Systems" },
                  { label: "TCP/IP & Subnetting", subj: "Computer Networks" },
                ].map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => { setTopics(chip.label); setSubject(chip.subj); }}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-500 hover:border-emerald-500/30 transition-all border border-slate-200 dark:border-white/[0.08]"
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g., Computer Networks, OS, DBMS"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Number of Questions</label>
                <select value={numQuestions} onChange={e => setNumQuestions(+e.target.value)} className="input-field">
                  {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Difficulty</label>
              <div className="flex gap-3">
                {["easy", "medium", "hard"].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={clsx(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize border transition-all",
                      difficulty === d
                        ? d === "easy"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : d === "medium"
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-400"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Question Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "mcq", label: "Multiple Choice" },
                  { id: "true_false", label: "True / False" },
                  { id: "short_answer", label: "Short Answer" },
                  { id: "interview", label: "Interview Style" },
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setQuizType(type.id)}
                    className={clsx(
                      "py-2.5 rounded-xl text-sm font-medium border transition-all",
                      quizType === type.id
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-400"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateQuiz}
              disabled={loading}
              className="btn-primary w-full py-3 shadow-lg shadow-emerald-500/20 text-sm font-bold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Generating AI Assessment...
                </>
              ) : (
                <>
                  <ClipboardList className="w-5 h-5" /> Generate & Start Quiz
                </>
              )}
            </button>
          </div>

          {/* Quick Practice Presets & Stats (Right 1 col) */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Zap className="w-4 h-4 text-amber-500" /> Quick Exam Presets
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-click launch curated tests for high-frequency university exam topics:
              </p>
              <div className="space-y-2 pt-1">
                {[
                  { title: "Checksum & Error Detection", subj: "Computer Networks", q: 5, diff: "medium" },
                  { title: "CPU Scheduling Algorithms", subj: "Operating Systems", q: 5, diff: "medium" },
                  { title: "DBMS Normalization 1NF-BCNF", subj: "Database Systems", q: 5, diff: "hard" },
                  { title: "Graph & Shortest Path", subj: "Algorithms", q: 5, diff: "hard" },
                ].map(preset => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      setTopics(preset.title);
                      setSubject(preset.subj);
                      setNumQuestions(preset.q);
                      setDifficulty(preset.diff);
                      toast.success(`Loaded "${preset.title}" preset.`);
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-emerald-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500">
                        {preset.title}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 badge badge-slate">
                        {preset.diff}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">
                      {preset.subj} · {preset.q} questions
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Award className="w-4 h-4 text-emerald-500" /> Exam Mastery Standard
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Target passing score: <strong>80%+</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Instant weak-topic diagnostic report</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Verified university answer key</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── TAKING PHASE ─────────────────────────────────────────────────────────
  if (phase === "taking" && currentQ) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
        {/* Progress & Header Controls */}
        <div className="flex items-center justify-between text-sm text-slate-400 mb-1">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="badge badge-slate capitalize">{currentQ.difficulty}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 py-1 px-2.5 rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Quiz</span>
          </button>
        </div>
        <div className="progress-bar h-2.5">
          <div className="progress-fill bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Exit Quiz Confirmation Modal */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="card max-w-md w-full p-6 space-y-4 border border-rose-500/30 shadow-2xl animate-scaleUp">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Exit Quiz?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current quiz progress will not be saved</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to exit this quiz session? All your answers for this attempt will be discarded.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="btn-secondary text-sm"
                >
                  Continue Quiz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitModal(false);
                    setPhase("setup");
                    setAnswers({});
                    setCurrentIdx(0);
                    toast.info("Quiz session exited.");
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm"
                >
                  Yes, Exit Quiz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="card p-6 mt-4">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-3 uppercase tracking-wide">{currentQ.topic}</div>
          <p className="text-slate-900 dark:text-slate-100 text-lg font-semibold leading-snug mb-6">{currentQ.question}</p>

          {/* Options (MCQ) */}
          {currentQ.options?.length > 0 && (
            <div className="space-y-3">
              {currentQ.options.map((opt, i) => (
                <button key={i} type="button" onClick={() => setAnswers(a => ({ ...a, [currentQ.id]: opt }))}
                  className={clsx("w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all",
                    answers[currentQ.id] === opt
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/80 bg-white dark:bg-slate-900/40")}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Short answer */}
          {(!currentQ.options || currentQ.options.length === 0) && (
            <textarea
              value={answers[currentQ.id] || ""}
              onChange={e => setAnswers(a => ({ ...a, [currentQ.id]: e.target.value }))}
              placeholder="Type your answer here..."
              rows={4}
              className="input-field resize-none"
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 justify-between">
          {currentIdx > 0 && (
            <button onClick={() => setCurrentIdx(i => i - 1)} className="btn-secondary">
              ← Previous
            </button>
          )}
          <div className="flex-1" />
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(i => i + 1)} className="btn-primary">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={submitQuiz} disabled={loading} className="btn-primary">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {loading ? "Submitting..." : "Submit Quiz"}
            </button>
          )}
        </div>

        {/* Question dots */}
        <div className="flex gap-1.5 flex-wrap justify-center mt-2">
          {questions.map((q, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={clsx("w-7 h-7 rounded-lg text-xs font-medium transition-all",
                i === currentIdx ? "bg-emerald-500 text-white"
                  : answers[q.id] ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-800 text-slate-500")}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RESULTS PHASE ─────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const scoreColor = result.score >= 80 ? "text-emerald-400" : result.score >= 60 ? "text-amber-400" : "text-red-400";
    const scoreBg = result.score >= 80 ? "bg-emerald-500" : result.score >= 60 ? "bg-amber-500" : "bg-red-500";

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
        {/* Score card */}
        <div className="card p-8 text-center">
          <div className={`text-6xl font-black ${scoreColor} mb-2`}>
            {result.score.toFixed(0)}%
          </div>
          <p className="text-slate-800 dark:text-slate-200 font-semibold text-lg mb-1">{result.message}</p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">{result.correct}</div>
              <div className="text-slate-500 text-sm">Correct</div>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-rose-500">{result.wrong}</div>
              <div className="text-slate-500 text-sm">Wrong</div>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{result.total}</div>
              <div className="text-slate-500 text-sm">Total</div>
            </div>
          </div>
        </div>

        {/* Topic performance */}
        <div className="card p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-500" /> Topic Performance
          </h3>
          <div className="space-y-3">
            {Object.entries(result.topic_performance).map(([topic, perf]) => (
              <div key={topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{topic}</span>
                  <span className={perf.percentage >= 60 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-600 dark:text-rose-400 font-semibold"}>
                    {perf.percentage.toFixed(0)}% ({perf.correct}/{perf.total})
                  </span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-fill ${perf.percentage >= 80 ? "bg-emerald-500" : perf.percentage >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${perf.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weak topics */}
        {result.weak_topics.length > 0 && (
          <div className="card p-5 border-amber-500/20 bg-amber-500/5">
            <h3 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Recommended Revision
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.weak_topics.map(t => (
                <a key={t} href={`/tutor?q=${encodeURIComponent(`Explain ${t}`)}`}
                  className="badge badge-yellow cursor-pointer hover:opacity-80">
                  {t} →
                </a>
              ))}
            </div>
            <p className="text-amber-300/70 text-xs mt-2">
              Click a topic to ask your AI Tutor for a detailed explanation.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setPhase("setup"); setResult(null); setAnswers({}); }}
            className="btn-primary flex-1">
            <RefreshCw className="w-4 h-4" /> Take Another Quiz
          </button>
          <a href="/study-plan" className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Target className="w-4 h-4" /> Update Study Plan
          </a>
        </div>
      </div>
    );
  }

  return null;
}
