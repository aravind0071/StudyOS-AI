"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchApi, getErrorMessage } from "@/lib/api";
import {
  Search as SearchIcon, FileText, Tag, ClipboardList,
  Loader2, Globe, Brain, Sparkles, ArrowRight, BookOpen,
  ArrowUp, X, Layers, Calendar, ExternalLink
} from "lucide-react";
import clsx from "clsx";

const TYPE_ICONS: Record<string, React.ElementType> = {
  subject: Layers,
  unit: BookOpen,
  resource: FileText,
  document: FileText,
  chat: Brain,
  note: Tag,
  study_plan: Calendar,
  topic: Tag,
  question: ClipboardList,
  website: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  subject: "text-emerald-500 bg-emerald-500/10",
  unit: "text-blue-500 bg-blue-500/10",
  resource: "text-teal-500 bg-teal-500/10",
  document: "text-amber-500 bg-amber-500/10",
  chat: "text-purple-500 bg-purple-500/10",
  note: "text-indigo-500 bg-indigo-500/10",
  study_plan: "text-rose-500 bg-rose-500/10",
  topic: "text-purple-500 bg-purple-500/10",
  question: "text-sky-500 bg-sky-500/10",
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) {
        setQuery(q);
        performSearch(q, filter);
      }
    }
  }, []);

  const performSearch = async (searchTerm: string, activeFilter: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const { data } = await searchApi.search(searchTerm, activeFilter === "all" ? undefined : activeFilter);
      setResults(data.results || []);
      setGrouped(data.grouped || null);
      setSearched(true);
    } catch {
      setResults([]);
      setGrouped(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, filter);
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    if (query.trim()) {
      performSearch(query, newFilter);
    }
  };

  const handleAskTutor = (item: any) => {
    const prompt = `Explain ${item.title}${item.page_number ? ` (Page ${item.page_number})` : ""} from my course materials in detail with examples.`;
    router.push(`/tutor?q=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <SearchIcon className="w-5 h-5 text-emerald-500" /> Search Intelligence
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Instant vector & semantic search across your uploaded documents, lecture transcripts, and quiz questions.
        </p>
      </div>

      {/* Modern Search Command Bar */}
      <form onSubmit={handleSearch} className="relative flex items-center bg-white dark:bg-[#0c121e] rounded-xl border border-slate-200 dark:border-white/[0.1] focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 shadow-xs p-1.5 sm:p-2 transition-colors">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0 ml-1">
          <SearchIcon className="w-4 h-4" />
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search topics, formulas, slides, questions... (e.g. 'CRC checksum', 'CPU scheduling')"
          className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          autoFocus
        />
        {query.trim() && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors mr-1"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className={clsx(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 mr-1 shadow-xs",
            query.trim() && !loading
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              : "bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 cursor-not-allowed"
          )}
          title="Search"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
        </button>
      </form>

      {/* Filter tabs & View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
          {["all", "subjects", "units", "resources", "documents", "chats", "notes", "study_plans"].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              className={clsx(
                "px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors border whitespace-nowrap",
                filter === f
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                  : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.06] hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {searched && results.length > 0 && (
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition-all",
                viewMode === "grouped" ? "bg-white dark:bg-slate-700 text-emerald-500 shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              Grouped
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition-all",
                viewMode === "flat" ? "bg-white dark:bg-slate-700 text-emerald-500 shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              Ranked List
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Found <strong>{results.length}</strong> result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
            </span>
            {results.length > 0 && (
              <span className="text-emerald-500 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> Click any result to explain in AI Tutor
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card p-10 text-center space-y-3">
              <SearchIcon className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No matching items found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching for specific subjects like &quot;Operating Systems&quot;, topics like &quot;CPU Scheduling&quot;, or notes from your Knowledge Vault.
              </p>
            </div>
          ) : viewMode === "grouped" && grouped ? (
            /* ── GROUPED RESULTS VIEW ── */
            <div className="space-y-6">
              {Object.entries(grouped).map(([groupKey, items]: [string, any]) => {
                if (!Array.isArray(items) || items.length === 0) return null;
                const Icon = TYPE_ICONS[items[0]?.type] || FileText;
                const groupTitle = groupKey.replace("_", " ").toUpperCase();

                return (
                  <div key={groupKey} className="space-y-3">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 dark:border-white/[0.08]">
                      <Icon className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {groupTitle} ({items.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {items.map((r, i) => (
                        <div
                          key={i}
                          className="card-hover p-4 flex flex-col sm:flex-row items-start justify-between gap-4 transition-all"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {r.title}
                              </span>
                              <span className="badge badge-slate capitalize text-[10px]">
                                {r.type}
                              </span>
                            </div>

                            {r.snippet && (
                              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/60 dark:border-white/[0.04]">
                                {r.snippet}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAskTutor(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors border border-emerald-500/25"
                            >
                              <Brain className="w-3.5 h-3.5" />
                              <span>Ask AI</span>
                            </button>

                            {r.url && (
                              <button
                                type="button"
                                onClick={() => router.push(r.url)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                              >
                                <span>Open</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── FLAT RANKED LIST VIEW ── */
            <div className="space-y-3">
              {results.map((r, i) => {
                const Icon = TYPE_ICONS[r.type] || FileText;
                const colorCls = TYPE_COLORS[r.type] || "text-slate-400 bg-slate-700";

                return (
                  <div
                    key={i}
                    className="card-hover p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl ${colorCls} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {r.title}
                        </span>
                        <span className="badge badge-slate capitalize text-[10px]">
                          {r.type}
                        </span>
                        {r.topic && <span className="badge badge-blue text-[10px]">{r.topic}</span>}
                        {r.page_number && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Page {r.page_number}
                          </span>
                        )}
                      </div>

                      {r.snippet && (
                        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[13px] leading-relaxed line-clamp-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.04]">
                          {r.snippet}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAskTutor(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors border border-emerald-500/25"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          <span>Ask AI Tutor to explain</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {r.url && (
                          <button
                            type="button"
                            onClick={() => router.push(r.url)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors border border-slate-200 dark:border-white/[0.08]"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
            <SearchIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Universal Academic Search
            </h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Quickly retrieve exact chunks, equations, and lecture snippets from your uploaded study materials.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              "checksum",
              "1's complement arithmetic",
              "wraparound carry",
              "CPU scheduling",
              "normalization",
              "Dijkstra algorithm"
            ].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuery(q);
                  performSearch(q, filter);
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-500 border border-slate-200 dark:border-white/[0.08] transition-all cursor-pointer"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
