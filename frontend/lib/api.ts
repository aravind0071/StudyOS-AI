/**
 * API client — centralized Axios instance for all StudyOS AI API calls.
 * Handles: base URL, auth tokens, error formatting.
 */

import axios, { AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("studyos_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Normalize error responses
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; detail?: unknown }>) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint =
        url.includes("/auth/login") ||
        url.includes("/auth/register") ||
        url.includes("/auth/verify") ||
        url.includes("/auth/forgot") ||
        url.includes("/auth/reset");

      // Only force redirect if an authenticated session expired on a protected page
      if (!isAuthEndpoint && typeof window !== "undefined") {
        localStorage.removeItem("studyos_token");
        localStorage.removeItem("studyos_user");
        if (!window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth";
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper: extract error message from response
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((e: { message: string }) => e.message).join(", ");
    }
    if (data?.message) return data.message;
    if (error.message === "Network Error") {
      return "Unable to connect to the server. Please check your connection.";
    }
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred. Please try again.";
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    full_name: string;
    email: string;
    mobile: string;
    password: string;
    confirm_password: string;
    college?: string;
    degree?: string;
    branch?: string;
    year_of_study?: number;
  }) => api.post("/auth/register", data),

  verifyRegistrationOtp: (user_id: string, otp: string) =>
    api.post("/auth/verify-registration-otp", { user_id, otp, purpose: "registration" }),

  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  verifyLoginOtp: (user_id: string, otp: string) =>
    api.post("/auth/verify-login-otp", { user_id, otp, purpose: "login" }),

  resendOtp: (user_id: string, purpose: string) =>
    api.post("/auth/resend-otp", { user_id, purpose }),

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (user_id: string, otp: string, new_password: string, confirm_password: string) =>
    api.post("/auth/reset-password", { user_id, otp, new_password, confirm_password }),

  logout: () => api.post("/auth/logout"),
};

// ─── Materials API ────────────────────────────────────────────────────────────

export const materialsApi = {
  upload: (formData: FormData) =>
    api.post("/materials/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  addUrl: (formData: FormData) =>
    api.post("/materials/add-url", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  list: (params?: { subject?: string; material_type?: string }) =>
    api.get("/materials/", { params }),

  get: (id: string) => api.get(`/materials/${id}`),

  getContent: (id: string) => api.get(`/materials/${id}/content`),

  getFileUrl: (id: string, token?: string) => {
    const t = token || (typeof window !== "undefined" ? localStorage.getItem("studyos_token") : "");
    return `${API_URL}/materials/${id}/file${t ? `?token=${encodeURIComponent(t)}` : ""}`;
  },

  retry: (id: string) => api.post(`/materials/${id}/retry`),

  delete: (id: string) => api.delete(`/materials/${id}`),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────

export const chatApi = {
  send: (
    message: string,
    session_id?: string,
    explain_level?: string,
    study_mode?: string,
    marks?: string,
    subject?: string,
    unit?: string
  ) =>
    api.post("/chat/", {
      message,
      session_id,
      explain_level,
      study_mode,
      marks,
      subject,
      unit,
    }),

  stream: async (
    data: {
      message: string;
      session_id?: string;
      explain_level?: string;
      study_mode?: string;
      marks?: string;
      subject?: string;
      unit?: string;
    },
    onToken: (token: string) => void,
    onMetadata?: (meta: {
      session_id: string;
      message_id?: string;
      sources?: any[];
      used_external_knowledge?: boolean;
      source_type?: string;
      source_label?: string;
      source_detail?: string;
    }) => void,
    signal?: AbortSignal
  ) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("studyos_token") : null;
    const response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) {
      let errDetail = "Streaming request failed.";
      try {
        const errJson = await response.json();
        errDetail = errJson.detail || errJson.message || errDetail;
      } catch {}
      throw new Error(errDetail);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.type === "start" && onMetadata) {
              onMetadata(parsed);
            } else if (parsed.type === "token") {
              onToken(parsed.token);
            } else if (parsed.type === "done" && onMetadata) {
              onMetadata(parsed);
            }
          } catch {}
        }
      }
    }
  },

  getSessions: () => api.get("/chat/sessions"),

  getHistory: (session_id: string) => api.get(`/chat/history/${session_id}`),

  deleteSession: (session_id: string) => api.delete(`/chat/sessions/${session_id}`),
};

// ─── Quiz API ─────────────────────────────────────────────────────────────────

