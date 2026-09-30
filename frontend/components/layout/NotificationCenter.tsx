"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell, CheckCheck, Trash2, X, Sparkles, Shield,
  BookOpen, ClipboardList, MessageSquare, Flame,
  Clock, ExternalLink, Filter
} from "lucide-react";
import clsx from "clsx";

import { notificationsApi, remindersApi } from "@/lib/api";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: "security" | "study" | "ai" | "quiz" | "vault";
  timestamp: string;
  read: boolean;
  link?: string;
  actionText?: string;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Two-Step Verification Active",
    message: "Your StudyOS AI account is securely protected with real-time OTP verification.",
    category: "security",
    timestamp: "Just now",
    read: false,
    link: "/settings",
    actionText: "View Security",
  },
  {
    id: "notif-2",
    title: "AI Tutor Engine Ready",
    message: "Ask anything about your syllabus or uploaded lecture notes to generate instant summaries.",
    category: "ai",
    timestamp: "10 mins ago",
    read: false,
    link: "/tutor",
    actionText: "Chat with AI",
  },
  {
    id: "notif-3",
    title: "Daily Study Streak",
    message: "Keep your momentum going! Review 1 concept or take a 5-minute quiz today to increase your streak.",
    category: "study",
    timestamp: "1 hour ago",
    read: false,
    link: "/quizzes",
    actionText: "Take Quick Quiz",
  },
];

const CATEGORY_CONFIG = {
  security: {
    icon: Shield,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  study: {
    icon: Flame,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-500",
  },
  ai: {
    icon: Sparkles,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/25",
    dot: "bg-sky-500",
  },
  quiz: {
    icon: ClipboardList,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/25",
    dot: "bg-purple-500",
  },
  vault: {
    icon: BookOpen,
    color: "text-teal-500 bg-teal-500/10 border-teal-500/25",
    dot: "bg-teal-500",
  },
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return "Recently";
  }
}

function mapBackendType(typeStr?: string): "security" | "study" | "ai" | "quiz" | "vault" {
  if (!typeStr) return "ai";
  if (typeStr.includes("login") || typeStr.includes("security")) return "security";
  if (typeStr.includes("study") || typeStr.includes("session")) return "study";
  if (typeStr.includes("exam") || typeStr.includes("quiz")) return "quiz";
  if (typeStr.includes("doc") || typeStr.includes("vault") || typeStr.includes("resource")) return "vault";
  return "ai";
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchLiveNotifications = async () => {
    try {
      // Trigger background check for due reminders
      remindersApi.checkAndDispatch().catch(() => null);

      const res = await notificationsApi.list();
      if (res.data?.notifications && Array.isArray(res.data.notifications)) {
        if (res.data.notifications.length > 0) {
          const mapped: NotificationItem[] = res.data.notifications.map((n: any) => ({
            id: String(n.id),
            title: n.title,
            message: n.message,
            category: mapBackendType(n.notification_type),
            timestamp: formatTimeAgo(n.created_at),
            read: Boolean(n.is_read),
            link: n.action_url || "/dashboard",
            actionText: "View",
          }));
          setNotifications(mapped);
          try {
            localStorage.setItem("studyos-notifications", JSON.stringify(mapped));
          } catch {}
          return;
        }
      }
      // Fallback if empty in backend
      const stored = localStorage.getItem("studyos-notifications");
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }
    } catch {
      const stored = localStorage.getItem("studyos-notifications");
      if (stored) {
        try { setNotifications(JSON.parse(stored)); } catch {}
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
      }
    }
  };

  useEffect(() => {
    fetchLiveNotifications();

    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      if (customEvent.detail) {
        setNotifications((prev) => {
          const updated = [customEvent.detail, ...prev];
          try {
            localStorage.setItem("studyos-notifications", JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    };

    window.addEventListener("studyos-notify" as any, handleNewNotification);
    return () => {
      window.removeEventListener("studyos-notify" as any, handleNewNotification);
    };
  }, []);

  // Save changes to localStorage
  const saveNotifications = (items: NotificationItem[]) => {
    setNotifications(items);
    try {
      localStorage.setItem("studyos-notifications", JSON.stringify(items));
    } catch {}
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
    try {
      await notificationsApi.markAllRead();
    } catch {}
  };

  const markAsRead = async (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
    try {
      await notificationsApi.markRead(id);
    } catch {}
  };

  const deleteNotification = async (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
    try {
      await notificationsApi.delete(id);
    } catch {}
  };

  const clearAll = () => {
    saveNotifications([]);
    notifications.forEach((n) => {
      notificationsApi.delete(n.id).catch(() => null);
    });
  };

  const filteredNotifications = notifications.filter((n) =>
    activeFilter === "unread" ? !n.read : true
  );

  return (
    <div className="relative">
      {/* Trigger Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx(
          "btn-ghost relative p-1.5 transition-colors focus:outline-none",
          isOpen
            ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.06]"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        )}
        title="Notifications"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-h-[500px] bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/[0.1] rounded-xl shadow-xl shadow-black/10 dark:shadow-black/60 z-50 flex flex-col overflow-hidden animate-fadeIn"
          style={{ transformOrigin: "top right" }}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {unreadCount} new
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline p-1 rounded transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3.5 py-1.5 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-200/70 dark:border-white/[0.05] flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={clsx(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                activeFilter === "all"
                  ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("unread")}
              className={clsx(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                activeFilter === "unread"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[360px]">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Bell className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {activeFilter === "unread" ? "No unread notifications" : "No notifications"}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[220px] mx-auto">
                  {activeFilter === "unread"
                    ? "You are caught up with your study updates."
                    : "Activity updates, quiz results and study streaks will appear here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const config = CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.study;
                const IconComponent = config.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={clsx(
                      "p-3 flex gap-2.5 transition-colors relative group cursor-pointer",
                      notif.read
                        ? "bg-transparent hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                        : "bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] hover:bg-emerald-500/[0.06]"
                    )}
                  >
                    {/* Category Icon */}
                    <div
                      className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                        config.color
                      )}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {notif.timestamp}
                        </span>

                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <span>{notif.actionText || "View"}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Delete button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded transition-opacity"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/[0.07] text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px]">
              <Sparkles className="w-3 h-3 text-emerald-500" /> Notifications Hub
            </span>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-emerald-500"
            >
              Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
