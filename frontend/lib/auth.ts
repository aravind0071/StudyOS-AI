/**
 * Auth utility helpers — token storage, user session, validation.
 */

export interface StoredUser {
  id: string;
  email: string;
  full_name: string;
  college?: string;
  degree?: string;
  branch?: string;
  year_of_study?: number;
  onboarding_completed?: boolean;
}

export interface PendingAuthSession {
  userId: string;
  email: string;
  purpose: "registration" | "login" | "password_reset";
  timestamp: number;
  step?: string;
  expiresAt?: number;
}

export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("studyos_token", token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("studyos_token");
  }
  return null;
}

export function saveUser(user: StoredUser): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("studyos_user", JSON.stringify(user));
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("studyos_user");
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
  }
  return null;
}

export function savePendingAuth(data: {
  userId: string;
  email: string;
  purpose: "registration" | "login" | "password_reset";
  step?: string;
  expiresAt?: number;
}): void {
  if (typeof window !== "undefined") {
    const timestamp = Date.now();
    const expiresAt = data.expiresAt || (timestamp + 10 * 60 * 1000);
    sessionStorage.setItem("studyos_pending_auth", JSON.stringify({ ...data, timestamp, expiresAt }));
  }
}

export function getPendingAuth(): PendingAuthSession | null {
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem("studyos_pending_auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Valid for 15 minutes (matches OTP validity window)
        if (Date.now() - (parsed.timestamp || 0) < 15 * 60 * 1000) {
          return parsed;
        }
        sessionStorage.removeItem("studyos_pending_auth");
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearPendingAuth(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("studyos_pending_auth");
  }
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("studyos_token");
    localStorage.removeItem("studyos_user");
    localStorage.removeItem("studyos_pending_user_id");
    localStorage.removeItem("studyos_pending_purpose");
    clearPendingAuth();
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  const masked = "*".repeat(Math.min(local.length - 2, 5));
  return `${visible}${masked}@${domain}`;
}

// Password validation
export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  matches: boolean;
}

export function validatePassword(password: string, confirmPassword?: string): PasswordValidation {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password),
    matches: confirmPassword !== undefined ? password === confirmPassword && password.length > 0 : true,
  };
}

export function isPasswordValid(validation: PasswordValidation): boolean {
  return Object.values(validation).every(Boolean);
}

export function validateIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  const cleaned = mobile.replace(/[\s\-\(\)\+]/g, "").replace(/^91/, "").trim();
  return /^[6-9]\d{9}$/.test(cleaned);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
