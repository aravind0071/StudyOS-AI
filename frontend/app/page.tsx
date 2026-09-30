"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain, Upload, Zap, Target, BookOpen, BarChart3,
  MessageSquare, Network, Shield, ChevronRight, Star,
  FileText, Mic, Video, Globe, Image as ImageIcon, ArrowRight,
  CheckCircle, Sparkles, TrendingUp, Clock, Award, Users, LayoutDashboard
} from "lucide-react";
import { ISTClockBadge } from "@/components/ui/ISTClockBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// ── Mock dashboard preview component ─────────────────────────────────────────
function DashboardPreview() {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
      {/* Window bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-amber-500/80" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <div className="flex-1 mx-4 px-3 py-1 bg-slate-700 rounded text-xs text-slate-400">
          studyosai.com/dashboard
        </div>
      </div>
      <div className="flex">
        {/* Mini sidebar */}
        <div className="w-14 bg-slate-950 border-r border-white/5 p-2 flex flex-col gap-2 items-center py-4">
          {[
            { icon: LayoutDashboard, active: true },
            { icon: BookOpen, active: false },
            { icon: Brain, active: false },
            { icon: Target, active: false },
            { icon: FileText, active: false },
            { icon: BarChart3, active: false },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  item.active
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
            );
          })}
        </div>
        {/* Main content */}
        <div className="flex-1 p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-semibold">Good morning, Arjun</div>
              <div className="text-slate-400 text-xs">What would you like to learn today?</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
              <Zap className="w-3 h-3" /> 12-day streak
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Knowledge", value: "76%", color: "text-emerald-400" },
              { label: "Exam Ready", value: "81%", color: "text-sky-400" },
              { label: "Topics", value: "24", color: "text-purple-400" },
              { label: "Streak", value: "12d", color: "text-amber-400" },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-slate-500 text-[10px]">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent materials */}
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-slate-400 text-[10px] font-medium mb-2 uppercase tracking-wide">Recent Materials</div>
            <div className="space-y-1.5">
              {[
                { name: "BDA Unit 5.pdf", status: "Processed", topics: ["MapReduce", "HDFS", "YARN"] },
                { name: "ML Lecture 04", status: "Processed", topics: ["Overfitting", "Regularization"] },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[11px] font-medium truncate">{m.name}</div>
                    <div className="flex gap-1 flex-wrap">
                      {m.topics.map((t, j) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[9px] text-emerald-400">✓</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weak topics */}
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-slate-400 text-[10px] font-medium mb-2 uppercase tracking-wide">Needs Revision</div>
            <div className="space-y-1.5">
              {[
                { topic: "Partitioner", score: 41, color: "bg-red-500" },
                { topic: "YARN", score: 38, color: "bg-red-500" },
                { topic: "Combiner", score: 64, color: "bg-amber-500" },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-white text-[10px]">{t.topic}</span>
                      <span className="text-slate-400 text-[10px]">{t.score}%</span>
                    </div>
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${t.color} rounded-full`} style={{ width: `${t.score}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon, title, description, color
}: { icon: React.ElementType; title: string; description: string; color: string }) {
  return (
    <div className="card-hover p-6 group">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-200`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <div>
        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h4>
        <p className="text-slate-600 dark:text-slate-400 text-sm">{desc}</p>
      </div>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 overflow-x-hidden transition-colors duration-200">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrollY > 20 ? "bg-white/90 dark:bg-[#07090e]/90 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-white/[0.08]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
              StudyOS <span className="text-emerald-500">AI</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it Works", "Interview Mode"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/auth" className="btn-outline text-sm hidden sm:flex">
              Sign In
            </Link>
            <Link href="/auth?tab=register" className="btn-primary text-sm">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              AI-Powered Student Productivity Workspace
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-4">
              Your Knowledge.<br />
              Your AI Tutor.<br />
              <span className="text-emerald-600 dark:text-emerald-400">All in One Workspace.</span>
            </h1>

            {/* Live IST Time & Date */}
            <div className="mb-6">
              <ISTClockBadge />
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-base lg:text-lg mb-8 max-w-xl leading-relaxed">
              Turn your lecture notes, PDFs, syllabus, and study materials into a personalized AI learning workspace with grounded explanations, smart study plans, and diagnostic quizzes.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/auth?tab=register"
                className="btn-primary text-sm px-6 py-3 shadow-md shadow-emerald-500/20 font-semibold flex items-center justify-center gap-2">
                Start Learning Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works"
                className="btn-secondary text-sm px-6 py-3 font-semibold flex items-center justify-center gap-2">
                Explore Features
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="flex items-center gap-6 mt-10">
              {[
                { icon: Users, label: "University Ready" },
                { icon: Star, label: "Strict Grounded AI" },
                { icon: Award, label: "Free for Students" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-medium">
                  <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="hidden lg:block">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Problem Section ────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-100/70 dark:bg-[#0a0e1a] border-y border-slate-200 dark:border-white/[0.06] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              The Problem Every Student Faces
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Your study materials are scattered across dozens of places. StudyOS AI brings them together.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileText, label: "PDFs & DOCX", q: "What's in my 200-page PDF?" },
              { icon: Video, label: "YouTube Lectures", q: "What did the professor say at 1:23:00?" },
              { icon: Mic, label: "Audio Recordings", q: "What was covered in my voice notes?" },
              { icon: ImageIcon, label: "Handwritten Notes", q: "Can AI read my handwriting?" },
            ].map(({ icon: Icon, label, q }) => (
              <div key={label} className="card-hover p-6 text-center border border-slate-200 dark:border-white/[0.08]">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="font-semibold text-slate-900 dark:text-white mb-2">{label}</div>
                <div className="text-slate-600 dark:text-slate-400 text-sm italic">"{q}"</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-base">
              <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              StudyOS AI understands all of them — and creates your personal tutor from them.
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-white dark:bg-[#07090e]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              How StudyOS AI Works
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Upload once. Learn intelligently. Know exactly what to study next.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8">
              <StepCard num="1" title="Upload Your Materials" desc="PDFs, DOCX, PPTs, YouTube URLs, audio recordings, images — everything in one place." />
              <StepCard num="2" title="AI Processing Pipeline" desc="Text extraction, OCR, speech-to-text, semantic chunking, and vector embedding happens automatically." />
              <StepCard num="3" title="Ask Your AI Tutor" desc="Ask any question. Get answers grounded in your own materials with source citations." />
              <StepCard num="4" title="Discover Your Gaps" desc="Knowledge graph identifies weak topics. Adaptive quizzes pinpoint exactly what you don't know." />
              <StepCard num="5" title="Get Your Study Plan" desc="Personalized daily plan based on exam date, mastery scores, and available study time." />
              <StepCard num="6" title="Ace Your Interviews" desc="Interview mode prepares you for placements with AI-powered mock technical interviews." />
            </div>
            <div className="space-y-4">
              {[
                { title: "Retrieval-Augmented Generation", desc: "Answers grounded in your actual materials, not hallucinated responses.", color: "bg-emerald-500" },
                { title: "Knowledge Gap Detection", desc: "Identifies exactly which concepts need more attention based on quiz performance.", color: "bg-sky-500" },
                { title: "Adaptive Quiz Engine", desc: "Questions adapt in difficulty based on how well you're performing.", color: "bg-purple-500" },
                { title: "Spaced Repetition", desc: "Schedules revision at optimal intervals to maximize long-term retention.", color: "bg-amber-500" },
                { title: "Exam Readiness Score", desc: "Composite score from mastery + quiz accuracy + revision activity.", color: "bg-rose-500" },
              ].map((item) => (
                <div key={item.title} className="card-hover p-5 flex gap-4 items-start border border-slate-200 dark:border-white/[0.08]">
                  <div className={`w-2 h-2 rounded-full ${item.color} mt-2 flex-shrink-0`} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white mb-1">{item.title}</div>
                    <div className="text-slate-600 dark:text-slate-400 text-sm">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-slate-100/70 dark:bg-[#0a0e1a] border-y border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything You Need to Learn Smarter
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={Upload} color="bg-emerald-500" title="Universal Knowledge Vault"
              description="Upload PDFs, DOCX, PPTs, audio, images, or add YouTube URLs. Everything processed by AI." />
            <FeatureCard icon={MessageSquare} color="bg-sky-500" title="AI Tutor with Citations"
              description="Ask questions in natural language. Get answers from your own materials with exact source references." />
            <FeatureCard icon={Network} color="bg-purple-500" title="Interactive Knowledge Graph"
              description="Visualize how concepts relate to each other. Click any node to explore, quiz, and revise." />
            <FeatureCard icon={Target} color="bg-rose-500" title="Knowledge Gap Detection"
              description="Instantly know what you don't know. AI identifies weak areas and recommends focused revision." />
            <FeatureCard icon={Zap} color="bg-amber-500" title="Adaptive Quiz Engine"
              description="MCQs, T/F, short answers — all generated from your materials. Difficulty adjusts automatically." />
            <FeatureCard icon={BarChart3} color="bg-teal-500" title="Exam Readiness Dashboard"
              description="Set your exam date. See topic-by-topic readiness. Get a countdown-based revision plan." />
            <FeatureCard icon={TrendingUp} color="bg-indigo-500" title="Personalized Study Plans"
              description="Daily plans generated from your mastery scores, exam date, and available study time." />
            <FeatureCard icon={Brain} color="bg-pink-500" title="Interview Mode"
              description="AI conducts real mock interviews. Evaluates depth, clarity, and technical correctness." />
            <FeatureCard icon={Shield} color="bg-slate-600" title="Secure & Private"
              description="Your materials are private. Strict user isolation. Secure JWT authentication with OTP." />
          </div>
        </div>
      </section>

      {/* ── AI Capabilities ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white dark:bg-[#07090e]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Explain at My Level
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              The same concept explained differently based on who's asking.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { level: "Beginner", color: "border-emerald-500", badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                example: "MapReduce is like sorting a huge pile of mail: split it into groups, each person sorts their group, then combine all sorted piles." },
              { level: "B.Tech Student", color: "border-sky-500", badge: "bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/30",
                example: "MapReduce is a programming model for processing large datasets in parallel across a cluster. It has two phases: Map (key-value pairs) and Reduce (aggregation)." },
              { level: "Exam Level", color: "border-purple-500", badge: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30",
                example: "Definition: MapReduce is a distributed computing paradigm...\nWorking: Phase 1 (Map): Input split, key-value generation...\nPhase 2 (Reduce): Shuffle, sort, aggregate..." },
              { level: "Interview", color: "border-amber-500", badge: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30",
                example: '"MapReduce divides processing into Map and Reduce phases, enabling horizontal scaling." Follow-ups: How does fault tolerance work? What is the role of the combiner?' },
            ].map((item) => (
              <div key={item.level} className={`card-hover border-t-4 ${item.color} p-6 border border-slate-200 dark:border-white/[0.08]`}>
                <span className={`${item.badge} text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block`}>
                  {item.level}
                </span>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">
                  "{item.example}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interview Mode ─────────────────────────────────────────────────── */}
      <section id="interview-mode" className="py-24 bg-slate-100/70 dark:bg-[#0a0e1a] border-y border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400 text-sm font-medium mb-6">
                <Brain className="w-4 h-4" /> Interview Mode
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-6">
                Practice Real Technical Interviews
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                Select any topic — Python, DBMS, ML, OS, System Design, or your own project.
                The AI interviews you, evaluates your answers for technical accuracy, completeness, and clarity,
                then asks progressive follow-up questions.
              </p>
              <div className="space-y-3">
                {[
                  "AI evaluates technical depth & clarity",
                  "Progressive difficulty — easy → advanced",
                  "Project Viva mode for final year projects",
                  "Personalized based on your uploaded materials",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Mock interview UI */}
            <div className="card-glass p-6 space-y-4 border border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">Machine Learning Interview</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs">Question 3 of 10 · Medium difficulty</div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
                <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Interviewer</div>
                <div className="text-slate-900 dark:text-white text-sm">"What is overfitting in machine learning, and how can it be reduced?"</div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="text-emerald-700 dark:text-emerald-400 text-xs mb-1">Your Answer</div>
                <div className="text-slate-900 dark:text-white text-sm">Overfitting occurs when a model learns the training data too well, including noise...</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] rounded-xl p-4">
                <div className="text-slate-500 dark:text-slate-400 text-xs mb-2">AI Feedback</div>
                <div className="flex gap-4 mb-2">
                  {[["Accuracy", "85%", "text-emerald-600 dark:text-emerald-400"], ["Depth", "72%", "text-sky-600 dark:text-sky-400"], ["Clarity", "90%", "text-purple-600 dark:text-purple-400"]].map(([label, val, color]) => (
                    <div key={label} className="text-center">
                      <div className={`font-bold ${color}`}>{val}</div>
                      <div className="text-slate-500 text-[10px]">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-slate-700 dark:text-slate-300 text-xs">Good explanation. You missed mentioning cross-validation. Next: "How does dropout prevent overfitting?"</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security Section ──────────────────────────────────────────────── */}
      <section className="py-24 bg-white dark:bg-[#07090e]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Your Data is Yours. Always.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-xl mx-auto">
            Every user's materials, chat history, quiz results, and knowledge graph are completely isolated.
            You can never access another user's data — by design.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { label: "bcrypt Password Hashing", desc: "Passwords are never stored in plain text." },
              { label: "OTP Verification", desc: "SHA-256 hashed OTPs with 5-minute expiry." },
              { label: "JWT Authentication", desc: "Secure stateless tokens for every request." },
            ].map((item) => (
              <div key={item.label} className="card-hover p-6 text-center border border-slate-200 dark:border-white/[0.08]">
                <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mx-auto mb-3" />
                <div className="font-semibold text-slate-900 dark:text-white mb-1 text-sm">{item.label}</div>
                <div className="text-slate-600 dark:text-slate-400 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────────────── */}
      <section className="py-24 hero-gradient">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
            Ready to Transform<br />
            <span className="text-emerald-600 dark:text-emerald-400">How You Study?</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join thousands of students who turned scattered materials into a personalized learning system.
          </p>
          <Link href="/auth?tab=register"
            className="btn-primary text-lg px-10 py-4 shadow-xl shadow-emerald-500/30">
            Start Learning Free
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="text-slate-500 dark:text-slate-500 mt-4 text-sm">No credit card required · Free to get started</p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">StudyOS AI</span>
            </div>
            <p className="text-slate-600 dark:text-slate-500 text-sm text-center">
              Your Knowledge. Your Tutor. Your Learning Intelligence.
            </p>
            <p className="text-slate-500 dark:text-slate-600 text-sm">
              © 2025 StudyOS AI. Built for students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
