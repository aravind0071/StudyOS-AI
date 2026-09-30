"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, Brain, Target, Clock, Award,
  BarChart, LineChart, CheckCircle2, AlertCircle
} from "lucide-react";
import { analyticsApi } from "@/lib/api";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart as ReLineChart, Line, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Legend
} from "recharts";
import clsx from "clsx";

function StatCard({ label, value, icon: Icon, colorClass, suffix = "" }: any) {
  return (
    <div className="card p-5 border border-slate-200 dark:border-white/[0.08]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}<span className="text-slate-400 text-base font-normal ml-0.5">{suffix}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getOverview()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  const quizData = data?.recent_quiz_scores?.map((q: any, i: number) => ({
    name: `Quiz ${i + 1}`, score: q.score?.toFixed(1)
  })) || [];

  const masteryData = data?.all_mastery?.slice(-8).map((m: any) => ({
    concept: m.concept.length > 12 ? m.concept.slice(0, 12) + "…" : m.concept,
    mastery: m.score,
  })) || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" /> Progress & Performance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Track your learning journey and identify areas to improve.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Knowledge Score" value={data?.knowledge_score?.toFixed(1) || 0} icon={Brain} colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" suffix="%" />
        <StatCard label="Exam Readiness" value={data?.exam_readiness?.toFixed(1) || 0} icon={Target} colorClass="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20" suffix="%" />
        <StatCard label="Quiz Accuracy" value={data?.quiz_accuracy?.toFixed(1) || 0} icon={Award} colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" suffix="%" />
        <StatCard label="Materials" value={data?.material_count || 0} icon={Clock} colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quiz performance */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Quiz Performance History</h2>
          {quizData.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No quizzes taken yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ReLineChart data={quizData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "12px", color: "#f1f5f9" }}
                  formatter={(v: any) => [`${v}%`, "Score"]}
                />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5}
                  dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6 }} />
              </ReLineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Concept mastery */}
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Concept Mastery</h2>
          {masteryData.length === 0 ? (
            <div className="text-center py-10 text-slate-500">Take quizzes to build mastery data.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ReBarChart data={masteryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="concept" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "12px", color: "#f1f5f9" }}
                  formatter={(v: any) => [`${v}%`, "Mastery"]}
                />
                <Bar dataKey="mastery" fill="#10b981" radius={[6, 6, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Strong vs Weak */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Strong Areas
          </h2>
          {!data?.strong_concepts?.length ? (
            <p className="text-slate-500 text-sm">Complete quizzes to identify your strong areas.</p>
          ) : (
            <div className="space-y-2">
              {data.strong_concepts.map((c: any) => (
                <div key={c.concept} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                  <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{c.concept}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{c.score.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" /> Needs Improvement
          </h2>
          {!data?.weak_concepts?.length ? (
            <p className="text-slate-500 text-sm">No weak areas detected. Keep taking quizzes!</p>
          ) : (
            <div className="space-y-2">
              {data.weak_concepts.map((c: any) => (
                <div key={c.concept} className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
                  <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{c.concept}</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">{c.score.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
