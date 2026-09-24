"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain, Eye, EyeOff, Mail, Lock, User, Phone, Building2,
  BookOpen, AlertCircle, CheckCircle, Loader2, Shield, ArrowLeft,
  RefreshCw, GraduationCap, Sparkles, KeyRound, LogIn, UserPlus,
  ChevronDown, Calendar, Layers
} from "lucide-react";
import { toast } from "sonner";
import { authApi, getErrorMessage } from "@/lib/api";
import {
  validatePassword, isPasswordValid, validateIndianMobile, maskEmail,
  saveToken, saveUser, savePendingAuth, getPendingAuth, clearPendingAuth, PasswordValidation
} from "@/lib/auth";
import { ISTClockBadge } from "@/components/ui/ISTClockBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import clsx from "clsx";

// ── Password requirement indicator ───────────────────────────────────────────
function PasswordReq({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={clsx("flex items-center gap-2 text-xs transition-colors duration-200",
      met ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-500 dark:text-slate-400")}>
      {met
        ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
        : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-500/60 flex-shrink-0" />
      }
      <span className="truncate">{label}</span>
    </div>
  );
}

// ── Option constants for registration dropdowns ──────────────────────────────
const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year" },
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

// ── Input field component ─────────────────────────────────────────────────────
function InputField({
  id, label, type = "text", value, onChange, error, icon: Icon,
  placeholder, required, rightElement, name, autoComplete = "off"
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; icon: React.ElementType;
  placeholder?: string; required?: boolean; rightElement?: React.ReactNode;
  name?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-emerald-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
          <Icon className="w-4 h-4 flex-shrink-0" />
        </div>
        <input
          id={id}
          name={name || id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            paddingLeft: "2.25rem",
            paddingRight: rightElement ? "2.5rem" : "0.875rem",
          }}
          className={clsx(
            "input-field",
            rightElement ? "input-has-icon-both" : "input-has-icon-left",
            error && "input-error"
          )}
          autoComplete={autoComplete}
        />
        {rightElement && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center z-10">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-rose-500 dark:text-rose-400 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ── Select field component ────────────────────────────────────────────────────
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 dark:text-slate-400 z-10">
            <Icon className="w-4 h-4 flex-shrink-0" />
          </div>
        )}
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            paddingLeft: Icon ? "2.125rem" : "0.75rem",
            paddingRight: "1.75rem",
          }}
          className={clsx(
            "input-field text-sm cursor-pointer [background-image:none] appearance-none text-left",
            !value ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100",
            error && "input-error"
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
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-400 flex items-center justify-center">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-rose-500 dark:text-rose-400 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}


// ── OTP Input ─────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[idx]) {
        // Clear current cell
        newDigits[idx] = "";
        onChange(newDigits.join("").trimEnd());
      } else if (idx > 0) {
        // Move to and clear previous cell
        newDigits[idx - 1] = "";
        onChange(newDigits.join("").trimEnd());
        const el = document.getElementById(`studyos-otp-${idx - 1}`) as HTMLInputElement;
        if (el) el.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      document.getElementById(`studyos-otp-${idx - 1}`)?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      e.preventDefault();
      document.getElementById(`studyos-otp-${idx + 1}`)?.focus();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (!rawVal) {
      const newDigits = [...digits];
      newDigits[idx] = "";
      onChange(newDigits.join("").trimEnd());
      return;
    }

    // Multi-digit entry (browser autofill, SMS autofill, or paste into field)
    if (rawVal.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < rawVal.length && (idx + i) < 6; i++) {
        newDigits[idx + i] = rawVal[i];
      }
      const fullVal = newDigits.join("").slice(0, 6);
      onChange(fullVal);
      const nextFocus = Math.min(5, idx + rawVal.length);
      document.getElementById(`studyos-otp-${nextFocus}`)?.focus();
      return;
    }

    // Single digit entry
    const newDigits = [...digits];
    newDigits[idx] = rawVal;
    const fullVal = newDigits.join("").slice(0, 6);
    onChange(fullVal);
    if (idx < 5) {
      document.getElementById(`studyos-otp-${idx + 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const focusIdx = Math.min(5, pasted.length);
    document.getElementById(`studyos-otp-${focusIdx}`)?.focus();
  };

  return (
    <div
      className="flex gap-1.5 sm:gap-2.5 justify-center max-w-full"
      onPaste={handlePaste}
      data-lpignore="true"
      data-1p-ignore="true"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          id={`studyos-otp-${i}`}
          name={`studyos_verification_code_${i}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={digits[i] || ""}
          onChange={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="otp-input select-none"
          autoFocus={i === 0}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          aria-label={`Digit ${i + 1} of verification code`}
        />
      ))}
    </div>
  );
}

