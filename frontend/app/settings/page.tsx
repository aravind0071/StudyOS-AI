"use client";

import { useState, useEffect } from "react";
import { profileApi, authApi, notificationsApi, getErrorMessage } from "@/lib/api";
import { clearAuth, saveUser, getStoredUser } from "@/lib/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  User, Mail, Building2, BookOpen, GraduationCap,
  Settings, LogOut, Loader2, Shield, Bell, Save,
  CheckCircle2, Circle, Eye, EyeOff, Moon, Sun,
  Laptop, Sparkles, Check, Calendar, Layers, ChevronDown, Clock
} from "lucide-react";
import clsx from "clsx";

const YEAR_OPTIONS = [
  { value: "1", label: "Year 1 (Freshman / Undergrad)" },
  { value: "2", label: "Year 2 (Sophomore / Undergrad)" },
  { value: "3", label: "Year 3 (Junior / Undergrad)" },
  { value: "4", label: "Year 4 (Senior / Undergrad)" },
  { value: "5", label: "Year 5 (Dual Degree / Integrated)" },
];

const DEGREE_OPTIONS = [
  { value: "B.Tech", label: "B.Tech" },
  { value: "B.E.", label: "B.E." },
  { value: "BCA", label: "BCA" },
  { value: "B.Sc", label: "B.Sc" },
  { value: "M.Tech", label: "M.Tech" },
  { value: "MCA", label: "MCA" },
  { value: "M.Sc", label: "M.Sc" },
  { value: "MBA", label: "MBA" },
  { value: "Diploma", label: "Diploma" },
  { value: "Other", label: "Other Degree..." },
];

const BRANCH_OPTIONS = [
  { value: "Computer Science and Engineering (CSE)", label: "Computer Science (CSE)" },
  { value: "Artificial Intelligence & Data Science (AI & DS)", label: "AI & Data Science (AI & DS)" },
  { value: "Artificial Intelligence & Machine Learning (AI & ML)", label: "AI & Machine Learning (AI & ML)" },
  { value: "Information Technology (IT)", label: "Information Technology (IT)" },
  { value: "Electronics & Communication (ECE)", label: "Electronics & Communication (ECE)" },
  { value: "Electrical & Electronics (EEE)", label: "Electrical & Electronics (EEE)" },
  { value: "Mechanical Engineering (ME)", label: "Mechanical Engineering (ME)" },
  { value: "Civil Engineering (CE)", label: "Civil Engineering (CE)" },
  { value: "Data Science", label: "Data Science" },
  { value: "Cyber Security", label: "Cyber Security" },
  { value: "Biotechnology", label: "Biotechnology" },
  { value: "Other", label: "Other Branch..." },
];

const EXPLANATION_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner (Analogies & high-level intuition)" },
  { value: "btech_student", label: "B.Tech Student (Technical syllabus depth & code)" },
  { value: "exam", label: "Exam Level (Structured definitions & 10-mark format)" },
  { value: "interview", label: "Interview Level (Concise trade-offs & punchy answers)" },
];

const DAILY_GOAL_OPTIONS = [
  { value: "30", label: "30 minutes / day (Casual pace)" },
  { value: "60", label: "1 hour / day (Recommended for engineering)" },
  { value: "120", label: "2 hours / day (Rigorous sprint)" },
  { value: "180", label: "3+ hours / day (Exam preparation mode)" },
];

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10 transition-colors group-focus-within:text-emerald-500">
            <Icon className="w-4 h-4 flex-shrink-0" />
          </div>
        )}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            paddingLeft: Icon ? "2.75rem" : "1rem",
            paddingRight: "2.5rem",
            backgroundImage: "none",
          }}
          className={clsx(
            "input-field text-sm cursor-pointer no-arrow !bg-none appearance-none text-left transition-all",
            !value ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"
          )}
        >
          {placeholder && (
            <option value="" disabled className="text-slate-400 bg-white dark:bg-slate-900">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 py-1.5">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-400 flex items-center justify-center transition-transform duration-200 group-focus-within:rotate-180 group-focus-within:text-emerald-500">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  id,
  label,
  description,
  checked,
  onChange,
  theme,
}: {
  id?: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  theme?: "dark" | "light";
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="pr-4">
        <label htmlFor={id} className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
          {label}
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          backgroundColor: checked ? "#10b981" : (theme === "dark" ? "#334155" : "#cbd5e1"),
          borderColor: checked ? "#059669" : (theme === "dark" ? "#475569" : "#94a3b8"),
        }}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

