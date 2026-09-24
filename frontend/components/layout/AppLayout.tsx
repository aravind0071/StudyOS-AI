"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Brain, Home, BookOpen, MessageSquare, ClipboardList,
  BarChart3, Calendar, Target, Mic, Search, Settings, ChevronLeft,
  ChevronRight, Bell, Moon, Sun, LogOut, User
} from "lucide-react";
import { isAuthenticated, clearAuth, getStoredUser, saveUser } from "@/lib/auth";
import { profileApi } from "@/lib/api";
import { toast } from "sonner";
import { ISTClockBadge } from "@/components/ui/ISTClockBadge";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/vault", icon: BookOpen, label: "Knowledge Vault" },
  { href: "/tutor", icon: MessageSquare, label: "AI Tutor" },
  { href: "/quizzes", icon: ClipboardList, label: "Quizzes" },
  { href: "/analytics", icon: BarChart3, label: "My Progress" },
  { href: "/study-plan", icon: Calendar, label: "Study Plan" },
  { href: "/interview", icon: Mic, label: "Interview Mode" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<{ full_name: string; email: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out",
        "bg-white dark:bg-[#0a0d14] border-r border-slate-200 dark:border-white/[0.08]",
        collapsed ? "w-16" : "w-64",
        "hidden md:flex"
      )}>
        {/* Logo */}
        <div className={clsx("flex items-center min-h-[4.25rem] border-b border-slate-200 dark:border-white/[0.08] px-4 py-2.5", collapsed && "justify-center")}>
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="ml-2.5 overflow-hidden flex flex-col justify-center">
              <div className="font-black text-slate-900 dark:text-white text-base tracking-tight whitespace-nowrap">
                StudyOS <span className="gradient-text">AI</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-tight truncate leading-tight">
                Your AI Learning Operating System
              </div>
              {/* IST Time and Date at left StudyOS AI down */}
              <div className="mt-1">
                <ISTClockBadge compact />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} title={collapsed ? label : undefined}>
                <div className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium",
                  isActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5",
                  collapsed && "justify-center"
                )}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Collapse button */}
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/[0.12] rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* User profile at bottom */}
        <div className={clsx("border-t border-slate-200 dark:border-white/[0.08] p-3", collapsed && "flex justify-center")}>
          {collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs"
            >
              {initials}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-slate-900 dark:text-white text-sm font-medium truncate">{user?.full_name || "Student"}</div>
                <div className="text-slate-500 text-xs truncate">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0a0d14] border-t border-slate-200 dark:border-white/[0.08] md:hidden flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.slice(0, 5).map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg",
                isActive ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-500 dark:text-slate-400")}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className={clsx(
        "flex-1 min-w-0 min-h-screen transition-all duration-300 overflow-x-hidden",
        collapsed ? "md:ml-16 md:max-w-[calc(100vw-4rem)]" : "md:ml-64 md:max-w-[calc(100vw-16rem)]",
        "pb-16 md:pb-0"
      )}>
        {/* Top bar (Consistent across all pages) */}
        <div className="sticky top-0 z-30 h-14 bg-white/85 dark:bg-[#07090e]/85 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between px-4 sm:px-6 transition-colors">
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-slate-900 dark:text-white text-sm block leading-none">StudyOS AI</span>
              <ISTClockBadge compact className="text-[10px] mt-0.5" />
            </div>
          </div>

          {/* Desktop Search Bar & Shortcut */}
          <div className="hidden md:flex items-center">
            <Link
              href="/search"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] hover:border-emerald-500/40 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-64 shadow-xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="flex-1 truncate">Search concepts, vault...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded">
                Ctrl K
              </kbd>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/search" className="btn-ghost md:hidden text-slate-500 dark:text-slate-400 hover:text-emerald-500">
              <Search className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost text-slate-500 dark:text-slate-400 hover:text-emerald-500"
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
            ? "p-3 sm:p-4 h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col bg-slate-50 dark:bg-[#07090e]"
            : "p-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-[#07090e]"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