// ── OTP Timer ─────────────────────────────────────────────────────────────────
function OtpTimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  useEffect(() => {
    setSeconds(totalSeconds);
  }, [totalSeconds]);
  useEffect(() => {
    if (seconds <= 0) { onExpire(); return; }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, onExpire]);
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return (
    <span className={clsx("font-mono font-bold", seconds <= 60 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
      {m}:{s}
    </span>
  );
}

// ── Logo Header Component (Memoized at top-level to prevent unmounting/blinking) ──
const Logo = memo(function Logo() {
  return (
    <div className="text-center mb-7">
      <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-emerald-500/20 border border-emerald-400/20">
        <Brain className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        StudyOS <span className="gradient-text">AI</span>
      </h1>
      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">Personal AI Learning Operating System</p>
      
      {/* Live IST Time & Date down under StudyOS AI */}
      <div className="mt-3 flex justify-center">
        <ISTClockBadge />
      </div>
    </div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// Main Auth Page Component
// ═════════════════════════════════════════════════════════════════════════════
type AuthStep = "tabs" | "otp" | "forgot-email" | "forgot-otp" | "reset-password";
type ActiveTab = "signin" | "register";

export default function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = (params.get("tab") === "register" ? "register" : "signin") as ActiveTab;

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [step, setStep] = useState<AuthStep>("tabs");
  const [loading, setLoading] = useState(false);

  // Pending user state (for OTP verification)
  const [pendingUserId, setPendingUserId] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPurpose, setPendingPurpose] = useState<"registration" | "login" | "password_reset">("login");
  const [otpTimerKey, setOtpTimerKey] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  // Register form
  const [reg, setReg] = useState({
    full_name: "", email: "", mobile: "", password: "", confirm_password: "",
    college: "", degree: "", branch: "", year_of_study: "",
  });
  const [customDegree, setCustomDegree] = useState("");
  const [customBranch, setCustomBranch] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [pwValidation, setPwValidation] = useState<PasswordValidation>({
    minLength: false, hasUppercase: false, hasLowercase: false,
    hasNumber: false, hasSpecial: false, matches: false,
  });

  // OTP
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // Reset form values on mount so refreshing the page never shows stale/autofilled credentials
  useEffect(() => {
    setLoginEmail("");
    setLoginPassword("");
    setReg({
      full_name: "", email: "", mobile: "", password: "", confirm_password: "",
      college: "", degree: "", branch: "", year_of_study: "",
    });
    setCustomDegree("");
    setCustomBranch("");
    setOtp("");
    setDemoOtp(null);
    setLoginErrors({});
    setRegErrors({});

    // Restore pending OTP verification session (e.g. when mobile/tablet user returns from email app)
    const pending = getPendingAuth();
    if (pending && pending.userId && pending.email) {
      setPendingUserId(pending.userId);
      setPendingEmail(pending.email);
      setPendingPurpose(pending.purpose);
      if (pending.step === "forgot-otp") {
        setStep("forgot-otp");
      } else {
        setStep("otp");
      }
      setResendCooldown(30);
      setOtpTimerKey(k => k + 1);
    }
  }, []);

  // Update password validation on change
  useEffect(() => {
    setPwValidation(validatePassword(reg.password, reg.confirm_password));
  }, [reg.password, reg.confirm_password]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Switch tab cleanly and clear validation errors
  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    setOtp("");
    setDemoOtp(null);
    setLoginErrors({});
    setRegErrors({});
  };

  // Helper: update login email & clear error immediately
  const updateLoginEmail = (val: string) => {
    setLoginEmail(val);
    if (loginErrors.email) {
      setLoginErrors(prev => {
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  };

  // Helper: update login password & clear error immediately
  const updateLoginPassword = (val: string) => {
    setLoginPassword(val);
    if (loginErrors.password) {
      setLoginErrors(prev => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
  };

  // Helper: update register fields & clear specific error immediately upon typing
  const updateRegField = (field: string, val: string) => {
    setReg(prev => ({ ...prev, [field]: val }));
    if (regErrors[field]) {
      setRegErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ── Login handler ───────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!loginEmail.trim()) errors.email = "Email is required.";
    if (!loginPassword) errors.password = "Password is required.";
    if (Object.keys(errors).length) { setLoginErrors(errors); return; }
    setLoginErrors({});
    setLoading(true);
    try {
      const { data } = await authApi.login(loginEmail.trim(), loginPassword);
      setPendingUserId(data.user_id);
      setPendingEmail(data.email);
      const purpose = data.is_registration_verification ? "registration" : "login";
      setPendingPurpose(purpose);
      savePendingAuth({ userId: data.user_id, email: data.email, purpose, step: "otp" });
      setOtp("");
      setDemoOtp(data.demo_otp || null);
      if (data.is_registration_verification) {
        toast.info("Account pending verification. Enter the code sent to your email.");
      } else {
        toast.success("Security verification code sent to your email.");
      }
      setOtpTimerKey(k => k + 1);
      setResendCooldown(60);
      setStep("otp");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Register handler ─────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!reg.full_name.trim()) errors.full_name = "Full name is required.";
    if (!reg.email.trim()) errors.email = "Email is required.";
    if (!reg.mobile.trim()) errors.mobile = "Mobile number is required.";
    else if (!validateIndianMobile(reg.mobile)) errors.mobile = "Enter a valid 10-digit Indian mobile number.";
    if (!reg.password) errors.password = "Password is required.";
    else if (!isPasswordValid(pwValidation)) errors.password = "Password does not meet requirements.";
    if (reg.password !== reg.confirm_password) errors.confirm_password = "Passwords do not match.";
    if (Object.keys(errors).length) { setRegErrors(errors); return; }
    setRegErrors({});
    setLoading(true);

    const finalDegree = reg.degree === "Other" ? customDegree.trim() : reg.degree?.trim();
    const finalBranch = reg.branch === "Other" ? customBranch.trim() : reg.branch?.trim();

    try {
      const { data } = await authApi.register({
        full_name: reg.full_name.trim(),
        email: reg.email.trim().toLowerCase(),
        mobile: reg.mobile.trim(),
        password: reg.password,
        confirm_password: reg.confirm_password,
        college: reg.college?.trim() || undefined,
        degree: finalDegree || undefined,
        branch: finalBranch || undefined,
        year_of_study: reg.year_of_study ? parseInt(reg.year_of_study) : undefined,
      });
      setPendingUserId(data.user_id);
      setPendingEmail(data.email);
      setPendingPurpose("registration");
      savePendingAuth({ userId: data.user_id, email: data.email, purpose: "registration", step: "otp" });
      setOtp("");
      setDemoOtp(data.demo_otp || null);
      toast.success("Account created! Verification code sent to your email.");
      setOtpTimerKey(k => k + 1);
      setResendCooldown(60);
      setStep("otp");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verification handler ──────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Please enter the 6-digit code."); return; }
    setLoading(true);
    try {
      let data;
      if (pendingPurpose === "registration") {
        ({ data } = await authApi.verifyRegistrationOtp(pendingUserId, otp));
      } else if (pendingPurpose === "login") {
        ({ data } = await authApi.verifyLoginOtp(pendingUserId, otp));
      } else {
        // password reset OTP step
        setStep("reset-password");
        setLoading(false);
        return;
      }
      if (data.access_token) {
        saveToken(data.access_token);
      }
      if (data.user) {
        saveUser(data.user);
      }
      clearPendingAuth();
      toast.success(data.message || "Verified successfully!");
      if (pendingPurpose === "registration") {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { data } = await authApi.resendOtp(pendingUserId, pendingPurpose);
      setOtpTimerKey(k => k + 1);
      setResendCooldown(60);
      setOtp("");
      setDemoOtp(data.demo_otp || null);
      toast.success("New verification code sent to your email.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error("Please enter your email."); return; }
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(forgotEmail);
      toast.success(data.message);
      if (data.user_id) {
        setPendingUserId(data.user_id);
        setPendingEmail(forgotEmail);
        setPendingPurpose("password_reset");
        savePendingAuth({ userId: data.user_id, email: forgotEmail, purpose: "password_reset", step: "forgot-otp" });
        setOtp("");
        setDemoOtp(data.demo_otp || null);
        setOtpTimerKey(k => k + 1);
        setResendCooldown(60);
        setStep("forgot-otp");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Please enter the 6-digit code."); return; }
    setStep("reset-password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const pv = validatePassword(newPassword, confirmNewPw);
    if (!isPasswordValid(pv)) { toast.error("Password does not meet requirements."); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(pendingUserId, otp, newPassword, confirmNewPw);
      clearPendingAuth();
      toast.success("Password reset successfully! Please log in.");
      setStep("tabs");
      setActiveTab("signin");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4 relative">
      {/* Floating Theme Toggle top-right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background blobs */}
      <div className="fixed top-1/4 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="card-glass p-6 sm:p-8 animate-fadeIn shadow-2xl">
          {/* ── OTP Verification (Login / Registration) ─────────────────── */}
          {step === "otp" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Two-Step Verification</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1.5">
                  Enter the 6-digit security code sent to
                </p>
                <div className="mt-2">
                  <span className="inline-block font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/25 text-xs font-semibold">
                    {maskEmail(pendingEmail)}
                  </span>
                </div>
                {demoOtp && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>Demo mode code:</span>
                    <span className="font-mono font-bold tracking-wider">{demoOtp}</span>
                    <button
                      type="button"
                      onClick={() => setOtp(demoOtp)}
                      className="ml-1 text-[11px] underline font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 cursor-pointer"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-3">
                  Please check your inbox or spam folder. It may take a moment to arrive.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6" autoComplete="off">
                <OtpInput value={otp} onChange={setOtp} />

                <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Code expires in:{" "}
                  <OtpTimer
                    key={otpTimerKey}
                    totalSeconds={300}
                    onExpire={() => toast.warning("Code has expired. Please request a new one.")}
                  />
                </div>

                <button type="submit" disabled={loading || otp.length < 6} className="btn-primary w-full py-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {loading ? "Verifying..." : "Verify & Continue"}
                </button>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                    className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline disabled:opacity-40 disabled:no-underline bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearPendingAuth();
                      setOtp("");
                      setDemoOtp(null);
                      setStep("tabs");
                    }}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to sign in
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Forgot Password — Enter Email ───────────────────────────── */}
          {step === "forgot-email" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setDemoOtp(null);
                  setStep("tabs");
                }}
                className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mb-6 bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <Logo />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Forgot Password</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Enter your registered email to receive a reset code.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <InputField id="forgot-email" label="Email Address" type="email" icon={Mail}
                  value={forgotEmail} onChange={setForgotEmail} required placeholder="you@example.com" />
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                  {loading ? "Sending..." : "Send Reset Code"}
                </button>
              </form>
            </>
          )}

          {/* ── Forgot Password — Verify OTP ────────────────────────────── */}
          {step === "forgot-otp" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Verify Reset Code</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1.5">
                  Enter the 6-digit password reset code sent to
                </p>
                <div className="mt-2">
                  <span className="inline-block font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/25 text-xs font-semibold">
                    {maskEmail(pendingEmail)}
                  </span>
                </div>
                {demoOtp && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>Demo mode code:</span>
                    <span className="font-mono font-bold tracking-wider">{demoOtp}</span>
                    <button
                      type="button"
                      onClick={() => setOtp(demoOtp)}
                      className="ml-1 text-[11px] underline font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 cursor-pointer"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-3">
                  Please check your inbox or spam folder. It may take a moment to arrive.
                </p>
              </div>

              <form onSubmit={handleForgotOtp} className="space-y-6" autoComplete="off">
                <OtpInput value={otp} onChange={setOtp} />
                <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Expires in:{" "}
                  <OtpTimer
                    key={otpTimerKey}
                    totalSeconds={300}
                    onExpire={() => toast.warning("Reset code has expired. Please request a new one.")}
                  />
                </div>
                <button type="submit" disabled={otp.length < 6} className="btn-primary w-full py-3">
                  Continue to Reset Password
                </button>
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                    className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline disabled:opacity-40 disabled:no-underline bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp("");
                      setDemoOtp(null);
                      setStep("forgot-email");
                    }}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5 bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" /> Change email
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Reset Password ───────────────────────────────────────────── */}
          {step === "reset-password" && (
            <>
              <Logo />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Create New Password</h2>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <InputField
                  id="new-pw"
                  label="New Password"
                  type={showNewPw ? "text" : "password"}
                  icon={Lock}
                  value={newPassword}
                  onChange={setNewPassword}
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowNewPw(v => !v)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors focus:outline-none bg-transparent border-0 flex items-center justify-center"
                      title={showNewPw ? "Hide password" : "Show password"}
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <InputField id="confirm-new-pw" label="Confirm Password" type={showNewPw ? "text" : "password"} icon={Lock}
                  value={confirmNewPw} onChange={setConfirmNewPw} required />
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(validatePassword(newPassword, confirmNewPw)).map(([key, met]) => (
                    <PasswordReq key={key} met={met} label={{
                      minLength: "8+ characters", hasUppercase: "Uppercase letter",
                      hasLowercase: "Lowercase letter", hasNumber: "Number",
                      hasSpecial: "Special character", matches: "Passwords match",
                    }[key] || key} />
                  ))}
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

          {/* ── Main Tabs (Sign In / Register) ──────────────────────────── */}
          {step === "tabs" && (
            <>
              <Logo />

              {/* Tabs with explicit dividing line and premium segmented control */}
              <div className="relative flex items-center p-1.5 rounded-2xl bg-slate-100/95 dark:bg-slate-900/90 border border-slate-200/90 dark:border-white/[0.12] shadow-inner mb-6 backdrop-blur-sm">
                {/* Sign In Button */}
                <button
                  type="button"
                  id="tab-signin"
                  onClick={() => handleTabSwitch("signin")}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none cursor-pointer",
                    activeTab === "signin"
                      ? "bg-white dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-sm border border-slate-200/90 dark:border-emerald-500/40"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border border-transparent"
                  )}
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In</span>
                </button>

                {/* Visible Dividing Line */}
                <div className="w-[1.5px] h-6 bg-slate-300 dark:bg-slate-700 mx-1.5 shrink-0 rounded-full" aria-hidden="true" />

                {/* New Registration Button */}
                <button
                  type="button"
                  id="tab-register"
                  onClick={() => handleTabSwitch("register")}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 focus:outline-none cursor-pointer",
                    activeTab === "register"
                      ? "bg-white dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-sm border border-slate-200/90 dark:border-emerald-500/40"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border border-transparent"
                  )}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>New Registration</span>
                </button>
              </div>

              {/* ── SIGN IN FORM ────────────────────────────────────────── */}
              {activeTab === "signin" && (
                <form onSubmit={handleLogin} className="space-y-4" autoComplete="off" noValidate>
                  {/* Browser autofill deterrent */}
                  <input type="text" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="off" />
                  <input type="password" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="new-password" />

                  <InputField
                    id="login-email"
                    name="studyos_login_email"
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    value={loginEmail}
                    onChange={updateLoginEmail}
                    error={loginErrors.email}
                    required
                    placeholder="you@example.com"
                    autoComplete="off"
                  />
                  <InputField
                    id="login-password"
                    name="studyos_login_password"
                    label="Password"
                    type={showLoginPw ? "text" : "password"}
                    icon={Lock}
                    value={loginPassword}
                    onChange={updateLoginPassword}
                    error={loginErrors.password}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowLoginPw(v => !v)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none bg-transparent border-0 flex items-center justify-center"
                        title={showLoginPw ? "Hide password" : "Show password"}
                      >
                        {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setOtp("");
                        setDemoOtp(null);
                        setStep("forgot-email");
                      }}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline bg-transparent border-0 p-0 transition-colors focus:outline-none cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {loading ? "Signing in..." : "Continue"}
                  </button>
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("register")}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold hover:underline bg-transparent border-0 p-0 ml-1 transition-colors focus:outline-none cursor-pointer"
                    >
                      Create one
                    </button>
                  </p>
                </form>
              )}

              {/* ── REGISTER FORM ───────────────────────────────────────── */}
              {activeTab === "register" && (
                <form onSubmit={handleRegister} className="space-y-4" autoComplete="off" noValidate>
                  {/* Browser autofill deterrent */}
                  <input type="text" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="off" />
                  <input type="password" className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="new-password" />

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <GraduationCap className="w-3.5 h-3.5" /> Register as Student
                  </div>

                  <InputField
                    id="full-name"
                    name="studyos_reg_fullname"
                    label="Full Name"
                    icon={User}
                    value={reg.full_name}
                    onChange={(v) => updateRegField("full_name", v)}
                    error={regErrors.full_name}
                    required
                    placeholder="Arjun Kumar"
                    autoComplete="off"
                  />

                  <InputField
                    id="reg-email"
                    name="studyos_reg_email"
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    value={reg.email}
                    onChange={(v) => updateRegField("email", v)}
                    error={regErrors.email}
                    required
                    placeholder="you@example.com"
                    autoComplete="off"
                  />

                  <InputField
                    id="mobile"
                    name="studyos_reg_mobile"
                    label="Mobile Number"
                    icon={Phone}
                    value={reg.mobile}
                    onChange={(v) => updateRegField("mobile", v)}
                    error={regErrors.mobile}
                    required
                    placeholder="9876543210"
                    autoComplete="off"
                  />

                  <InputField
                    id="password"
                    name="studyos_reg_password"
                    label="Password"
                    type={showRegPw ? "text" : "password"}
                    icon={Lock}
                    value={reg.password}
                    onChange={(v) => updateRegField("password", v)}
                    error={regErrors.password}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowRegPw(v => !v)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none bg-transparent border-0 flex items-center justify-center"
                        title={showRegPw ? "Hide password" : "Show password"}
                      >
                        {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {/* Password requirements */}
                  {reg.password && (
                    <div className="grid grid-cols-2 gap-1.5 p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.06] rounded-xl">
                      <PasswordReq met={pwValidation.minLength} label="8+ characters" />
                      <PasswordReq met={pwValidation.hasUppercase} label="Uppercase letter" />
                      <PasswordReq met={pwValidation.hasLowercase} label="Lowercase letter" />
                      <PasswordReq met={pwValidation.hasNumber} label="Number" />
                      <PasswordReq met={pwValidation.hasSpecial} label="Special character" />
                      <PasswordReq met={pwValidation.matches} label="Passwords match" />
                    </div>
                  )}

                  <InputField
                    id="confirm-password"
                    name="studyos_reg_confirm_password"
                    label="Confirm Password"
                    type={showRegConfirmPw ? "text" : "password"}
                    icon={Lock}
                    value={reg.confirm_password}
                    onChange={(v) => updateRegField("confirm_password", v)}
                    error={regErrors.confirm_password}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPw(v => !v)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none bg-transparent border-0 flex items-center justify-center"
                        title={showRegConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showRegConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />

                  {/* Optional fields — Dropdowns for Year of Study, Degree, Branch */}
                  <div className="border-t border-slate-200 dark:border-white/[0.08] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Academic Details (Optional)
                      </p>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Can update later
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* College / University */}
                      <div className="sm:col-span-2">
                        <InputField
                          id="college"
                          name="studyos_college"
                          label="College / University"
                          icon={Building2}
                          value={reg.college}
                          onChange={(v) => updateRegField("college", v)}
                          placeholder="e.g. SRKR Engineering College, IIT"
                          autoComplete="off"
                        />
                      </div>

                      {/* Year of Study Dropdown */}
                      <div>
                        <SelectField
                          id="year_of_study"
                          label="Year of Study"
                          value={reg.year_of_study}
                          onChange={(v) => updateRegField("year_of_study", v)}
                          options={YEAR_OPTIONS}
                          placeholder="Select Year"
                          icon={Calendar}
                        />
                      </div>

                      {/* Degree Dropdown */}
                      <div>
                        <SelectField
                          id="degree"
                          label="Degree"
                          value={reg.degree}
                          onChange={(v) => updateRegField("degree", v)}
                          options={DEGREE_OPTIONS}
                          placeholder="Select Degree"
                          icon={GraduationCap}
                        />
                      </div>

                      {/* Custom Degree input when "Other" is selected */}
                      {reg.degree === "Other" && (
                        <div className="sm:col-span-2 animate-fadeIn">
                          <InputField
                            id="custom_degree"
                            label="Specify Degree Name"
                            icon={GraduationCap}
                            value={customDegree}
                            onChange={setCustomDegree}
                            placeholder="e.g. B.Com Honours, MBBS, etc."
                            autoComplete="off"
                          />
                        </div>
                      )}

                      {/* Branch Dropdown */}
                      <div className="sm:col-span-2">
                        <SelectField
                          id="branch"
                          label="Branch / Specialization"
                          value={reg.branch}
                          onChange={(v) => updateRegField("branch", v)}
                          options={BRANCH_OPTIONS}
                          placeholder="Select Branch / Specialization"
                          icon={Layers}
                        />
                      </div>

                      {/* Custom Branch input when "Other" is selected */}
                      {reg.branch === "Other" && (
                        <div className="sm:col-span-2 animate-fadeIn">
                          <InputField
                            id="custom_branch"
                            label="Specify Branch / Specialization"
                            icon={Layers}
                            value={customBranch}
                            onChange={setCustomBranch}
                            placeholder="e.g. Aerospace Engineering, Robotics"
                            autoComplete="off"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap className="w-5 h-5" />}
                    {loading ? "Creating account..." : "Create Account"}
                  </button>

                  <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("signin")}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold hover:underline bg-transparent border-0 p-0 ml-1 transition-colors focus:outline-none cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-sm inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none">
            <ArrowLeft className="w-4 h-4" /> Back to StudyOS AI
          </Link>
        </div>
      </div>
    </div>
  );
}
