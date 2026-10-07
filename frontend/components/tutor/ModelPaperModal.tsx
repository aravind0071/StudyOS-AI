"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText, Upload, Sparkles, Download, Bookmark,
  Loader2, CheckSquare, Square, CheckCircle2,
  AlertTriangle, BookOpen, ChevronRight, X, RefreshCw
} from "lucide-react";
import { studyToolsApi, notesApi, getErrorMessage } from "@/lib/api";
import { exportStudyNotesToPdf } from "@/lib/pdfExport";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { toast } from "sonner";

interface ExtractedQuestion {
  index: number;
  q_number: string;
  question: string;
  marks?: number;
  answer?: string;
  sources?: any[];
  source_label?: string;
  is_answering?: boolean;
}

interface ModelPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: string;
}

export function ModelPaperModal({
  isOpen,
  onClose,
  subject = "Engineering Subject",
}: ModelPaperModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [extracting, setExtracting] = useState(false);
  const [answeringAll, setAnsweringAll] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevSubjectRef = useRef(subject);

  const handleResetToUpload = () => {
    setQuestions([]);
    setSelectedIndices([]);
    setActiveQuestionIndex(null);
    setFile(null);
    setPasteText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (prevSubjectRef.current !== subject) {
      prevSubjectRef.current = subject;
      handleResetToUpload();
    }
  }, [subject]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      toast.info(`Selected ${f.name}. Click "Extract Questions" to begin.`);
    }
  };

  const handleExtract = async () => {
    if (inputMode === "upload" && !file) {
      toast.error("Please upload a PDF or image question paper.");
      return;
    }
    if (inputMode === "paste" && !pasteText.trim()) {
      toast.error("Please paste the question paper text.");
      return;
    }

    setExtracting(true);
    setQuestions([]);
    setSelectedIndices([]);
    setActiveQuestionIndex(null);

    try {
      let data;
      if (inputMode === "upload" && file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await studyToolsApi.extractModelPaper(formData);
        data = res.data;
      } else {
        const res = await studyToolsApi.extractModelPaperText(pasteText);
        data = res.data;
      }

      const extracted: ExtractedQuestion[] = (data.questions || []).map((q: any) => ({
        index: q.index,
        q_number: q.q_number,
        question: q.question,
        marks: q.marks || 5,
      }));

      if (extracted.length === 0) {
        toast.warning("No distinct questions could be parsed. Try pasting text directly.");
      } else {
        setQuestions(extracted);
        setSelectedIndices(extracted.map((q) => q.index));
        setActiveQuestionIndex(extracted[0]?.index || null);
        toast.success(`Extracted ${extracted.length} questions successfully!`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExtracting(false);
    }
  };

  // Toggle selection for a question
  const toggleSelect = (idx: number) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  };

  const selectAll = () => setSelectedIndices(questions.map((q) => q.index));
  const deselectAll = () => setSelectedIndices([]);

  // Answer a single question
  const answerQuestion = async (qItem: ExtractedQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.index === qItem.index ? { ...q, is_answering: true } : q))
    );

    try {
      const { data } = await studyToolsApi.answerModelPaperQuestion({
        question: {
          index: qItem.index,
          q_number: qItem.q_number,
          question: qItem.question,
          marks: qItem.marks || 5,
        },
        subject,
      });

      setQuestions((prev) =>
        prev.map((q) =>
          q.index === qItem.index
            ? {
                ...q,
                answer: data.answer,
                sources: data.sources,
                source_label: data.source_label,
                is_answering: false,
              }
            : q
        )
      );
      toast.success(`Answered ${qItem.q_number} (${qItem.marks}M)!`);
    } catch (err) {
      toast.error(`Failed to answer ${qItem.q_number}: ${getErrorMessage(err)}`);
      setQuestions((prev) =>
        prev.map((q) => (q.index === qItem.index ? { ...q, is_answering: false } : q))
      );
    }
  };

  // Answer all or selected questions in sequence
  const handleAnswerBatch = async (indicesToAnswer: number[]) => {
    if (indicesToAnswer.length === 0) {
      toast.error("Please select at least one question to answer.");
      return;
    }

    setAnsweringAll(true);
    const toastId = toast.loading(`Answering ${indicesToAnswer.length} questions...`);

    try {
      const targetQuestions = questions.filter((q) => indicesToAnswer.includes(q.index));
      const { data } = await studyToolsApi.answerAllModelPaperQuestions({
        questions: targetQuestions.map((q) => ({
          index: q.index,
          q_number: q.q_number,
          question: q.question,
          marks: q.marks,
        })),
        subject,
      });

      const answersMap = new Map();
      (data.answers || []).forEach((ans: any) => {
        answersMap.set(ans.index, ans);
      });

      setQuestions((prev) =>
        prev.map((q) => {
          const res = answersMap.get(q.index);
          return res
            ? {
                ...q,
                answer: res.answer,
                sources: res.sources,
                source_label: res.source_label,
              }
            : q;
        })
      );

      toast.success(`Successfully answered ${data.total_answered} questions!`, {
        id: toastId,
      });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: toastId });
    } finally {
      setAnsweringAll(false);
    }
  };

  // Save answered questions to Study Notes
  const handleSaveToNotes = async () => {
    const answeredQs = questions.filter((q) => q.answer);
    if (answeredQs.length === 0) {
      toast.error("No answered questions to save. Please generate answers first.");
      return;
    }

    setSavingNotes(true);
    try {
      const fullContent = answeredQs
        .map(
          (q) =>
            `## ${q.q_number} [${q.marks} Marks]: ${q.question}\n\n${q.answer}\n\n---`
        )
        .join("\n\n");

      await notesApi.create({
        title: `Model Paper Solutions: ${file?.name || "Extracted Questions"}`,
        content: fullContent,
        tags: ["model-paper", "solutions", subject.toLowerCase()],
      });

      toast.success("Saved model paper solutions to Study Notes!");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingNotes(false);
    }
  };

  // Export as clean A4 PDF
  const handleExportPdf = () => {
    const answeredQs = questions.filter((q) => q.answer);
    if (answeredQs.length === 0) {
      toast.error("No answers generated yet to export.");
      return;
    }

    const items = answeredQs.map((q) => ({
      questionNumber: q.q_number,
      question: q.question,
      marks: q.marks,
      answer: q.answer || "",
      sources: q.sources,
      sourceLabel: q.source_label || "Uploaded Notes",
    }));

    exportStudyNotesToPdf({
      title: `Model Paper Solutions — ${file?.name || subject}`,
      subtitle: "University Model Examination Answers Calibrated by Marks",
      subject,
      items,
      includeSources: true,
    });

    toast.success("Opening PDF export preview...");
  };

  const activeQuestion = questions.find((q) => q.index === activeQuestionIndex);
  const answeredCount = questions.filter((q) => q.answer).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Model Paper Solver
                <span className="text-[10px] py-0.5 px-2 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-semibold">
                  Auto-Extract & Answer
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a model question paper PDF/image or paste text to extract questions and generate mark-matched answers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {questions.length > 0 && (
              <button
                type="button"
                onClick={handleResetToUpload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 hover:border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition-all shadow-xs"
                title="Upload or paste another model question paper"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New Paper</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Upload / Input Section */}
        {questions.length === 0 && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 max-w-xs">
              <button
                type="button"
                onClick={() => setInputMode("upload")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  inputMode === "upload"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Upload File (PDF / Image)
              </button>
              <button
                type="button"
                onClick={() => setInputMode("paste")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  inputMode === "paste"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Paste Questions Text
              </button>
            </div>

            {inputMode === "upload" ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl p-8 sm:p-12 text-center hover:border-cyan-500 cursor-pointer transition-colors bg-slate-50/50 dark:bg-white/[0.01]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {file.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change file
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Click to upload model question paper
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Supports PDF, JPG, PNG, and WebP formats
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Paste Model Question Paper Text
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={8}
                  placeholder={`1. Explain Checksum algorithm with a worked 16-bit binary problem [5 Marks]
2. Define Stop-and-Wait protocol and calculate its efficiency [2 Marks]
3. Compare OSI Reference Model vs TCP/IP Model in detail with architecture diagram [10 Marks]`}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || (inputMode === "upload" && !file) || (inputMode === "paste" && !pasteText.trim())}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extract Questions & Marks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Questions & Solutions View */}
        {questions.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Action Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {questions.length} Questions Extracted
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {answeredCount} Answered
                </span>
                <span className="text-slate-400">·</span>
                <div className="flex gap-1.5 text-[11px]">
                  <button type="button" onClick={selectAll} className="text-cyan-600 dark:text-cyan-400 hover:underline">
                    Select All
                  </button>
                  <span className="text-slate-400">/</span>
                  <button type="button" onClick={deselectAll} className="text-slate-500 hover:underline">
                    None
                  </button>
                </div>
              </div>

              {/* Action Buttons: Answer All, Answer Selected, Save, Export PDF */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAnswerBatch(selectedIndices)}
                  disabled={answeringAll || selectedIndices.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors"
                >
                  {answeringAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Answer Selected ({selectedIndices.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAnswerBatch(questions.map((q) => q.index))}
                  disabled={answeringAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Answer All</span>
                </button>

                {answeredCount > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveToNotes}
                      disabled={savingNotes}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                    >
                      {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5 text-amber-500" />}
                      <span>Save</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Answer PDF</span>
                    </button>
                  </>
                )}
                {/* New Paper button */}
                <button
                  type="button"
                  onClick={handleResetToUpload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
                  title="Upload another model question paper"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Upload New Paper</span>
                </button>
              </div>
            </div>

            {/* Split Screen Layout: Left Question List, Right Answer Preview */}
            <div className="flex-1 flex overflow-hidden">
              {/* Question List Sidebar */}
              <div className="w-full sm:w-80 border-r border-slate-200 dark:border-white/[0.08] overflow-y-auto p-2 space-y-1.5 bg-slate-50/30 dark:bg-white/[0.01]">
                <div className="px-2 py-1.5 mb-1 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06]">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Questions ({questions.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToUpload}
                    className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                    title="Clear current paper and upload a new one"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload New</span>
                  </button>
                </div>
                {questions.map((q) => {
                  const isSelected = selectedIndices.includes(q.index);
                  const isActive = activeQuestionIndex === q.index;

                  return (
                    <div
                      key={q.index}
                      onClick={() => setActiveQuestionIndex(q.index)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isActive
                          ? "border-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/15"
                          : "border-slate-200/80 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(q.index);
                            }}
                            className="text-slate-400 hover:text-cyan-500"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-cyan-500" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {q.q_number}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                              q.marks === 2
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : q.marks === 5
                                ? "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                                : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            }`}
                          >
                            {q.marks}M
                          </span>
                          {q.answer && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 pl-5">
                        {q.question}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Question & Answer Detail Pane */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {activeQuestion ? (
                  <div className="space-y-4">
                    {/* Question Header Card */}
                    <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-cyan-600 dark:text-cyan-400">
                            {activeQuestion.q_number}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            {activeQuestion.marks} Marks Rubric
                          </span>
                        </div>

                        {!activeQuestion.answer && (
                          <button
                            type="button"
                            onClick={() => answerQuestion(activeQuestion)}
                            disabled={activeQuestion.is_answering}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                          >
                            {activeQuestion.is_answering ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                <span>Generate Answer</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {activeQuestion.question}
                      </div>
                    </div>

                    {/* Answer View */}
                    {activeQuestion.is_answering ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="w-7 h-7 text-cyan-500 animate-spin mx-auto" />
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Consulting your uploaded materials to synthesize {activeQuestion.marks}-marks answer...
                        </div>
                      </div>
                    ) : activeQuestion.answer ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-700 dark:text-cyan-400">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              Source: <strong>{activeQuestion.source_label || "Uploaded Notes"}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] font-bold">
                            Length matched to {activeQuestion.marks} Marks
                          </span>
                        </div>

                        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10">
                          <MarkdownRenderer content={activeQuestion.answer} />
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-slate-400 space-y-2">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Not Answered Yet
                        </div>
                        <p className="text-xs max-w-sm mx-auto text-slate-500">
                          Click <strong>Generate Answer</strong> above or <strong>Answer All</strong> to synthesize answers for all questions.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    Select a question from the left sidebar to preview its solution.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
