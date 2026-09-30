"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers, Plus, BookOpen, Clock, ArrowRight, Sparkles,
  Calendar, CheckCircle2, FileText, Video, Sparkle, Search,
  Play, ExternalLink, Image as ImageIcon, Trash2, Edit3,
  ChevronRight, ArrowLeft, MessageSquare, ClipboardList, BookMarked,
  Check, Upload, RefreshCw, Eye
} from "lucide-react";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}
import AppLayout from "@/components/layout/AppLayout";
import { subjectsApi } from "@/lib/api";
import { toast } from "sonner";
import clsx from "clsx";
import FilePreviewModal, { PreviewItem } from "@/components/vault/FilePreviewModal";

interface ResourceItem {
  id: string;
  unit_id?: string;
  resource_type: string;
  title: string;
  description?: string;
  url?: string;
  file_path?: string;
  file_size?: number;
  thumbnail_url?: string;
  tags?: string;
  created_at: string;
}

interface UnitItem {
  id: string;
  unit_number: number;
  title: string;
  description?: string;
  progress_percent: number;
  resources: ResourceItem[];
}

interface SubjectDetail {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  progress_percent: number;
  units: UnitItem[];
}

export default function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const subjectId = resolvedParams.id;
  const router = useRouter();

  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"units" | "resources" | "overview">("units");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);

  // Modals
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [preselectedUnitId, setPreselectedUnitId] = useState<string>("");

  // Add Unit Form State
  const [unitNumber, setUnitNumber] = useState(1);
  const [unitTitle, setUnitTitle] = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [savingUnit, setSavingUnit] = useState(false);

  // Add Resource Form State
  const [resourceMode, setResourceMode] = useState<"link" | "upload">("upload");
  const [resUnitId, setResUnitId] = useState<string>("");
  const [resType, setResType] = useState<string>("pdf");
  const [resTitle, setResTitle] = useState("");
  const [resDescription, setResDescription] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resTags, setResTags] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const [savingResource, setSavingResource] = useState(false);

  const fetchSubject = async () => {
    try {
      setLoading(true);
      const res = await subjectsApi.get(subjectId);
      const data = res.data?.subject || res.data;
      if (data && data.name) {
        setSubject(data);
        if (data.units?.length > 0) {
          setUnitNumber(data.units.length + 1);
        }
      }
    } catch {
      toast.error("Failed to load subject details.");
      router.push("/subjects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId) {
      fetchSubject();
    }
  }, [subjectId]);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim()) {
      toast.error("Unit title is required.");
      return;
    }

    try {
      setSavingUnit(true);
      await subjectsApi.createUnit(subjectId, {
        unit_number: Number(unitNumber),
        title: unitTitle.trim(),
        description: unitDescription.trim(),
      });
      toast.success("Unit created successfully!");
      setShowAddUnitModal(false);
      setUnitTitle("");
      setUnitDescription("");
      await fetchSubject();
    } catch {
      toast.error("Failed to add unit.");
    } finally {
      setSavingUnit(false);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) {
      toast.error("Resource title is required.");
      return;
    }

    try {
      setSavingResource(true);
      if (resourceMode === "upload") {
        if (!resFile) {
          toast.error("Please choose a file to upload.");
          setSavingResource(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", resFile);
        fd.append("subject_id", subjectId);
        if (resUnitId) fd.append("unit_id", resUnitId);
        fd.append("resource_type", resType);
        fd.append("title", resTitle.trim());
        if (resDescription) fd.append("description", resDescription.trim());
        if (resTags) fd.append("tags", resTags.trim());

        await subjectsApi.uploadResource(fd);
        toast.success("Resource uploaded and indexed successfully!");
      } else {
        await subjectsApi.addResource({
          subject_id: subjectId,
          unit_id: resUnitId || undefined,
          resource_type: resType,
          title: resTitle.trim(),
          description: resDescription.trim(),
          url: resUrl.trim() || undefined,
          tags: resTags.trim() || undefined,
        });
        toast.success("Resource added successfully!");
      }

      setShowAddResourceModal(false);
      setResTitle("");
      setResDescription("");
      setResUrl("");
      setResTags("");
      setResFile(null);
      await fetchSubject();
    } catch {
      toast.error("Failed to add resource. Please verify your input.");
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm("Are you sure you want to remove this resource?")) return;
    try {
      await subjectsApi.deleteResource(resourceId);
      toast.success("Resource removed.");
      await fetchSubject();
    } catch {
      toast.error("Could not delete resource.");
    }
  };

  const handleDeleteSubject = async () => {
    if (!subject) return;
    if (!confirm(`Are you sure you want to delete "${subject.name}" and all of its units and resources? This action cannot be undone.`)) {
      return;
    }
    try {
      await subjectsApi.delete(subject.id);
      toast.success(`"${subject.name}" deleted successfully.`);
      router.push("/subjects");
    } catch {
      toast.error("Failed to delete subject.");
    }
  };

  const handleUpdateUnitProgress = async (unitId: string, currentProgress: number) => {
    const nextProgress = currentProgress >= 100 ? 0 : Math.min(100, currentProgress + 25);
    try {
      await subjectsApi.updateUnit(unitId, { progress_percent: nextProgress });
      await fetchSubject();
    } catch {
      toast.error("Could not update progress.");
    }
  };

  // Aggregated Resources
  const allResources: (ResourceItem & { unit_name?: string })[] = [];
  subject?.units?.forEach((u) => {
    u.resources?.forEach((r) => {
      allResources.push({ ...r, unit_name: `Unit ${u.unit_number}: ${u.title}` });
    });
  });

  const filteredResources = allResources.filter((r) => {
    const matchUnit = selectedUnitFilter === "all" || r.unit_id === selectedUnitFilter;
    const matchType = selectedTypeFilter === "all" || r.resource_type === selectedTypeFilter;
    return matchUnit && matchType;
  });

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "youtube":
      case "video":
        return <YoutubeIcon className="w-4 h-4 text-red-500" />;
      case "pdf":
        return <FileText className="w-4 h-4 text-red-400" />;
      case "lecture":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case "notes":
        return <BookMarked className="w-4 h-4 text-amber-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  if (loading || !subject) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="h-8 w-48 bg-slate-200 dark:bg-white/10 rounded-lg animate-pulse mb-4" />
          <div className="h-32 w-full bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          href="/subjects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to all Subjects
        </Link>

        {/* Subject Header Card */}
        <div className="card p-5 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider"
                  style={{
                    backgroundColor: `${subject.color || "#10b981"}15`,
                    color: subject.color || "#10b981",
                    border: `1px solid ${subject.color || "#10b981"}30`,
                  }}
                >
                  {subject.code || "COURSE"}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {subject.units?.length || 0} Units • {allResources.length} Materials
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {subject.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {subject.description || "Comprehensive unit-wise curriculum, reference materials, and exam prep."}
              </p>
            </div>

            {/* AI Fast Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/tutor?subject=${encodeURIComponent(subject.name)}`}
                className="btn-primary text-xs py-1.5 px-3"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask AI Tutor
              </Link>
              <Link
                href={`/quizzes?subject=${encodeURIComponent(subject.name)}`}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Generate Quiz
              </Link>
              <Link
                href={`/tutor?subject=${encodeURIComponent(subject.name)}&mode=exam&marks=10`}
                className="btn-outline text-xs py-1.5 px-3"
              >
                <FileText className="w-3.5 h-3.5" />
                Exam Answer (10M)
              </Link>
            </div>
          </div>

          {/* Progress Bar & Metric */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-lg">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Overall Subject Progress</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(subject.progress_percent || 0)}% Completed
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, subject.progress_percent || 0))}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddUnitModal(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Unit
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreselectedUnitId(subject.units?.[0]?.id || "");
                  setResUnitId(subject.units?.[0]?.id || "");
                  setResourceMode("upload");
                  setResType("pdf");
                  setShowAddResourceModal(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/20 text-white transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Resource
              </button>
              <button
                type="button"
                onClick={handleDeleteSubject}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                title="Delete this entire subject and all its units"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Subject
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 mb-6 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("units")}
            className={clsx(
              "px-4 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2",
              activeTab === "units"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Knowledge Vault by Unit ({subject.units?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resources")}
            className={clsx(
              "px-4 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2",
              activeTab === "resources"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Layers className="w-4 h-4" />
            All Vault Resources ({allResources.length})
          </button>
        </div>

        {/* ── UNITS TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "units" && (
          <div className="space-y-6">
            {subject.units?.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-[#0c101a] rounded-3xl border border-slate-200 dark:border-white/10">
                <BookOpen className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No units added yet for {subject.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                  Structure this course into Units (e.g. Unit 1 to Unit 5) to organize notes and video lectures.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Unit 1
                </button>
              </div>
            ) : (
              subject.units?.map((unit) => (
                <div
                  key={unit.id}
                  className="card p-5 sm:p-6 transition-colors shadow-xs"
                >
                  {/* Unit Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Unit {unit.unit_number}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          • {unit.resources?.length || 0} Knowledge Vault Items
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {unit.title}
                      </h3>
                      {unit.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {unit.description}
                        </p>
                      )}
                    </div>

                    {/* Progress Clicker & Fast Add Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateUnitProgress(unit.id, unit.progress_percent || 0)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 text-slate-700 dark:text-slate-300 transition-colors"
                        title="Click to advance unit completion progress"
                      >
                        <CheckCircle2
                          className={clsx(
                            "w-3.5 h-3.5",
                            unit.progress_percent >= 100
                              ? "text-emerald-500"
                              : "text-slate-400"
                          )}
                        />
                        <span>{unit.progress_percent || 0}% Done</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResUnitId(unit.id);
                          setResourceMode("upload");
                          setResType("pdf");
                          setShowAddResourceModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 border border-emerald-500/20"
                        title={`Upload PDF or Notes directly into Unit ${unit.unit_number}`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload to Unit {unit.unit_number}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResUnitId(unit.id);
                          setResourceMode("link");
                          setResType("youtube");
                          setShowAddResourceModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                        title={`Add YouTube Lecture to Unit ${unit.unit_number}`}
                      >
                        <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
                        <span>Add YouTube Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Unit Resources Listing */}
                  <div className="mt-4">
                    {unit.resources?.length === 0 ? (
                      <div className="py-4 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-center my-2 bg-slate-50/50 dark:bg-white/[0.02]">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Unit {unit.unit_number} Knowledge Vault is empty. Upload your Unit {unit.unit_number} PDFs, Notes, or YouTube lectures to start studying.
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setResUnitId(unit.id);
                              setResourceMode("upload");
                              setResType("pdf");
                              setShowAddResourceModal(true);
                            }}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload PDF / Notes
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setResUnitId(unit.id);
                              setResourceMode("link");
                              setResType("youtube");
                              setShowAddResourceModal(true);
                            }}
                            className="text-xs font-semibold text-red-500 hover:underline flex items-center gap-1"
                          >
                            <YoutubeIcon className="w-3.5 h-3.5" /> Add YouTube Lecture
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unit.resources?.map((res) => (
                          <div
                            key={res.id}
                            onClick={() => setPreviewItem({
                              id: res.id,
                              title: res.title,
                              type: res.resource_type,
                              source: "resource",
                              source_url: res.url,
                              description: res.description,
                              subject: subject?.name,
                            })}
                            className="group p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.03] transition-all flex items-start justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-start gap-2.5 overflow-hidden flex-1">
                              <span className="p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 mt-0.5 shrink-0">
                                {getResourceIcon(res.resource_type)}
                              </span>
                              <div className="overflow-hidden min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-500 truncate block transition-colors">
                                  {res.title}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                                    {res.resource_type}
                                  </span>
                                  <span className="text-[10px] text-emerald-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                    <Eye className="w-2.5 h-2.5" /> View
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteResource(res.id);
                              }}
                              className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1 shrink-0"
                              title="Delete Resource"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ALL RESOURCES TAB ────────────────────────────────────────────────── */}
        {activeTab === "resources" && (
          <div>
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedUnitFilter}
                  onChange={(e) => setSelectedUnitFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All Units</option>
                  {subject.units?.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number}: {u.title}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All Material Types</option>
                  <option value="notes">Notes</option>
                  <option value="lecture">Lectures</option>
                  <option value="video">Videos</option>
                  <option value="youtube">YouTube</option>
                  <option value="pdf">PDFs</option>
                  <option value="document">Documents</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResUnitId(subject.units?.[0]?.id || "");
                  setShowAddResourceModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload / Add Material
              </button>
            </div>

            {filteredResources.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-[#0c101a] rounded-3xl border border-slate-200 dark:border-white/10">
                <FileText className="w-12 h-12 mx-auto text-emerald-500/40 mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No resources found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-6">
                  Add PDF textbooks, class handwritten notes, YouTube video lectures, or links.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddResourceModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add First Resource
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => setPreviewItem({
                      id: res.id,
                      title: res.title,
                      type: res.resource_type,
                      source: "resource",
                      source_url: res.url,
                      description: res.description,
                      subject: subject?.name,
                    })}
                    className="p-4 rounded-2xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                          {res.resource_type}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {res.unit_name}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mb-1 group-hover:text-emerald-500 transition-colors">
                        {res.title}
                      </h4>
                      {res.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                          {res.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs mt-3">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> View & Open
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteResource(res.id);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MODAL: ADD UNIT ─────────────────────────────────────────────────── */}
        {showAddUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Unit to {subject.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form key="unit-modal-form" onSubmit={handleAddUnit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Number *
                  </label>
                  <input
                    key="unit-num-input"
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={unitNumber ?? 1}
                    onChange={(e) => setUnitNumber(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Title *
                  </label>
                  <input
                    key="unit-title-input"
                    type="text"
                    required
                    value={unitTitle || ""}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="e.g. Process Management & CPU Scheduling"
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Topics Included
                  </label>
                  <textarea
                    key="unit-desc-input"
                    rows={3}
                    value={unitDescription || ""}
                    onChange={(e) => setUnitDescription(e.target.value)}
                    placeholder="Process states, PCB, FCFS, SJF, Round Robin, Peterson's Solution..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddUnitModal(false)}
                    className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingUnit}
                    className="px-5 py-2 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors flex items-center gap-2"
                  >
                    {savingUnit ? "Saving..." : "Add Unit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: ADD RESOURCE ─────────────────────────────────────────────── */}
        {showAddResourceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add Study Resource
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddResourceModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-white/5 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setResourceMode("link");
                    setResType("youtube");
                  }}
                  className={clsx(
                    "py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5",
                    resourceMode === "link"
                      ? "bg-white dark:bg-[#0c101a] text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
                  YouTube Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResourceMode("upload");
                    setResType("pdf");
                  }}
                  className={clsx(
                    "py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5",
                    resourceMode === "upload"
                      ? "bg-white dark:bg-[#0c101a] text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  Upload File (PDF, Notes, Docs)
                </button>
              </div>

              <form key={`form-${resourceMode}`} onSubmit={handleAddResource} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Assign to Unit
                    </label>
                    <select
                      value={resUnitId}
                      onChange={(e) => setResUnitId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">General (Whole Subject)</option>
                      {subject.units?.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unit_number}: {u.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Resource Type
                    </label>
                    <select
                      value={resType}
                      onChange={(e) => setResType(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                    >
                      {resourceMode === "upload" ? (
                        <>
                          <option value="pdf">PDF Textbook / Paper</option>
                          <option value="notes">Notes / Written Summary</option>
                          <option value="document">Document / Presentation (DOCX, PPTX)</option>
                          <option value="video">Video Recording (MP4, MKV)</option>
                          <option value="image">Image / Diagram / Chart</option>
                          <option value="lecture">Lecture / Audio</option>
                        </>
                      ) : (
                        <>
                          <option value="youtube">YouTube Link</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Resource Title *
                  </label>
                  <input
                    key="res-title-input"
                    type="text"
                    required
                    value={resTitle || ""}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="e.g. CPU Scheduling Algorithms Lecture by NPTEL"
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {resourceMode === "link" ? (
                  <div key="mode-link-container">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      URL Link *
                    </label>
                    <input
                      key="res-url-input"
                      type="url"
                      required
                      value={resUrl || ""}
                      onChange={(e) => setResUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or https://..."
                      className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div key="mode-upload-container">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Choose File (PDF, DOCX, PPTX, TXT) *
                    </label>
                    <input
                      key="res-file-input"
                      type="file"
                      required
                      onChange={(e) => setResFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-500/10 dark:file:text-emerald-400 hover:file:bg-emerald-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Key Topics
                  </label>
                  <textarea
                    key="res-desc-input"
                    rows={2}
                    value={resDescription || ""}
                    onChange={(e) => setResDescription(e.target.value)}
                    placeholder="Short summary of what this resource covers..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddResourceModal(false)}
                    className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingResource}
                    className="px-5 py-2 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors flex items-center gap-2"
                  >
                    {savingResource ? "Saving..." : "Save Resource"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* File & Resource Preview Modal */}
        <FilePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      </div>
    </AppLayout>
  );
}
