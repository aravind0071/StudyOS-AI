"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Brain, Home, BookOpen, MessageSquare, ClipboardList,
  BarChart3, Calendar, Mic, Search, Settings, ChevronLeft,
  ChevronRight, Moon, Sun, LogOut, Layers
} from "lucide-react";
import { isAuthenticated, clearAuth, getStoredUser, saveUser } from "@/lib/auth";
import { profileApi } from "@/lib/api";
import { toast } from "sonner";
import { ISTClockBadge } from "@/components/ui/ISTClockBadge";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import clsx from "clsx";

interface NavGroup {
  groupName: string;
  items: {
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: "Workspace",
    items: [
      { href: "/dashboard", icon: Home, label: "Dashboard" },
      { href: "/tutor", icon: MessageSquare, label: "AI Tutor", badge: "AI" },
      { href: "/subjects", icon: Layers, label: "Subjects & Units" },
      { href: "/vault", icon: BookOpen, label: "Knowledge Vault" },
      { href: "/study-plan", icon: Calendar, label: "Study Plan" },
    ],
  },
  {
    groupName: "Practice & Review",
    items: [
      { href: "/quizzes", icon: ClipboardList, label: "Adaptive Quizzes" },
      { href: "/analytics", icon: BarChart3, label: "Progress & Metrics" },
      { href: "/interview", icon: Mic, label: "Interview Prep" },
    ],
  },
  {
    groupName: "System",
    items: [
      { href: "/search", icon: Search, label: "Search" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth");
      return;
    }

    const loadUser = () => {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
      } else {
        profileApi.getMe().then((res) => {
          if (res.data) {
            const u = { id: res.data.id, email: res.data.email, full_name: res.data.full_name };
            saveUser(u);
            setUser(u);
          }
        }).catch(() => null);
      }
    };

    loadUser();

    const onUserUpdate = () => loadUser();
    window.addEventListener("studyos-user-updated", onUserUpdate);
    window.addEventListener("storage", onUserUpdate);
    return () => {
      window.removeEventListener("studyos-user-updated", onUserUpdate);
      window.removeEventListener("storage", onUserUpdate);
    };
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("studyos-theme");
    if (saved === "light") {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      localStorage.setItem("studyos-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("studyos-theme", "light");
    }
  };

  const handleLogout = () => {
    clearAuth();
    toast.success("Logged out successfully.");
    router.push("/auth");
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "SU";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#080c14] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200 ease-in-out",
        "bg-white dark:bg-[#0a0f1d] border-r border-slate-200 dark:border-white/[0.07]",
        collapsed ? "w-16" : "w-60",
        "hidden md:flex"
      )}>
        {/* Workspace Brand Header */}
        <div className={clsx(
          "flex items-center h-14 border-b border-slate-200 dark:border-white/[0.07] px-3.5",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Brain className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                  StudyOS
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 leading-none">
                  AI
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-slate-200 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.groupName}
                </div>
              )}
              {group.items.map(({ href, icon: Icon, label, badge }) => {
                const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link key={href} href={href} title={collapsed ? label : undefined}>
                    <div className={clsx(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors relative",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border-l-2 border-emerald-500 pl-2"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.04]",
                      collapsed && "justify-center px-0 pl-0 border-l-0"
                    )}>
                      <Icon className={clsx("w-4 h-4 flex-shrink-0", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-400")} />
                      {!collapsed && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{label}</span>
                          {badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {badge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User profile footer */}
        <div className={clsx("border-t border-slate-200 dark:border-white/[0.07] p-2.5", collapsed && "flex justify-center")}>
          {collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-rose-500/10 text-slate-700 dark:text-slate-200 hover:text-rose-500 flex items-center justify-center font-bold text-xs transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 p-1.5 rounded-lg bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04]">
              <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-slate-900 dark:text-white text-xs font-semibold truncate leading-tight">
                  {user?.full_name || "Student"}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] truncate leading-tight mt-0.5">
                  {user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/[0.08] md:hidden flex items-center justify-around px-2 py-1.5">
        {[
          { href: "/dashboard", icon: Home, label: "Home" },
          { href: "/tutor", icon: MessageSquare, label: "AI Tutor" },
          { href: "/subjects", icon: Layers, label: "Subjects" },
          { href: "/vault", icon: BookOpen, label: "Vault" },
          { href: "/settings", icon: Settings, label: "Settings" },
        ].map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors",
                isActive ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-500 dark:text-slate-400"
              )}>
              <Icon className="w-4 h-4" />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className={clsx(
        "flex-1 min-w-0 min-h-screen transition-all duration-200 overflow-x-hidden",
        collapsed ? "md:ml-16 md:max-w-[calc(100vw-4rem)]" : "md:ml-60 md:max-w-[calc(100vw-15rem)]",
        "pb-16 md:pb-0"
      )}>
        {/* Top Header Bar */}
        <div className="sticky top-0 z-30 h-13 bg-white/90 dark:bg-[#080c14]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between px-4 sm:px-6 transition-colors">
          {/* Mobile Brand Title */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">StudyOS AI</span>
          </div>

          {/* Desktop Search Bar & Shortcut */}
          <div className="hidden md:flex items-center">
            <Link
              href="/search"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] hover:border-emerald-500/40 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-60"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="flex-1 truncate">Search concepts, documents...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded">
                Ctrl K
              </kbd>
            </Link>
          </div>

          {/* Right actions: IST Time + Theme Toggle + Notifications + User Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="hidden sm:block">
              <ISTClockBadge compact />
            </div>
            <Link href="/search" className="btn-ghost md:hidden text-slate-500 dark:text-slate-400 hover:text-emerald-500 p-1.5">
              <Search className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NotificationCenter />
            <UserProfileMenu user={user} />
          </div>
        </div>

        {/* Page content */}
        <div className={clsx(
          "transition-colors",
          pathname === "/tutor"
            ? "p-2 sm:p-3 h-[calc(100vh-3.25rem)] overflow-hidden flex flex-col bg-slate-50 dark:bg-[#080c14]"
            : "p-4 sm:p-6 min-h-[calc(100vh-3.25rem)] bg-slate-50 dark:bg-[#080c14]"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
