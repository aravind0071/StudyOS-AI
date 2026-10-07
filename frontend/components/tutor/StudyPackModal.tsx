"use client";

import { useState } from "react";
import {
  Package, Download, Bookmark, Loader2,
  CheckCircle2, BookOpen, Layers, HelpCircle,
  Zap, X
} from "lucide-react";
import { studyToolsApi, notesApi, getErrorMessage } from "@/lib/api";
import { exportStudyNotesToPdf } from "@/lib/pdfExport";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";

interface StudyPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject?: string;
}

export function StudyPackModal({
  isOpen,
  onClose,
  defaultSubject = "Computer Networks",
}: StudyPackModalProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [unit, setUnit] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "revision" | "questions" | "mcqs" | "flashcards" | "diagrams"
  >("all");
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    subject: string;
    unit?: string;
    revision_notes: string;
    important_questions: string;
    mcqs: string;
    flashcards: string;
    diagram: string;
    complete_markdown: string;
    sources?: any[];
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject name.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await studyToolsApi.generateStudyPack({
        subject: subject.trim(),
        unit: unit.trim() || undefined,
      });
      setResult(data);
      toast.success("Complete Study Pack synthesized!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getContentForTab = (): string => {
    if (!result) return "";
    switch (activeTab) {
      case "revision":
        return result.revision_notes;
      case "questions":
        return result.important_questions;
      case "mcqs":
        return result.mcqs;
      case "flashcards":
        return result.flashcards;
      case "diagrams":
        return `## Key Architectural Diagrams\n\n${result.diagram}`;
      case "all":
      default:
        return result.complete_markdown;
    }
  };

  const handleSaveToNotes = async () => {
    if (!result) return;
    setSavingNote(true);
    try {
      await notesApi.create({
        title: result.title,
        content: result.complete_markdown,
        tags: ["study-pack", result.subject.toLowerCase()],
      });
      toast.success("Saved complete Study Pack to Study Notes!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleExportPdf = () => {
    if (!result) return;
    exportStudyNotesToPdf({
      title: result.title,
      subtitle: "Complete All-in-One Semester Examination Study Pack",
      subject: result.subject,
      items: [
        {
          question: `Complete Study Pack: ${result.title}`,
          answer: result.complete_markdown,
          sources: result.sources,
          sourceLabel: "Uploaded Notes & Curriculum Knowledge Base",
        },
      ],
      includeSources: true,
    });
    toast.success("Exporting complete study pack to single A4 PDF...");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Generate Study Pack
                <span className="text-[10px] py-0.5 px-2 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-semibold">
                  All-in-One Bundle
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Revision notes, important questions, exam answers, MCQs, flashcards, concepts & diagrams
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

        {/* Inputs */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.01]">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Operating Systems"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-teal-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit / Module (Optional)
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Unit 2: Process Synchronization"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-teal-500 shadow-xs"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !subject.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all h-[38px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Assembling Pack...</span>
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    <span>Generate Study Pack</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation if result present */}
        {result && (
          <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-100/50 dark:bg-white/[0.02] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "all"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              Complete Pack
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("revision")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "revision"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <Layers className="w-3 h-3" /> Revision Notes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("questions")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "questions"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <BookOpen className="w-3 h-3" /> Top Questions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mcqs")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "mcqs"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <HelpCircle className="w-3 h-3" /> Practice MCQs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flashcards")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "flashcards"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <Zap className="w-3 h-3" /> Flashcards
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diagrams")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "diagrams"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              }`}
            >
              <Layers className="w-3 h-3" /> Diagrams
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Building comprehensive Subject Study Pack...
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Synthesizing revision notes, university exam questions, MCQs, active-recall flashcards, and architectural diagrams.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10">
                <MarkdownRenderer content={getContentForTab()} />
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <Package className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
              <div className="text-sm font-semibold">Generate an All-in-One Study Pack</div>
              <p className="text-xs max-w-md mx-auto">
                Bundles complete revision notes, top university questions (2M/5M/10M), diagnostic MCQs, active recall flashcards, and diagrams into a single cohesive pack.
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        {result && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Full study pack assembled (ready for single-document PDF export)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToNotes}
                disabled={savingNote}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4 text-teal-500" />}
                <span>Save to Notes</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export Complete Pack as PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