const ToggleItem = ToggleSwitch;

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "security" | "notifications">("profile");

  // Notifications Settings State
  const [notifSettings, setNotifSettings] = useState({
    email_notifications: true,
    login_alerts: true,
    study_reminders: true,
    exam_reminders: true,
    study_plan_reminders: true,
    in_app_notifications: true,
    reminder_lead_minutes: 15,
    exam_reminder_2_days: true,
    exam_reminder_1_day: true,
    exam_reminder_day_of: true,
    timezone: "Asia/Kolkata",
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Theme state synchronized with studyos-theme
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("studyos-theme");
    if (saved === "light") {
      setCurrentTheme("light");
    } else {
      setCurrentTheme("dark");
    }
  }, []);

  const handleSelectTheme = (theme: "dark" | "light") => {
    setCurrentTheme(theme);
    localStorage.setItem("studyos-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    window.dispatchEvent(new Event("storage"));
    toast.success(`Switched to ${theme === "dark" ? "Dark Obsidian" : "Light Slate"} mode.`);
  };

  // Profile Form
  const [form, setForm] = useState({
    full_name: "",
    college: "",
    degree: "",
    branch: "",
    year_of_study: "",
    daily_study_minutes: "60",
    learning_level: "btech_student",
  });
  const [customDegree, setCustomDegree] = useState("");
  const [customBranch, setCustomBranch] = useState("");

  // Security Form (Change Password)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Preferences toggles
  const [emailReminders, setEmailReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [examAlerts, setExamAlerts] = useState(true);

  useEffect(() => {
    profileApi.getMe().then(r => {
      setProfile(r.data);
      const p = r.data.profile;
      const deg = p?.degree || "";
      const br = p?.branch || "";
      const isKnownDeg = DEGREE_OPTIONS.some(d => d.value === deg);
      const isKnownBr = BRANCH_OPTIONS.some(b => b.value === br);

      let yrStr = p?.year_of_study ? String(p.year_of_study) : "";
      if (yrStr.includes("1")) yrStr = "1";
      else if (yrStr.includes("2")) yrStr = "2";
      else if (yrStr.includes("3")) yrStr = "3";
      else if (yrStr.includes("4")) yrStr = "4";
      else if (yrStr.includes("5")) yrStr = "5";

      setForm({
        full_name: r.data.full_name || "",
        college: p?.college || "",
        degree: deg ? (isKnownDeg ? deg : "Other") : "",
        branch: br ? (isKnownBr ? br : "Other") : "",
        year_of_study: yrStr,
        daily_study_minutes: p?.daily_study_minutes ? String(p.daily_study_minutes) : "60",
        learning_level: p?.learning_level || "btech_student",
      });

      if (deg && !isKnownDeg) setCustomDegree(deg);
      if (br && !isKnownBr) setCustomBranch(br);
    }).finally(() => setLoading(false));

    notificationsApi.getSettings().then((r) => {
      const data = r.data?.settings || r.data;
      if (data) {
        setNotifSettings((prev) => ({
          ...prev,
          ...data,
          reminder_lead_minutes: data.reminder_minutes_before ?? data.reminder_lead_minutes ?? prev.reminder_lead_minutes,
          exam_reminder_2_days: data.exam_reminder_2days ?? data.exam_reminder_2_days ?? prev.exam_reminder_2_days,
          exam_reminder_1_day: data.exam_reminder_1day ?? data.exam_reminder_1_day ?? prev.exam_reminder_1_day,
        }));
      }
    }).catch(() => null);
  }, []);

  const handleSaveNotifications = async () => {
    try {
      setSavingNotif(true);
      await notificationsApi.updateSettings({
        ...notifSettings,
        reminder_minutes_before: notifSettings.reminder_lead_minutes,
        exam_reminder_2days: notifSettings.exam_reminder_2_days,
        exam_reminder_1day: notifSettings.exam_reminder_1_day,
      });
      toast.success("Notification preferences saved successfully.");
    } catch {
      toast.error("Failed to save notification preferences.");
    } finally {
      setSavingNotif(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    const finalDegree = form.degree === "Other" ? customDegree.trim() : form.degree.trim();
    const finalBranch = form.branch === "Other" ? customBranch.trim() : form.branch.trim();

    try {
      await profileApi.update({
        full_name: form.full_name.trim(),
        college: form.college.trim(),
        degree: finalDegree,
        branch: finalBranch,
        year_of_study: form.year_of_study ? parseInt(form.year_of_study) : undefined,
        daily_study_minutes: parseInt(form.daily_study_minutes),
        learning_level: form.learning_level,
      });
      const current = getStoredUser();
      if (current) {
        saveUser({ ...current, full_name: form.full_name.trim() });
        window.dispatchEvent(new Event("studyos-user-updated"));
      }
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setChangingPw(true);
    try {
      await profileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    clearAuth();
    toast.success("Signed out successfully.");
    router.push("/auth");
  };

  // Password rules validation
  const pwRules = [
    { label: "Minimum 8 characters", valid: newPassword.length >= 8 },
    { label: "Uppercase letter", valid: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", valid: /[a-z]/.test(newPassword) },
    { label: "Number", valid: /\d/.test(newPassword) },
    { label: "Special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
    { label: "Passwords match", valid: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Settings className="w-5 h-5" />
          </div>
          Account Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Manage your personal information, study preferences, and account security.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08]">
        {[
          { id: "profile" as const, label: "Profile", icon: User },
          { id: "preferences" as const, label: "Preferences", icon: BookOpen },
          { id: "security" as const, label: "Security", icon: Shield },
          { id: "notifications" as const, label: "Notifications", icon: Bell },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all",
              activeTab === id
                ? "bg-white dark:bg-white/[0.1] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-white/[0.08]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="card p-6 space-y-6">
          {/* Avatar card */}
          <div className="flex items-center gap-4 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
            <div className="w-14 h-14 rounded-xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
              {form.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "SU"}
            </div>
            <div>
              <div className="font-semibold text-lg text-slate-900 dark:text-white">{form.full_name || "Student"}</div>
              <div className="text-slate-500 dark:text-slate-400 text-sm">{profile?.email}</div>
              {form.college && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  {form.college} {form.degree ? `• ${form.degree}` : ""}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                  <User className="w-4 h-4 flex-shrink-0" />
                </div>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Sai Vamsi"
                  style={{ paddingLeft: "2.75rem" }}
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address <span className="text-xs text-slate-400 font-normal">(Verified)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                </div>
                <input
                  type="email"
                  value={profile?.email || ""}
                  disabled
                  style={{ paddingLeft: "2.75rem" }}
                  className="input-field text-sm opacity-65 cursor-not-allowed"
                />
              </div>
            </div>

            {/* College */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                College / University
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                </div>
                <input
                  type="text"
                  value={form.college}
                  onChange={e => setForm(f => ({ ...f, college: e.target.value }))}
                  placeholder="e.g. SRKR Engineering College, IIT"
                  style={{ paddingLeft: "2.75rem" }}
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* Degree */}
            <div>
              <SelectField
                id="degree"
                label="Degree"
                value={form.degree}
                onChange={v => setForm(f => ({ ...f, degree: v }))}
                options={DEGREE_OPTIONS}
                placeholder="Select Degree"
                icon={GraduationCap}
              />
            </div>

            {/* Custom Degree input when "Other" is chosen */}
            {form.degree === "Other" && (
              <div className="md:col-span-2 animate-fadeIn">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Specify Degree Name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <GraduationCap className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    type="text"
                    value={customDegree}
                    onChange={e => setCustomDegree(e.target.value)}
                    placeholder="e.g. B.Com Honours, MBBS, etc."
                    style={{ paddingLeft: "2.75rem" }}
                    className="input-field text-sm"
                  />
                </div>
              </div>
            )}

            {/* Branch */}
            <div>
              <SelectField
                id="branch"
                label="Branch / Specialization"
                value={form.branch}
                onChange={v => setForm(f => ({ ...f, branch: v }))}
                options={BRANCH_OPTIONS}
                placeholder="Select Branch / Specialization"
                icon={Layers}
              />
            </div>

            {/* Year of Study */}
            <div>
              <SelectField
                id="year_of_study"
                label="Year of Study"
                value={form.year_of_study}
                onChange={v => setForm(f => ({ ...f, year_of_study: v }))}
                options={YEAR_OPTIONS}
                placeholder="Select Year of Study"
                icon={Calendar}
              />
            </div>

            {/* Custom Branch input when "Other" is chosen */}
            {form.branch === "Other" && (
              <div className="md:col-span-2 animate-fadeIn">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Specify Branch / Specialization
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <Layers className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    type="text"
                    value={customBranch}
                    onChange={e => setCustomBranch(e.target.value)}
                    placeholder="e.g. Aerospace Engineering, Robotics"
                    style={{ paddingLeft: "2.75rem" }}
                    className="input-field text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving Changes..." : "Save Profile"}
            </button>
          </div>
        </div>
      )}

      {/* ── PREFERENCES TAB ────────────────────────────────────────────────────── */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Theme Selector */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sun className="w-5 h-5 text-emerald-500" /> Interface Theme
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Choose your preferred visual theme. Persists across all sessions.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              {/* Dark Obsidian */}
              <button
                type="button"
                onClick={() => handleSelectTheme("dark")}
                className={clsx(
                  "card card-hover flex items-center gap-4 p-4 text-left transition-all relative cursor-pointer",
                  currentTheme === "dark"
                    ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-slate-900/90 text-white"
                    : "border-slate-200 dark:border-white/[0.08]"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center justify-between text-slate-900 dark:text-white">
                    <span>Dark Obsidian</span>
                    {currentTheme === "dark" && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">High-contrast slate black for focus</div>
                </div>
              </button>

              {/* Light Slate */}
              <button
                type="button"
                onClick={() => handleSelectTheme("light")}
                className={clsx(
                  "card card-hover flex items-center gap-4 p-4 text-left transition-all relative cursor-pointer",
                  currentTheme === "light"
                    ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-slate-50 text-slate-900"
                    : "border-slate-200 dark:border-white/[0.08]"
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center justify-between text-slate-900 dark:text-white">
                    <span>Light Slate</span>
                    {currentTheme === "light" && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Clean daylight friendly aesthetic</div>
                </div>
              </button>
            </div>
          </div>

          {/* AI Explanation & Study Goals */}
          <div className="card p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" /> Learning Intelligence Settings
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Learning Level */}
              <div>
                <SelectField
                  id="learning_level"
                  label="Default Explanation Level"
                  value={form.learning_level}
                  onChange={v => setForm(f => ({ ...f, learning_level: v }))}
                  options={EXPLANATION_LEVEL_OPTIONS}
                  icon={Sparkles}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  Controls how the AI Tutor and Flashcards phrase core explanations.
                </p>
              </div>

              {/* Daily Study Minutes */}
              <div>
                <SelectField
                  id="daily_study_minutes"
                  label="Daily Study Goal"
                  value={form.daily_study_minutes}
                  onChange={v => setForm(f => ({ ...f, daily_study_minutes: v }))}
                  options={DAILY_GOAL_OPTIONS}
                  icon={Clock}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  Used by Study Plan to calculate daily task distribution.
                </p>
              </div>
            </div>

            {/* Notifications */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] space-y-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Notification Preferences
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                <ToggleSwitch
                  id="daily_reminders"
                  label="Daily Study Reminders"
                  description="Receive an email when daily tasks are pending"
                  checked={emailReminders}
                  onChange={setEmailReminders}
                  theme={currentTheme}
                />
                <ToggleSwitch
                  id="weekly_digest"
                  label="Weekly Performance Digest"
                  description="Summary of quiz accuracy, mastery score, and revision needs"
                  checked={weeklyDigest}
                  onChange={setWeeklyDigest}
                  theme={currentTheme}
                />
                <ToggleSwitch
                  id="exam_alerts"
                  label="Exam Countdown Alerts"
                  description="High-priority revision recommendations as target dates approach"
                  checked={examAlerts}
                  onChange={setExamAlerts}
                  theme={currentTheme}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving Preferences..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ───────────────────────────────────────────────────────── */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" /> Change Account Password
            </h2>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    className="input-field text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Create a strong new password"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    className="input-field text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                  </div>
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    className="input-field text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Rules */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-white/[0.06] space-y-1.5">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Password Requirements:</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {pwRules.map(r => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      {r.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      <span className={r.valid ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500"}>
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPw || !pwRules.every(r => r.valid)}
                  className="btn-primary flex items-center gap-2"
                >
                  {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {changingPw ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Active Sessions */}
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-5 h-5 text-emerald-500" /> Active Devices & Sessions
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-white/[0.08]">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      Current Web Session
                      <span className="badge badge-green text-[10px]">This Device</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Chrome / Edge • Local Host (127.0.0.1) • Active now
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">Email OTP Two-Factor Verification</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    6-digit cryptographic verification code required on every sign in attempt.
                  </div>
                </div>
                <span className="badge badge-green">Enforced</span>
              </div>
            </div>
          </div>

          {/* Sign Out Danger Zone */}
          <div className="card p-6 border-rose-500/20 bg-rose-500/5">
            <h2 className="text-base font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
              <LogOut className="w-5 h-5" /> Sign Out of Session
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Terminate your authentication token and clear local session state on this browser.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-outline border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out Now
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-500" /> Notification Channels & Alerts
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure real-time email alerts, timetable reminders, and security notifications.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {savingNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>

            {/* General Toggles */}
            <div className="divide-y divide-slate-200 dark:divide-white/[0.08]">
              <ToggleItem
                label="Email Notifications"
                description="Master switch to deliver alerts and schedule reminders directly to your inbox."
                checked={notifSettings.email_notifications}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, email_notifications: val }))}
              />

              <ToggleItem
                label="New Login Security Alerts"
                description="Send an email with device, browser, and timestamp details when a successful login occurs."
                checked={notifSettings.login_alerts}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, login_alerts: val }))}
              />

              <ToggleItem
                label="In-App Notification Center"
                description="Display live bell badges and notification dropdown cards within StudyOS AI."
                checked={notifSettings.in_app_notifications}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, in_app_notifications: val }))}
              />

              <ToggleItem
                label="Study Time Reminders"
                description="Receive an email notice prior to your scheduled study sessions."
                checked={notifSettings.study_reminders}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, study_reminders: val }))}
              />

              <ToggleItem
                label="Exam Countdown Reminders"
                description="Receive automated milestone revision notifications as upcoming exam dates approach."
                checked={notifSettings.exam_reminders}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, exam_reminders: val }))}
              />

              <ToggleItem
                label="Study Plan Task Reminders"
                description="Notify when planned curriculum tasks and daily revision goals are due."
                checked={notifSettings.study_plan_reminders}
                onChange={(val: boolean) => setNotifSettings((s) => ({ ...s, study_plan_reminders: val }))}
              />
            </div>
          </div>

          {/* Lead Times & Scheduling Preferences */}
          <div className="card p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" /> Reminder Timing & Timezone
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Study Reminder Lead Time
                </label>
                <select
                  value={notifSettings.reminder_lead_minutes}
                  onChange={(e) =>
                    setNotifSettings((s) => ({ ...s, reminder_lead_minutes: Number(e.target.value) }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before (Recommended)</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Local Timezone
                </label>
                <select
                  value={notifSettings.timezone}
                  onChange={(e) =>
                    setNotifSettings((s) => ({ ...s, timezone: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST • UTC+05:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST • UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT • UTC+08:00)</option>
                </select>
              </div>
            </div>

            {/* Exam Milestones */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08]">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Exam Reminder Schedule
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.exam_reminder_2_days}
                    onChange={(e) =>
                      setNotifSettings((s) => ({ ...s, exam_reminder_2_days: e.target.checked }))
                    }
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>2 Days Before Exam</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.exam_reminder_1_day}
                    onChange={(e) =>
                      setNotifSettings((s) => ({ ...s, exam_reminder_1_day: e.target.checked }))
                    }
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>1 Day Before (Final Prep)</span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifSettings.exam_reminder_day_of}
                    onChange={(e) =>
                      setNotifSettings((s) => ({ ...s, exam_reminder_day_of: e.target.checked }))
                    }
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Exam Day Morning</span>
                </label>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {savingNotif ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