export const quizApi = {
  generate: (data: {
    topics: string[];
    subject?: string;
    difficulty: string;
    quiz_type: string;
    num_questions: number;
  }) => api.post("/quiz/generate", data),

  start: (quiz_id: string) => api.post(`/quiz/start/${quiz_id}`),

  submit: (attempt_id: string, answers: Array<{ question_id: string; user_answer: string }>) =>
    api.post("/quiz/submit", { attempt_id, answers }),

  getHistory: () => api.get("/quiz/history"),
};

// ─── Study Plan API ───────────────────────────────────────────────────────────

export const studyPlanApi = {
  generate: (data: {
    subject?: string;
    exam_date?: string;
    available_hours_per_day?: number;
    current_knowledge_level?: string;
    preferred_study_time?: string;
    topics?: string[];
  }) => api.post("/study-plan/generate", data),

  getActive: () => api.get("/study-plan/active"),

  updateTask: (task_id: string, is_completed: boolean) =>
    api.patch(`/study-plan/task/${task_id}`, null, { params: { is_completed } }),

  addTask: (data: {
    plan_id?: string;
    topic: string;
    activity?: string;
    duration_minutes?: number;
    day_number?: number;
    scheduled_date?: string;
    priority?: number;
    reason?: string;
  }) => api.post("/study-plan/tasks", data),

  editTask: (
    task_id: string,
    data: {
      topic?: string;
      activity?: string;
      duration_minutes?: number;
      priority?: number;
      reason?: string;
      is_completed?: boolean;
    }
  ) => api.patch(`/study-plan/tasks/${task_id}`, data),

  rescheduleTask: (
    task_id: string,
    data: { day_number?: number; scheduled_date?: string }
  ) => api.patch(`/study-plan/tasks/${task_id}/reschedule`, data),

  deleteTask: (task_id: string) => api.delete(`/study-plan/tasks/${task_id}`),
};

// ─── Interview API ────────────────────────────────────────────────────────────

export const interviewApi = {
  start: (topic: string, mode?: string, project_description?: string) =>
    api.post("/interview/start", { topic, mode, project_description }),

  answer: (session_id: string, question_id: string, user_answer: string) =>
    api.post("/interview/answer", { session_id, question_id, user_answer }),

  skip: (session_id: string, question_id: string) =>
    api.post("/interview/skip", { session_id, question_id, user_answer: "[Skipped]" }),

  nextQuestion: (session_id: string, current_question_order: number) =>
    api.post("/interview/next-question", { session_id, current_question_order }),

  getSessions: () => api.get("/interview/sessions"),
  getSummary: (session_id: string) => api.get(`/interview/summary/${session_id}`),
};

// ─── Analytics API ────────────────────────────────────────────────────────────

export const analyticsApi = {
  getOverview: () => api.get("/analytics/overview"),
};

// ─── Search API ───────────────────────────────────────────────────────────────

export const searchApi = {
  search: (q: string, filter_type?: string) =>
    api.get("/search/", { params: { q, filter_type } }),
};

// ─── Profile API ──────────────────────────────────────────────────────────────

