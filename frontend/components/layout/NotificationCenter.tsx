"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell, CheckCheck, Trash2, X, Sparkles, Shield,
  BookOpen, ClipboardList, MessageSquare, Flame,
  Clock, ExternalLink, Filter
} from "lucide-react";
import clsx from "clsx";

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
  {
    id: "notif-4",
    title: "Knowledge Vault Ready",
    message: "Drop PDFs, PPTX, or class notes in Knowledge Vault to auto-build your personalized Knowledge Graph.",
    category: "vault",
    timestamp: "2 hours ago",
    read: true,
    link: "/vault",
    actionText: "Open Vault",
  },
  {
    id: "notif-5",
    title: "Exam Timetable & Planner",
    message: "Track your scheduled exam deadlines and manage your daily study timetable hours.",
    category: "quiz",
    timestamp: "Yesterday",
    read: true,
    link: "/study-plan",
    actionText: "Open Timetable",
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

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load notifications from localStorage or fallback to default
  useEffect(() => {
    try {
      const stored = localStorage.getItem("studyos-notifications");
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications(DEFAULT_NOTIFICATIONS);
        localStorage.setItem("studyos-notifications", JSON.stringify(DEFAULT_NOTIFICATIONS));
      }
    } catch {
      setNotifications(DEFAULT_NOTIFICATIONS);
    }

    // Listen for custom notification trigger
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

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    saveNotifications(updated);
  };

  const clearAll = () => {
    saveNotifications([]);
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
          "btn-ghost relative transition-colors focus:outline-none",
          isOpen
            ? "text-emerald-500 bg-emerald-500/10"
            : "text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-white/5"
        )}
        title="Notifications"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2.5 w-[340px] sm:w-[390px] max-h-[520px] bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-emerald-950/20 backdrop-blur-2xl z-50 flex flex-col overflow-hidden animate-fadeIn"
          style={{ transformOrigin: "top right" }}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white leading-none">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Updates, study streaks & AI activity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Read all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 bg-slate-100/50 dark:bg-white/[0.01] border-b border-slate-200/70 dark:border-white/[0.05] flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer",
                activeFilter === "all"
                  ? "bg-emerald-500 text-white font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("unread")}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer",
                activeFilter === "unread"
                  ? "bg-emerald-500 text-white font-semibold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] max-h-[380px]">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Bell className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeFilter === "unread" ? "No unread notifications" : "No notifications yet"}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px] mx-auto">
                  {activeFilter === "unread"
                    ? "You are all caught up on your study updates."
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
                      "p-3.5 flex gap-3 transition-colors relative group cursor-pointer",
                      notif.read
                        ? "bg-transparent hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                        : "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] hover:bg-emerald-500/[0.08]"
                    )}
                  >
                    {/* Category Icon */}
                    <div
                      className={clsx(
                        "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border",
                        config.color
                      )}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {notif.title}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {notif.timestamp}
                        </span>

                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-semibold"
                          >
                            <span>{notif.actionText || "View"}</span>
                            <ExternalLink className="w-3 h-3" />
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
                      className="absolute right-2.5 top-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded-md transition-opacity"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/[0.08] text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> StudyOS Real-time Hub
            </span>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-500 font-medium"
            >
              Preferences
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
