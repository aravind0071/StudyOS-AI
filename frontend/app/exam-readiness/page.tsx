"use client";

import { useState, useEffect } from "react";
import { analyticsApi } from "@/lib/api";
import { Target, TrendingUp, AlertTriangle, CheckCircle, Calendar } from "lucide-react";

import DatePicker from "@/components/ui/DatePicker";

function MasteryRow({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="text-slate-700 dark:text-slate-300 text-sm w-40 truncate flex-shrink-0 font-medium">{label}</span>
      <div className="flex-1 progress-bar">
        <div className={`progress-fill ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`${textColor} font-semibold text-sm w-12 text-right`}>{score.toFixed(0)}%</span>
    </div>
  );
}

export default function ExamReadinessPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [examDate, setExamDate] = useState("");

  useEffect(() => {
    analyticsApi.getOverview().then(r => setData(r.data)).finally(() => setLoading(false));
    try {
      const savedDate = localStorage.getItem("studyos_target_exam_date");
      if (savedDate) setExamDate(savedDate);
    } catch (e) {}
  }, []);

  const handleDateChange = (newDate: string) => {
    setExamDate(newDate);
    try {
      localStorage.setItem("studyos_target_exam_date", newDate);
    } catch (e) {}

    if (newDate) {
      try {
        const [year, month, day] = newDate.split("-").map(Number);
        const targetDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const title = diffDays <= 0
          ? `🚨 Exam Day Today!`
          : diffDays === 1
          ? `⚠️ Final Day Countdown: 1 Day to Exam!`
          : `⏳ Exam Countdown: ${diffDays} Days Remaining`;

        const message = diffDays <= 0
          ? `Your exam is today! Review your formula sheets and stay calm.`
          : `You have ${diffDays} days left until your scheduled exam on ${targetDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}. Check your manual timetable in Study Plan!`;

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
      } catch (e) {}
    }
  };

  const readiness = data?.exam_readiness || 0;
  const readinessColor = readiness >= 80 ? "text-emerald-400" : readiness >= 60 ? "text-amber-400" : "text-red-400";
  const readinessBg = readiness >= 80 ? "bg-emerald-500" : readiness >= 60 ? "bg-amber-500" : "bg-red-500";

  const daysUntilExam = examDate
    ? Math.max(0, Math.round((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Target className="w-5 h-5 text-rose-500" /> Exam Readiness
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Know exactly how prepared you are, topic by topic.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overall readiness */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-8 text-center">
              <p className="text-slate-400 text-sm mb-2">Overall Readiness</p>
              <div className={`text-6xl font-bold tracking-tight ${readinessColor} mb-2`}>{readiness.toFixed(0)}%</div>
              <div className="progress-bar h-3 mb-3">
                <div className={`progress-fill ${readinessBg}`} style={{ width: `${readiness}%` }} />
              </div>
              <p className="text-slate-500 text-xs">
                Composite of quiz accuracy (60%) + knowledge mastery (40%)
              </p>
            </div>

            <div className="card p-6 flex flex-col justify-between">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-500" /> Set Exam Date
                </h2>
                <DatePicker
                  id="exam_readiness_date"
                  value={examDate}
                  onChange={handleDateChange}
                  placeholder="Choose or pick exam date"
                  showPresets={true}
                  className="mb-4"
                />
                {daysUntilExam !== null && (
                  <div className={`text-center p-4 rounded-xl my-3 ${daysUntilExam <= 3 ? "bg-red-500/10 border border-red-500/20" : "bg-sky-500/10 border border-sky-500/20"}`}>
                    <div className={`text-3xl font-bold tracking-tight ${daysUntilExam <= 3 ? "text-red-500" : "text-sky-500"}`}>
                      {daysUntilExam}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm">days until exam</div>
                    {daysUntilExam <= 7 && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 font-semibold">⚠ Focus on weak topics immediately!</p>
                    )}
                  </div>
                )}
              </div>
              <a href={examDate ? `/study-plan?exam_date=${examDate}` : "/study-plan"} className="btn-primary w-full mt-3 flex items-center justify-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" /> Generate Revision Plan
              </a>
            </div>
          </div>

          {/* Topic breakdown */}
          <div className="card p-6 border border-slate-200 dark:border-white/[0.08]">
            <h2 className="font-bold text-slate-900 dark:text-white mb-4">Topic Mastery Breakdown</h2>
            {!data?.all_mastery?.length ? (
              <p className="text-slate-500 text-center py-6 text-sm">Take quizzes to see mastery breakdown.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {data.all_mastery.map((m: any) => (
                  <MasteryRow key={m.concept} label={m.concept} score={m.score} />
                ))}
              </div>
            )}
          </div>

          {/* Strong / Weak */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-5 border border-slate-200 dark:border-white/[0.08]">
              <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Strong Areas
              </h3>
              {!data?.strong_concepts?.length ? (
                <p className="text-slate-500 text-sm">None identified yet.</p>
              ) : data.strong_concepts.map((c: any) => (
                <div key={c.concept} className="flex justify-between py-2 border-b border-slate-100 dark:border-white/[0.06] last:border-0">
                  <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{c.concept}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{c.score.toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="card p-5 border border-slate-200 dark:border-white/[0.08]">
              <h3 className="font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Revision Priority
              </h3>
              {!data?.weak_concepts?.length ? (
                <p className="text-slate-500 text-sm">No weak areas. You're doing great!</p>
              ) : data.weak_concepts.map((c: any) => (
                <div key={c.concept} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/[0.06] last:border-0">
                  <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{c.concept}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">{c.score.toFixed(0)}%</span>
                    <a href={`/tutor?q=${encodeURIComponent(`Explain ${c.concept}`)}`} className="badge badge-yellow text-xs">Revise →</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