export const profileApi = {
  getMe: () => api.get("/profile/me"),

  update: (data: Record<string, unknown>) => api.patch("/profile/me", data),

  completeOnboarding: (data: {
    college?: string;
    degree?: string;
    branch?: string;
    year_of_study?: number;
    subjects: string[];
    goals: string[];
    daily_study_minutes: number;
  }) => api.post("/profile/onboarding", data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post("/profile/change-password", data),

  getKnowledgeGraph: () => api.get("/profile/knowledge-graph"),
};

// ─── Subjects & Units API ─────────────────────────────────────────────────────

export const subjectsApi = {
  list: () => api.get("/subjects/"),

  get: (id: string) => api.get(`/subjects/${id}`),

  create: (data: { name: string; code?: string; description?: string; color?: string; icon?: string }) =>
    api.post("/subjects/", data),

  update: (id: string, data: { name?: string; code?: string; description?: string; color?: string; icon?: string; target_exam_date?: string }) =>
    api.patch(`/subjects/${id}`, data),

  delete: (id: string) => api.delete(`/subjects/${id}`),

  seedCurriculum: () => api.post("/subjects/seed-curriculum"),

  createUnit: (subjectId: string, data: { unit_number: number; title: string; description?: string }) =>
    api.post(`/subjects/${subjectId}/units`, data),

  updateUnit: (unitId: string, data: { title?: string; description?: string; progress_percent?: number }) =>
    api.patch(`/subjects/units/${unitId}`, data),

  deleteUnit: (unitId: string) => api.delete(`/subjects/units/${unitId}`),

  addResource: (data: {
    subject_id: string;
    unit_id?: string;
    resource_type: string;
    title: string;
    description?: string;
    url?: string;
    tags?: string;
  }) => api.post("/subjects/resources", data),

  uploadResource: (formData: FormData) =>
    api.post("/subjects/resources/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  deleteResource: (resourceId: string) => api.delete(`/subjects/resources/${resourceId}`),

  getResourceContent: (resourceId: string) => api.get(`/subjects/resources/${resourceId}/content`),

  getResourceFileUrl: (resourceId: string, token?: string) => {
    const t = token || (typeof window !== "undefined" ? localStorage.getItem("studyos_token") : "");
    return `${API_URL}/subjects/resources/${resourceId}/file${t ? `?token=${encodeURIComponent(t)}` : ""}`;
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (unread_only?: boolean) =>
    api.get("/notifications/", { params: { unread_only } }),

  getUnreadCount: () => api.get("/notifications/unread-count"),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => prematureMarkAllRead(),

  delete: (id: string) => api.delete(`/notifications/${id}`),

  getSettings: () => api.get("/notifications/settings"),

  updateSettings: (data: {
    email_notifications?: boolean;
    login_alerts?: boolean;
    study_reminders?: boolean;
    exam_reminders?: boolean;
    study_plan_reminders?: boolean;
    in_app_notifications?: boolean;
    reminder_lead_minutes?: number;
    reminder_minutes_before?: number;
    exam_reminder_2_days?: boolean;
    exam_reminder_2days?: boolean;
    exam_reminder_1_day?: boolean;
    exam_reminder_1day?: boolean;
    exam_reminder_day_of?: boolean;
    timezone?: string;
  }) => api.patch("/notifications/settings", data),
};

function prematureMarkAllRead() {
  return api.post("/notifications/mark-all-read");
}

// ─── Reminders API ────────────────────────────────────────────────────────────

export const remindersApi = {
  getSessions: (params?: { upcoming_only?: boolean }) =>
    api.get("/reminders/study-sessions", { params }),

  createSession: (data: {
    subject_id?: string;
    unit_id?: string;
    topic: string;
    start_time: string; // ISO
    end_time: string;   // ISO
  }) => api.post("/reminders/study-sessions", data),

  deleteSession: (id: string) => api.delete(`/reminders/study-sessions/${id}`),

  getExams: () => api.get("/reminders/exams"),

  createExam: (data: {
    subject_name: string;
    subject_id?: string;
    exam_date: string; // ISO
    recommendations?: string;
  }) => api.post("/reminders/exams", data),

  deleteExam: (id: string) => api.delete(`/reminders/exams/${id}`),

  checkAndDispatch: () => api.post("/reminders/check-and-dispatch"),
};

// ─── Study Tools API ─────────────────────────────────────────────────────────

export const studyToolsApi = {
  generateRevisionNotes: (data: {
    topic: string;
    subject?: string;
    unit?: string;
    material_id?: string;
  }) => api.post("/study-tools/revision-notes", data),

  generateExamNotes: (data: {
    topic: string;
    marks?: number;
    subject?: string;
    unit?: string;
  }) => api.post("/study-tools/exam-notes", data),

  generateStudyPack: (data: {
    subject: string;
    unit?: string;
  }) => api.post("/study-tools/study-pack", data),

  extractModelPaper: (formData: FormData) =>
    api.post("/study-tools/model-paper/extract", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  extractModelPaperText: (raw_text: string) => {
    const fd = new FormData();
    fd.append("raw_text", raw_text);
    return api.post("/study-tools/model-paper/extract", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  answerModelPaperQuestion: (data: {
    question: any;
    subject?: string;
    unit?: string;
  }) => api.post("/study-tools/model-paper/answer", data),

  answerAllModelPaperQuestions: (data: {
    questions: any[];
    subject?: string;
    unit?: string;
  }) => api.post("/study-tools/model-paper/answer-all", data),
};

// ─── Notes API ────────────────────────────────────────────────────────────────

export const notesApi = {
  create: (data: {
    title: string;
    content: string;
    tags?: string[];
    subject_id?: string;
    unit_id?: string;
  }) => api.post("/notes/", data),

  list: (params?: { search?: string; subject_id?: string }) =>
    api.get("/notes/", { params }),

  get: (id: string) => api.get(`/notes/${id}`),

  delete: (id: string) => api.delete(`/notes/${id}`),
};

