"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User, BookOpen, LogOut, ShieldCheck,
  ChevronDown, Sparkles
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
        className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-white dark:bg-[#0c121e] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer focus:outline-none"
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className="w-6 h-6 rounded bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white font-bold text-[10px]">
          {initials}
        </div>
        <span className="hidden sm:inline-block text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[100px] truncate">
          {user?.full_name?.split(" ")[0] || "Account"}
        </span>
        <ChevronDown className={clsx("w-3 h-3 text-slate-400 transition-transform duration-150", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-xl shadow-black/10 dark:shadow-black/60 z-50 overflow-hidden animate-fadeIn"
          style={{ transformOrigin: "top right" }}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.full_name || "StudyOS Student"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {user?.email || "student@studyos.ai"}
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.04] flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Verified Student Account</span>
            </div>
          </div>

          {/* Links */}
          <div className="p-1.5 space-y-0.5 text-xs">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Profile Settings</span>
            </Link>

            <Link
              href="/vault"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Knowledge Vault</span>
            </Link>

            <Link
              href="/analytics"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span>Learning Progress</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="p-1.5 border-t border-slate-200 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
