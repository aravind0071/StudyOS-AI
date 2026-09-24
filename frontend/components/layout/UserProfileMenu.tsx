"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User, Settings, LogOut, GraduationCap, ShieldCheck,
  ChevronDown, Sparkles, BookOpen
} from "lucide-react";
import { clearAuth } from "@/lib/auth";
import { toast } from "sonner";
import clsx from "clsx";

interface UserProfileMenuProps {
  user: {
    id?: string;
    full_name?: string;
    email?: string;
    college?: string;
    degree?: string;
    branch?: string;
  } | null;
}

export function UserProfileMenu({ user }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SU";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = () => {
    clearAuth();
    toast.success("Logged out successfully.");
    router.push("/auth");
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] hover:border-emerald-500/40 bg-white/70 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-all cursor-pointer focus:outline-none"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
          {initials}
        </div>
        <span className="hidden sm:inline-block text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[100px] truncate">
          {user?.full_name?.split(" ")[0] || "Account"}
        </span>
        <ChevronDown className={clsx("w-3 h-3 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2.5 w-64 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-emerald-950/20 backdrop-blur-2xl z-50 overflow-hidden animate-fadeIn"
          style={{ transformOrigin: "top right" }}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {user?.full_name || "StudyOS Student"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {user?.email || "student@studyos.ai"}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.04] flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Verified AI Learning Account</span>
            </div>
          </div>

          {/* Links */}
          <div className="p-2 space-y-0.5 text-xs">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Profile Settings</span>
            </Link>

            <Link
              href="/vault"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>My Knowledge Vault</span>
            </Link>

            <Link
              href="/analytics"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span>Learning Analytics</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
