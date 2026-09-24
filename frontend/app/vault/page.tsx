"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload, FileText, Video, Mic, Globe, Image as ImgIcon,
  X, CheckCircle, Clock, AlertCircle, Loader2, Plus, Link as LinkIcon,
  Trash2, Filter, RefreshCw, ExternalLink, Sparkles
} from "lucide-react";
import { materialsApi, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import clsx from "clsx";
import { useEffect } from "react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, docx: FileText, pptx: FileText,
  image: ImgIcon, audio: Mic, youtube: Video, website: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  pdf: "text-red-400 bg-red-500/10",
  docx: "text-blue-400 bg-blue-500/10",
  pptx: "text-orange-400 bg-orange-500/10",
  image: "text-purple-400 bg-purple-500/10",
  audio: "text-pink-400 bg-pink-500/10",
  youtube: "text-red-400 bg-red-500/10",
  website: "text-sky-400 bg-sky-500/10",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    completed: { label: "Ready", cls: "badge-green", icon: CheckCircle },
    processing: { label: "Generating embeddings...", cls: "badge-yellow", icon: Clock },
    pending: { label: "Processing...", cls: "badge-blue", icon: Clock },
    uploading: { label: "Uploading...", cls: "badge-yellow", icon: Loader2 },
    failed: { label: "Failed", cls: "badge-red", icon: AlertCircle },
  };
  const { label, cls, icon: Icon } = map[status] || { label: "Processing...", cls: "badge-slate", icon: Clock };
  return (
    <span className={`badge ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

export default function VaultPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlType, setUrlType] = useState("youtube");
  const [filter, setFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = async () => {
    try {
      const { data } = await materialsApi.list();
      setMaterials(data || []);
    } catch (err) {
      toast.error("Failed to load materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMaterials(); }, []);

  // Automatically poll every 3 seconds while materials are in pending or processing state
  useEffect(() => {
    const hasPending = materials.some(
      (m) => m.status === "pending" || m.status === "processing"
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      materialsApi.list().then(({ data }) => {
        if (data) setMaterials(data);
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [materials]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      setUploading(true);
      try {
        await materialsApi.upload(formData);
        toast.success(`"${file.name}" uploaded! AI processing started.`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("studyos-notify", {
              detail: {
                id: "mat-" + Date.now(),
                title: "Material Uploaded",
                message: `"${file.name}" has been uploaded and queued for neural indexing.`,
                category: "vault",
                timestamp: "Just now",
                read: false,
                link: "/vault",
                actionText: "View Vault",
              },
            })
          );
        }
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${getErrorMessage(err)}`);
      } finally {
        setUploading(false);
      }
    }
    await loadMaterials();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const handleUrlAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error("Please enter a valid URL.");
      return;
    }

    let finalUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }

    // Auto-detect YouTube or Website from URL
    const isYt = finalUrl.includes("youtube.com") || finalUrl.includes("youtu.be") || urlType === "youtube";
    const detectedType = isYt ? "youtube" : "website";

    // Auto title fallback if user leaves blank
    let finalTitle = urlTitle.trim();
    if (!finalTitle) {
      if (detectedType === "youtube") {
        finalTitle = "YouTube Video";
      } else {
        try {
          const parsed = new URL(finalUrl);
          finalTitle = `Article from ${parsed.hostname.replace(/^www\./, "")}`;
        } catch {
          finalTitle = "Website Article";
        }
      }
    }

    const formData = new FormData();
    formData.append("url", finalUrl);
    formData.append("title", finalTitle);
    formData.append("url_type", detectedType);

    setUploading(true);
    try {
      await materialsApi.addUrl(formData);
      toast.success(`${detectedType === "youtube" ? "YouTube video" : "Website article"} added! AI processing started.`);
      setUrlInput("");
      setUrlTitle("");
      setShowUrlForm(false);
      await loadMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await materialsApi.delete(id);
      toast.success("Material deleted.");
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRetry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await materialsApi.retry(id);
      toast.success("AI processing restarted!");
      await loadMaterials();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = filter === "all" ? materials : materials.filter(m => m.type === filter);
  const counts = materials.reduce((acc, m) => ({ ...acc, [m.type]: (acc[m.type] || 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" /> Knowledge Vault
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{materials.length} material{materials.length !== 1 ? "s" : ""} · All processed by AI</p>
        </div>
        <button onClick={() => setShowUrlForm(v => !v)}
          className="btn-secondary flex items-center gap-2">
          <LinkIcon className="w-4 h-4" /> Add URL
        </button>
      </div>

      {/* URL Form */}
      {showUrlForm && (
        <div className="card p-6 border border-emerald-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl shadow-emerald-500/5 animate-fadeIn space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                  <LinkIcon className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Learning Resource from Web
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste any YouTube video or webpage. StudyOS AI extracts transcripts, text, concepts, and generates flashcards automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUrlForm(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Resource Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUrlType("youtube")}
                className={clsx(
                  "p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer",
                  urlType === "youtube"
                    ? "bg-red-500/10 border-red-500/50 shadow-sm ring-1 ring-red-500/30"
                    : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-slate-800/40"
                )}
              >
                <div className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  urlType === "youtube" ? "bg-red-500 text-white shadow-md shadow-red-500/25" : "bg-red-500/10 text-red-500"
                )}>
                  <Video className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                    <span>YouTube Video</span>
                    {urlType === "youtube" && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Transcripts, lecture notes & timestamps
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUrlType("website")}
                className={clsx(
                  "p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5 cursor-pointer",
                  urlType === "website"
                    ? "bg-sky-500/10 border-sky-500/50 shadow-sm ring-1 ring-sky-500/30"
                    : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-slate-800/40"
                )}
              >
                <div className={clsx(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  urlType === "website" ? "bg-sky-500 text-white shadow-md shadow-sky-500/25" : "bg-sky-500/10 text-sky-500"
                )}>
                  <Globe className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Website / Article</span>
                    {urlType === "website" && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Articles, documentation & tutorials
                  </p>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleUrlAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* URL Field */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    {urlType === "youtube" ? <Video className="w-3.5 h-3.5 text-red-500" /> : <Globe className="w-3.5 h-3.5 text-sky-500" />}
                    {urlType === "youtube" ? "YouTube Video URL" : "Webpage URL"} *
                  </span>
                  <span className="text-[11px] text-emerald-500 font-medium">Auto-detects format</span>
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUrlInput(val);
                    if (val.includes("youtube.com") || val.includes("youtu.be")) {
                      setUrlType("youtube");
                    }
                  }}
                  placeholder={
                    urlType === "youtube"
                      ? "https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      : "https://en.wikipedia.org/... or https://docs.python.org/..."
                  }
                  className="input-field"
                  required
                />
              </div>

              {/* Title Field (Optional) */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Title / Topic Name
                  </span>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </label>
                <input
                  type="text"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="e.g., Introduction to Neural Networks (Optional)"
                  className="input-field"
                />
              </div>
            </div>

            {/* Hint & Actions row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 w-full sm:w-auto">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>AI will extract key concepts, create summaries & build practice quizzes.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowUrlForm(false)}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !urlInput.trim()}
                  className="btn-primary px-5 py-2 text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to Vault</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Upload drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 bg-white/60 dark:bg-slate-900/40 shadow-sm",
          dragging
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 hover:bg-emerald-500/5 dark:hover:bg-slate-800/60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.mp4"
          onChange={e => handleFileUpload(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-slate-800 dark:text-slate-200 font-medium">Uploading and processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className={clsx("w-10 h-10 transition-colors", dragging ? "text-emerald-500" : "text-slate-400")} />
            <div>
              <p className="text-slate-900 dark:text-slate-100 font-semibold">Drop files here or click to upload</p>
              <p className="text-slate-500 text-sm mt-1">PDF, DOCX, PPTX, Images, Audio · Max 50MB per file</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {[
                { icon: FileText, label: "PDF" },
                { icon: FileText, label: "DOCX" },
                { icon: FileText, label: "PPTX" },
                { icon: ImgIcon, label: "Images" },
                { icon: Mic, label: "Audio" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1 badge badge-slate">
                  <Icon className="w-3 h-3" /> {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["all", "pdf", "docx", "pptx", "image", "audio", "youtube", "website"].map(type => (
          <button key={type}
            type="button"
            onClick={() => setFilter(type)}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              filter === type
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/70 border border-transparent hover:border-slate-300 dark:hover:border-white/10")}>
            {type === "all" ? `All (${materials.length})` : `${type.toUpperCase()} (${counts[type] || 0})`}
          </button>
        ))}
      </div>

      {/* Materials grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="card h-40 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Upload className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No materials found. Upload your first learning material to get started!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m: any) => {
            const Icon = TYPE_ICONS[m.type] || FileText;
            const colorCls = TYPE_COLORS[m.type] || "text-slate-400 bg-slate-700";
            return (
              <div key={m.id} className="card-hover p-5 flex flex-col gap-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-xl ${colorCls} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <button onClick={() => handleDelete(m.id, m.title)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm leading-snug mb-1">
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={m.status} />
                    {m.status === "failed" && (
                      <button
                        type="button"
                        onClick={(e) => handleRetry(m.id, e)}
                        className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Retry processing"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                    <span className="badge badge-slate">{m.type.toUpperCase()}</span>
                    {m.subject && <span className="badge badge-blue">{m.subject}</span>}
                  </div>
                </div>
                {m.detected_topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.detected_topics.slice(0, 4).map((t: string) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                        {t}
                      </span>
                    ))}
                    {m.detected_topics.length > 4 && (
                      <span className="text-[11px] text-slate-500">+{m.detected_topics.length - 4} more</span>
                    )}
                  </div>
                )}
                {m.source_url && (
                  <div className="pt-0.5">
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium hover:underline truncate max-w-full"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{m.type === "youtube" ? "Watch on YouTube" : "Visit Webpage"}</span>
                    </a>
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-auto flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                  <span>{m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}</span>
                  <span>
                    {m.type === "youtube"
                      ? "Video Transcript"
                      : m.type === "website"
                      ? "Web Article"
                      : m.page_count
                      ? `${m.page_count} pages`
                      : m.file_size_bytes
                      ? `${(m.file_size_bytes / 1024 / 1024).toFixed(1)}MB`
                      : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
