"use client";

import { useState } from "react";
import {
  GraduationCap, Download, Bookmark, Loader2,
  CheckCircle2, BookOpen, Award, Binary, X
} from "lucide-react";
import { studyToolsApi, notesApi, getErrorMessage } from "@/lib/api";
import { exportStudyNotesToPdf } from "@/lib/pdfExport";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";

interface ExamNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  subject?: string;
  unit?: string;
}

export function ExamNotesModal({
  isOpen,
  onClose,
  initialTopic = "",
  subject = "Engineering Subject",
  unit,
}: ExamNotesModalProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [selectedTab, setSelectedTab] = useState<"2m" | "5m" | "10m" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [result, setResult] = useState<{
    topic: string;
    marks_2m?: string;
    marks_5m?: string;
    marks_10m?: string;
    combined_content?: string;
    answer?: string;
    source_label?: string;
    sources?: any[];
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a question or topic.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await studyToolsApi.generateExamNotes({
        topic: topic.trim(),
        subject,
        unit,
      });
      setResult(data);
      toast.success("Semester exam notes synthesized for 2M, 5M & 10M!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getActiveContent = (): string => {
    if (!result) return "";
    if (selectedTab === "2m") return result.marks_2m || result.answer || "";
    if (selectedTab === "5m") return result.marks_5m || result.answer || "";
    if (selectedTab === "10m") return result.marks_10m || result.answer || "";
    return result.combined_content || result.answer || "";
  };

  const handleSaveToNotes = async () => {
    const contentToSave = getActiveContent();
    if (!contentToSave) return;

    setSavingNote(true);
    try {
      await notesApi.create({
        title: `Exam Notes (${selectedTab.toUpperCase()}): ${result?.topic}`,
        content: contentToSave,
        tags: ["exam-notes", `${selectedTab}-marks`, subject.toLowerCase()],
      });
      toast.success("Saved to Study Notes!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleExportPdf = () => {
    const content = getActiveContent();
    if (!content || !result) return;

    exportStudyNotesToPdf({
      title: `Exam Notes — ${result.topic}`,
      subtitle: `Semester Examination Ready Rubric (${selectedTab.toUpperCase()})`,
      subject,
      items: [
        {
          question: `University Exam Question: ${result.topic}`,
          marks: selectedTab !== "all" ? selectedTab.toUpperCase() : "2M / 5M / 10M",
          answer: content,
          sources: result.sources,
          sourceLabel: result.source_label || "Uploaded Notes",
        },
      ],
      includeSources: true,
    });
    toast.success("Preparing PDF export preview...");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Generate Exam Notes
                <span className="text-[10px] py-0.5 px-2 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
                  2M · 5M · 10M Rubrics
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accurate, easy to understand, structured and optimized for maximum semester marks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Topic Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.01]">
          <div className="flex gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
              placeholder="Enter exam question (e.g. Dijkstra's Algorithm, Banker's Deadlock Algorithm, OSI Layers)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-purple-500 shadow-xs"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all flex-shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" />
                  <span>Generate Answers</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        {result && (
          <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-100/50 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setSelectedTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === "all"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              All Tiers (Master)
            </button>

            <button
              type="button"
              onClick={() => setSelectedTab("2m")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === "2m"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <Award className="w-3 h-3" />
              <span>2 Marks</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTab("5m")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === "5m"
                  ? "bg-teal-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <Binary className="w-3 h-3" />
              <span>5 Marks</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTab("10m")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedTab === "10m"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>10 Marks</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Synthesizing calibrated semester answers...
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Calibrating strict rubrics: 2 marks (viva/definition), 5 marks (mechanism + diagram), and 10 marks (comprehensive architecture & proof).
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Attribution */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-400">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Primary Grounding: <strong>{result.source_label || "Uploaded Course Materials"}</strong>
                  </span>
                </div>
                <span className="font-semibold text-[10px] uppercase tracking-wider">
                  Verified Exam Standard
                </span>
              </div>

              {/* Formatted Content */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10">
                <MarkdownRenderer content={getActiveContent()} />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <GraduationCap className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
              <div className="text-sm font-medium">Ready to synthesize exam answers</div>
              <p className="text-xs max-w-md mx-auto">
                Enter any question above to generate exact answers tailored to 2 marks (short formula/definition), 5 marks (mechanism + diagram), and 10 marks (complete university semester master breakdown).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Full marks exam structure prepared</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToNotes}
                disabled={savingNote}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4 text-purple-500" />}
                <span>Save to Notes</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
