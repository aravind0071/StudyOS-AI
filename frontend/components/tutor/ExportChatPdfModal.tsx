"use client";

import { useState } from "react";
import {
  FileText, Download, CheckSquare, Square,
  CheckCircle2, X
} from "lucide-react";
import { exportStudyNotesToPdf, ExportQAItem } from "@/lib/pdfExport";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  source_label?: string;
  source_detail?: string;
  explain_level?: string;
}

interface ExportChatPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentSessionTitle?: string;
  subject?: string;
  activeMessageId?: string;
}

export function ExportChatPdfModal({
  isOpen,
  onClose,
  messages,
  currentSessionTitle = "AI Tutor Study Notes",
  subject = "All Subjects",
  activeMessageId,
}: ExportChatPdfModalProps) {
  // Extract Q&A pairs from conversation
  const qaPairs: Array<{
    id: string;
    question: string;
    answer: string;
    sources?: any[];
    sourceLabel?: string;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      const q = messages[i].content;
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg.role === "assistant" && nextMsg.content) {
        qaPairs.push({
          id: nextMsg.id,
          question: q,
          answer: nextMsg.content,
          sources: nextMsg.sources,
          sourceLabel: nextMsg.source_label,
        });
      }
    }
  }

  const [mode, setMode] = useState<"current" | "selected" | "entire">(
    activeMessageId ? "current" : "entire"
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    qaPairs.map((p) => p.id)
  );
  const [includeSources, setIncludeSources] = useState(true);
  const [docTitle, setDocTitle] = useState(currentSessionTitle || "AI Tutor Study Notes");

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(qaPairs.map((p) => p.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleExport = () => {
    let targetItems: ExportQAItem[] = [];

    if (mode === "current") {
      // Find active or last answer
      const activePair = activeMessageId
        ? qaPairs.find((p) => p.id === activeMessageId)
        : qaPairs[qaPairs.length - 1];

      if (activePair) {
        targetItems = [
          {
            questionNumber: "Q1",
            question: activePair.question,
            answer: activePair.answer,
            sources: activePair.sources,
            sourceLabel: activePair.sourceLabel,
          },
        ];
      }
    } else if (mode === "selected") {
      targetItems = qaPairs
        .filter((p) => selectedIds.includes(p.id))
        .map((p, idx) => ({
          questionNumber: `Q${idx + 1}`,
          question: p.question,
          answer: p.answer,
          sources: p.sources,
          sourceLabel: p.sourceLabel,
        }));
    } else {
      // Entire chat
      targetItems = qaPairs.map((p, idx) => ({
        questionNumber: `Q${idx + 1}`,
        question: p.question,
        answer: p.answer,
        sources: p.sources,
        sourceLabel: p.sourceLabel,
      }));
    }

    if (targetItems.length === 0) {
      toast.error("Please select at least one question and answer to export.");
      return;
    }

    exportStudyNotesToPdf({
      title: docTitle.trim() || "StudyOS AI Study Notes",
      subtitle: "University Semester Notes & Verified Answers",
      subject: subject || "Engineering Course",
      items: targetItems,
      includeSources,
    });

    toast.success("Preparing high-quality A4 PDF for print / download...");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Export Chat to PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate clean, lightweight, searchable A4 study notes
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

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Computer Networks — Module 1 Notes"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
            />
          </div>

          {/* Export Scope Radio Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select What to Export
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode("current")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === "current"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-bold">Current Answer</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Latest/Active Q&A</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("selected")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === "selected"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-bold">Selected Qs</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Pick specific items</div>
              </button>

              <button
                type="button"
                onClick={() => setMode("entire")}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  mode === "entire"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-bold">Entire Chat</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">All ({qaPairs.length}) Q&A</div>
              </button>
            </div>
          </div>

          {/* Selected Questions List when mode is 'selected' */}
          {mode === "selected" && (
            <div className="space-y-2 border border-slate-200 dark:border-white/10 rounded-xl p-3 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200 dark:border-white/10">
                <span>Select questions ({selectedIds.length}/{qaPairs.length}):</span>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    All
                  </button>
                  <span>·</span>
                  <button type="button" onClick={deselectAll} className="text-slate-500 hover:underline">
                    None
                  </button>
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {qaPairs.map((pair, idx) => {
                  const isChecked = selectedIds.includes(pair.id);
                  return (
                    <button
                      key={pair.id}
                      type="button"
                      onClick={() => toggleSelect(pair.id)}
                      className="w-full flex items-start gap-2 p-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          Q{idx + 1}: {pair.question}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {pair.answer.replace(/#|\*|`|\[|\]/g, "").slice(0, 80)}...
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeSources}
                onChange={(e) => setIncludeSources(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Include Primary Grounding Sources & Citations</span>
            </label>
          </div>

          {/* Info pill */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              PDF output includes clean A4 margins, page numbering, tables, headings, and diagrams.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export & Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
