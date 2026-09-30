"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X, ExternalLink, Download, FileText, Image as ImgIcon, Video,
  Sparkles, ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut,
  RotateCcw, Bot, BookOpen, Layers, CheckCircle2, Clock, Globe,
  AlertCircle, Share2, Copy, Check
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { materialsApi, subjectsApi } from "@/lib/api";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export interface PreviewItem {
  id: string;
  title: string;
  type: string; // pdf, pptx, docx, image, youtube, website, video, notes
  source?: "vault" | "resource";
  file_url?: string;
  source_url?: string;
  subject?: string;
  page_count?: number;
  file_size_bytes?: number;
  detected_topics?: string[];
  description?: string;
}

interface ChunkItem {
  id: string;
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  content: string;
  timestamp_start?: number;
}

interface FilePreviewModalProps {
  item: PreviewItem | null;
  onClose: () => void;
}

export default function FilePreviewModal({ item, onClose }: FilePreviewModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"file" | "chunks" | "summary">("file");
  const [loadingContent, setLoadingContent] = useState(false);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchChunkQuery, setSearchChunkQuery] = useState("");

  if (!item) return null;

  const itemType = (item.type || "").toLowerCase();
  const isVault = item.source !== "resource";

  // Derive direct file URL with token
  const token = typeof window !== "undefined" ? localStorage.getItem("studyos_token") : "";
  const fileUrl = isVault
    ? materialsApi.getFileUrl(item.id, token || "")
    : subjectsApi.getResourceFileUrl(item.id, token || "");

  const directViewUrl = item.source_url || fileUrl;

  // Load extracted content chunks
  useEffect(() => {
    let isMounted = true;
    setLoadingContent(true);

    const fetchContent = async () => {
      try {
        if (isVault) {
          const res = await materialsApi.getContent(item.id);
          if (isMounted && res.data?.chunks) {
            setChunks(res.data.chunks);
          }
        } else {
          const res = await subjectsApi.getResourceContent(item.id);
          if (isMounted && res.data?.chunks) {
            setChunks(res.data.chunks);
          }
        }
      } catch (e) {
        // Fallback or empty chunks
      } finally {
        if (isMounted) setLoadingContent(false);
      }
    };

    fetchContent();
    return () => {
      isMounted = false;
    };
  }, [item.id, isVault]);

  // Group chunks by page/slide
  const slidesMap = new Map<number, ChunkItem[]>();
  chunks.forEach((c) => {
    const p = c.page_number || c.chunk_index + 1;
    if (!slidesMap.has(p)) slidesMap.set(p, []);
    slidesMap.get(p)!.push(c);
  });
  const pageNumbers = Array.from(slidesMap.keys()).sort((a, b) => a - b);
  const totalSlides = pageNumbers.length || (item.page_count || 1);
  const activePageNumber = pageNumbers[currentSlideIdx] || currentSlideIdx + 1;
  const currentSlideChunks = slidesMap.get(activePageNumber) || [];

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(directViewUrl);
      setCopiedLink(true);
      toast.success("File link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleAskTutor = () => {
    onClose();
    const query = encodeURIComponent(`Explain concepts from "${item.title}"`);
    router.push(`/tutor?prompt=${query}`);
  };

  const handleGenerateQuiz = () => {
    onClose();
    const topic = encodeURIComponent(item.detected_topics?.[0] || item.title);
    router.push(`/quizzes?topic=${topic}`);
  };

  // Extract YouTube ID if applicable
  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/shorts\/|\/embed\/|\/v\/|youtu\.be\/)([0-9A-Za-z_-]{11})/);
    return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=0&rel=0` : null;
  };
  const ytEmbed = itemType === "youtube" ? getYouTubeEmbedUrl(item.source_url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[950px] bg-white dark:bg-[#0c121e] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {itemType === "image" ? (
                <ImgIcon className="w-5 h-5 text-purple-500" />
              ) : itemType === "youtube" ? (
                <YoutubeIcon className="w-5 h-5 text-red-500" />
              ) : itemType === "pptx" ? (
                <FileText className="w-5 h-5 text-orange-500" />
              ) : itemType === "pdf" ? (
                <FileText className="w-5 h-5 text-red-500" />
              ) : (
                <FileText className="w-5 h-5 text-emerald-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  {item.title}
                </h2>
                <span className="badge badge-slate uppercase text-[10px] shrink-0 font-bold">
                  {item.type}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                {item.subject && <span>{item.subject}</span>}
                {item.page_count ? <span>• {item.page_count} Pages / Slides</span> : null}
                {item.file_size_bytes ? (
                  <span>• {(item.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAskTutor}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
              title="Ask AI Tutor questions based on this file"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Tutor</span>
            </button>

            <a
              href={directViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
              title="Open file in full browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in Tab</span>
            </a>

            {fileUrl && (
              <a
                href={fileUrl}
                download={item.title}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                title="Download original file"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Copy link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ml-1 cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c121e] shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("file")}
              className={clsx(
                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2",
                activeTab === "file"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {itemType === "image"
                  ? "Image Preview"
                  : itemType === "pptx"
                  ? "Presentation View"
                  : itemType === "youtube"
                  ? "Video Player"
                  : "Document View"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chunks")}
              className={clsx(
                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2",
                activeTab === "chunks"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Extracted Slides & Text ({chunks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={clsx(
                "px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2",
                activeTab === "summary"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Study Summary</span>
            </button>
          </div>

          {/* Quick Quiz launcher */}
          <button
            type="button"
            onClick={handleGenerateQuiz}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Practice Quiz for this file</span>
          </button>
        </div>

        {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-slate-100/70 dark:bg-black/40 p-4 relative">
          
          {/* ── 1. FILE PREVIEW ────────────────────────────────────────────── */}
          {activeTab === "file" && (
            <div className="h-full flex flex-col items-center justify-center">
              {/* IMAGE VIEWER */}
              {itemType === "image" && (
                <div className="h-full w-full flex flex-col items-center justify-center relative">
                  {/* Floating Zoom Bar */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
                      className="p-1 hover:text-emerald-400"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs px-1 font-mono">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, z + 0.2))}
                      className="p-1 hover:text-emerald-400"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="p-1 hover:text-emerald-400 ml-1 border-l border-white/20 pl-2"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-auto max-h-full max-w-full flex items-center justify-center p-4">
                    <img
                      src={fileUrl}
                      alt={item.title}
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                      className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-xl transition-transform duration-200"
                    />
                  </div>
                </div>
              )}

              {/* YOUTUBE VIEWER */}
              {itemType === "youtube" && (
                <div className="w-full h-full max-w-4xl flex flex-col items-center justify-center">
                  {ytEmbed ? (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-black">
                      <iframe
                        src={ytEmbed}
                        title={item.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10">
                      <YoutubeIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                      <p className="font-semibold text-slate-800 dark:text-slate-200">YouTube Video</p>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary mt-4 inline-flex items-center gap-2 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open on YouTube
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* PDF & DOCUMENT VIEWER */}
              {(itemType === "pdf" || itemType === "docx" || itemType === "pptx") && (
                <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c121e]">
                  {/* PPTX slide switcher toolbar if PPTX */}
                  {itemType === "pptx" && pageNumbers.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Slide {currentSlideIdx + 1} of {pageNumbers.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={currentSlideIdx === 0}
                          onClick={() => setCurrentSlideIdx((i) => Math.max(0, i - 1))}
                          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-1 text-slate-700 dark:text-slate-300"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Prev Slide
                        </button>
                        <button
                          type="button"
                          disabled={currentSlideIdx >= pageNumbers.length - 1}
                          onClick={() => setCurrentSlideIdx((i) => Math.min(pageNumbers.length - 1, i + 1))}
                          className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-1 text-slate-700 dark:text-slate-300"
                        >
                          Next Slide <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Native Embed or Slide Viewer */}
                  <iframe
                    src={fileUrl}
                    title={item.title}
                    className="w-full flex-1 border-0 rounded-b-xl"
                  />
                </div>
              )}

              {/* NOTES / WEBSITE */}
              {(itemType === "notes" || itemType === "website") && (
                <div className="w-full max-w-3xl h-full overflow-auto p-6 bg-white dark:bg-[#0c121e] rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg space-y-4">
                  <div className="pb-3 border-b border-slate-100 dark:border-white/5">
                    <span className="badge badge-slate uppercase text-[10px]">{itemType}</span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                    )}
                  </div>

                  {chunks.length > 0 ? (
                    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {chunks.map((c, i) => (
                        <div key={c.id || i} className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                          {c.section_title && (
                            <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">
                              {c.section_title}
                            </h4>
                          )}
                          <p className="whitespace-pre-line">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <p>Content is being indexed or no raw text available.</p>
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary mt-4 inline-flex items-center gap-2 text-xs"
                        >
                          <Globe className="w-3.5 h-3.5" /> Visit Original Article
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 2. EXTRACTED SLIDES & TEXT CHUNKS ─────────────────────────── */}
          {activeTab === "chunks" && (
            <div className="h-full max-w-4xl mx-auto flex flex-col space-y-3">
              {/* Search inside chunks */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchChunkQuery}
                  onChange={(e) => setSearchChunkQuery(e.target.value)}
                  placeholder="Search slides, key terms, or extracted notes..."
                  className="input-field pl-9 py-2 text-xs"
                />
              </div>

              <div className="flex-1 overflow-auto space-y-3 pr-1">
                {chunks
                  .filter((c) =>
                    !searchChunkQuery ||
                    c.content.toLowerCase().includes(searchChunkQuery.toLowerCase()) ||
                    (c.section_title && c.section_title.toLowerCase().includes(searchChunkQuery.toLowerCase()))
                  )
                  .map((chunk, idx) => (
                    <div
                      key={chunk.id || idx}
                      className="p-4 rounded-xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-white/10 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {chunk.page_number
                            ? `Slide / Page ${chunk.page_number}`
                            : `Section ${idx + 1}`}
                        </span>
                        {chunk.timestamp_start !== undefined && (
                          <span className="font-mono text-[11px]">
                            {Math.floor(chunk.timestamp_start / 60)}:
                            {String(Math.floor(chunk.timestamp_start % 60)).padStart(2, "0")}
                          </span>
                        )}
                      </div>

                      {chunk.section_title && (
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {chunk.section_title}
                        </h4>
                      )}

                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  ))}

                {chunks.length === 0 && (
                  <div className="py-16 text-center text-slate-400">
                    <p>No extracted text chunks found for this file.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 3. AI STUDY SUMMARY ────────────────────────────────────────── */}
          {activeTab === "summary" && (
            <div className="h-full max-w-3xl mx-auto overflow-auto p-6 bg-white dark:bg-[#0c121e] rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg space-y-6">
              <div>
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Study Breakdown</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {item.title}
                </h3>
              </div>

              {/* Detected Topics */}
              {item.detected_topics && item.detected_topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Key Topics Covered
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {item.detected_topics.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fast Study Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAskTutor}
                  className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-all group"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    <Bot className="w-4 h-4" />
                    <span>Ask AI Tutor</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Get structured 2-mark, 5-mark, and 10-mark semester exam answers from this file.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  className="p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 bg-slate-50 dark:bg-white/[0.02] text-left transition-all group"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-500">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Practice Adaptive Quiz</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Test your understanding with 10 high-yield university multiple choice questions.
                  </p>
                </button>
              </div>

              {/* Document Overview statistics */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Document Metadata
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                  <div>
                    <span className="text-slate-400 block">Total Slides / Pages:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {totalSlides}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Extracted Chunks:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {chunks.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status:</span>
                    <span className="font-semibold text-emerald-500">Indexed & Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>StudyOS AI File Engine</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
