"use client";

import { useState } from "react";
import {
  Sparkles, Download, Bookmark, Loader2,
  CheckCircle2, BookOpen, Layers, X
} from "lucide-react";
import { studyToolsApi, notesApi, getErrorMessage } from "@/lib/api";
import { exportStudyNotesToPdf } from "@/lib/pdfExport";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";

interface RevisionNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  subject?: string;
  unit?: string;
}

export function RevisionNotesModal({
  isOpen,
  onClose,
  initialTopic = "",
  subject = "Engineering Subject",
  unit,
}: RevisionNotesModalProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    topic: string;
    source_label?: string;
    sources?: any[];
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or concept to generate revision notes.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await studyToolsApi.generateRevisionNotes({
        topic: topic.trim(),
        subject,
        unit,
      });
      setResult(data);
      toast.success("Revision notes generated successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToNotes = async () => {
    if (!result?.content) return;
    setSavingNote(true);
    try {
      await notesApi.create({
        title: `Revision Notes: ${result.topic}`,
        content: result.content,
        tags: ["revision", "exam-notes", subject.toLowerCase()],
      });
      toast.success("Saved to Study Notes!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const handleExportPdf = () => {
    if (!result?.content) return;
    exportStudyNotesToPdf({
      title: `Revision Notes — ${result.topic}`,
      subtitle: "High-Yield Concepts, Definitions, Formulas & Diagrams",
      subject,
      items: [
        {
          question: `High-Yield Revision Notes: ${result.topic}`,
          answer: result.content,
          sources: result.sources,
          sourceLabel: result.source_label || "Uploaded Notes",
        },
      ],
      includeSources: true,
    });
    toast.success("Opening PDF export preview...");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Generate Revision Notes
                <span className="text-[10px] py-0.5 px-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                  Exam Ready
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Important concepts, definitions, key points, formulas, examples, diagrams & 15-min recap
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

        {/* Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.01]">
          <div className="flex gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
              placeholder="Enter topic or question (e.g. TCP vs UDP, Process Scheduling, Normalization)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-amber-500 shadow-xs"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all flex-shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Notes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Synthesizing verified revision notes...
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Consulting uploaded materials and curriculum to extract core concepts, definitions, formulas, and diagrams.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Attribution Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Primary Source: <strong>{result.source_label || "Uploaded Course Materials"}</strong>
                  </span>
                </div>
                <span className="font-semibold text-[10px] uppercase tracking-wider">
                  Full 100% Exam Coverage
                </span>
              </div>

              {/* Formatted Markdown */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10">
                <MarkdownRenderer content={result.content} />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
              <div className="text-sm font-medium">Ready to create revision notes</div>
              <p className="text-xs max-w-md mx-auto">
                Enter any chapter, concept, or topic name above to generate high-yield definitions, exam points, formulas, diagrams, and quick recall takeaways.
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        {result && (
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Ready for download or study note saving</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToNotes}
                disabled={savingNote}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4 text-amber-500" />}
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
