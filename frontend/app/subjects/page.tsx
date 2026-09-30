"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers, Plus, BookOpen, Clock, ArrowRight, Sparkles,
  Calendar, CheckCircle2, FileText, Video, Sparkle, Search, RefreshCw, Trash2
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { subjectsApi } from "@/lib/api";
import { toast } from "sonner";
import clsx from "clsx";

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  target_exam_date?: string;
  units_count: number;
  resources_count: number;
  unit_count?: number;
  resource_count?: number;
  progress_percent: number;
}

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await subjectsApi.list();
      const list = Array.isArray(res.data) ? res.data : (res.data?.subjects || []);
      setSubjects(list);
    } catch {
      toast.error("Failed to load subjects. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await subjectsApi.seedCurriculum();
      toast.success(res.data?.message || "Standard curriculum seeded successfully!");
      await fetchSubjects();
    } catch {
      toast.error("Could not seed curriculum. Try adding subjects manually.");
    } finally {
      setSeeding(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a subject name.");
      return;
    }

    try {
      setCreating(true);
      const res = await subjectsApi.create({
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
        color,
      });
      toast.success("Subject created successfully!");
      setShowAddModal(false);
      setName("");
      setCode("");
      setDescription("");
      await fetchSubjects();
      const newId = res.data?.id || res.data?.subject?.id;
      if (newId) {
        router.push(`/subjects/${newId}`);
      }
    } catch {
      toast.error("Failed to create subject. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Are you sure you want to delete "${subjectName}" and all of its units and resources? This action cannot be undone.`)) {
      return;
    }
    try {
      await subjectsApi.delete(subjectId);
      toast.success(`"${subjectName}" deleted successfully.`);
      await fetchSubjects();
    } catch {
      toast.error("Failed to delete subject.");
    }
  };

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-slate-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Layers className="w-5 h-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Subjects & Curriculum
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Hierarchical resource management: Subject → Units → Notes, Lectures, YouTube & PDFs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {subjects.length === 0 && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="px-4 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Sparkles className={clsx("w-4 h-4", seeding && "animate-spin")} />
                {seeding ? "Seeding B.Tech Core..." : "Seed Core Subjects (OS, Networks, DBMS, ML)"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        {subjects.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subjects or course codes..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{subjects.length} Subjects</span>
              <span>•</span>
              <span>{subjects.reduce((acc, s) => acc + (s.units_count || 0), 0)} Total Units</span>
              <span>•</span>
              <span>{subjects.reduce((acc, s) => acc + (s.resources_count || 0), 0)} Resources</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4 bg-white dark:bg-[#0c101a] rounded-3xl border border-slate-200 dark:border-white/10 my-6 shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 mb-4">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {searchQuery ? "No matching subjects found" : "You haven't added any study subjects yet"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 mb-6">
              {searchQuery
                ? "Try searching with a different term or clear the filter."
                : "Create your first subject or seed the standard B.Tech curriculum to organize Units, Notes, YouTube links, and PDFs."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="px-5 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {seeding ? "Seeding..." : "Seed Core B.Tech Subjects"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Subject
              </button>
            </div>
          </div>
        ) : (
          /* Subjects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 my-6">
            {filtered.map((subject) => (
              <div
                key={subject.id}
                className="card-hover p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <span
                      className="px-2 py-0.5 text-[11px] font-semibold rounded-md uppercase tracking-wider"
                      style={{
                        backgroundColor: `${subject.color || "#10b981"}15`,
                        color: subject.color || "#10b981",
                        border: `1px solid ${subject.color || "#10b981"}30`,
                      }}
                    >
                      {subject.code || "COURSE"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {subject.units_count ?? subject.unit_count ?? 0} Units
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteSubject(subject.id, subject.name);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title={`Delete ${subject.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <Link href={`/subjects/${subject.id}`}>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                      {subject.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 mb-4">
                    {subject.description || "Organized syllabus units, revision notes, video lectures, and exam practice."}
                  </p>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-500 dark:text-slate-400">Mastery Progress</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {Math.round(subject.progress_percent || 0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, subject.progress_percent || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <FileText className="w-3.5 h-3.5" />
                    {subject.resources_count ?? subject.resource_count ?? 0} Resources
                  </span>
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 text-xs"
                  >
                    Open Syllabus
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Subject Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Add New Subject
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <form key="subject-create-form" onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Name *
                  </label>
                  <input
                    key="subj-name-input"
                    type="text"
                    required
                    value={name || ""}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Operating Systems, Computer Networks..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Code
                    </label>
                    <input
                      key="subj-code-input"
                      type="text"
                      value={code || ""}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. CS401, IT302"
                      className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Badge Color
                    </label>
                    <input
                      key="subj-color-input"
                      type="color"
                      value={color || "#10b981"}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full h-9 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    key="subj-desc-input"
                    rows={3}
                    value={description || ""}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course objectives, reference syllabus, or notes..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors flex items-center gap-2"
                  >
                    {creating ? "Creating..." : "Save Subject"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
