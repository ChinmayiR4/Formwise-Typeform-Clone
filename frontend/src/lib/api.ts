import type {
  Answers,
  FormDetail,
  FormResponse,
  FormSummary,
  FormSummaryStats,
  Insight,
  Question,
  RunnableForm,
  Workspace,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Listeners notified when a request is slow (free-tier backends sleep). */
type SlowListener = (slow: boolean) => void;
const slowListeners = new Set<SlowListener>();
let inflightSlow = 0;
export function onSlowRequest(fn: SlowListener) {
  slowListeners.add(fn);
  return () => {
    slowListeners.delete(fn);
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let markedSlow = false;
  const timer = setTimeout(() => {
    markedSlow = true;
    inflightSlow++;
    slowListeners.forEach((l) => l(true));
  }, 4000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let fieldErrors: Record<string, string> = {};
      try {
        const body = await res.json();
        const d = body?.detail;
        if (typeof d === "string") message = d;
        else if (d?.message) {
          message = d.message;
          fieldErrors = d.errors || {};
        } else if (Array.isArray(d) && d[0]?.msg) message = d[0].msg;
      } catch {
        /* non-JSON body */
      }
      throw new ApiError(res.status, message, fieldErrors);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") || "";
    return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    if (markedSlow) {
      inflightSlow--;
      if (inflightSlow === 0) slowListeners.forEach((l) => l(false));
    }
  }
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  // workspace
  workspaces: () => request<Workspace[]>("/api/workspaces"),
  createWorkspace: (name: string) => request<Workspace>("/api/workspaces", { method: "POST", body: json({ name }) }),
  renameWorkspace: (id: number, name: string) =>
    request<Workspace>(`/api/workspaces/${id}`, { method: "PATCH", body: json({ name }) }),
  deleteWorkspace: (id: number) => request<void>(`/api/workspaces/${id}`, { method: "DELETE" }),

  // forms
  forms: (params: { workspace_id?: number; q?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return request<FormSummary[]>(`/api/forms?${qs}`);
  },
  form: (id: number) => request<FormDetail>(`/api/forms/${id}`),
  createForm: (title: string, workspace_id?: number, questions: Question[] = []) =>
    request<FormDetail>("/api/forms", { method: "POST", body: json({ title, workspace_id, questions }) }),
  updateForm: (id: number, patch: Partial<Pick<FormDetail, "title" | "workspace_id" | "theme" | "welcome_screen" | "thankyou_screen" | "settings">>) =>
    request<FormDetail>(`/api/forms/${id}`, { method: "PATCH", body: json(patch) }),
  saveQuestions: (id: number, questions: Question[]) =>
    request<FormDetail>(`/api/forms/${id}/questions`, { method: "PUT", body: json({ questions }) }),
  deleteForm: (id: number) => request<void>(`/api/forms/${id}`, { method: "DELETE" }),
  duplicateForm: (id: number) => request<FormDetail>(`/api/forms/${id}/duplicate`, { method: "POST" }),
  publish: (id: number) => request<FormDetail>(`/api/forms/${id}/publish`, { method: "POST" }),
  unpublish: (id: number) => request<FormDetail>(`/api/forms/${id}/unpublish`, { method: "POST" }),

  // results
  responses: (id: number, params: { status?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return request<{ total: number; items: FormResponse[] }>(`/api/forms/${id}/responses?${qs}`);
  },
  deleteResponse: (formId: number, rid: number) =>
    request<void>(`/api/forms/${formId}/responses/${rid}`, { method: "DELETE" }),
  summary: (id: number) => request<FormSummaryStats>(`/api/forms/${id}/summary`),
  insights: (id: number) => request<{ items: Insight[] }>(`/api/forms/${id}/insights`, { method: "POST" }),
  csvUrl: (id: number) => `${API_URL}/api/forms/${id}/responses/export.csv`,

  // public respondent flow
  publicForm: (slug: string) => request<RunnableForm>(`/api/public/forms/${encodeURIComponent(slug)}`),
  recordView: (slug: string, visitor_id: string) =>
    request<void>(`/api/public/forms/${encodeURIComponent(slug)}/views`, { method: "POST", body: json({ visitor_id }) }),
  startResponse: (slug: string, answers: Answers, last_question_id?: string) =>
    request<{ token: string }>(`/api/public/forms/${encodeURIComponent(slug)}/responses`, {
      method: "POST",
      body: json({ answers, last_question_id }),
    }),
  savePartial: (slug: string, token: string, answers: Answers, last_question_id?: string) =>
    request<void>(`/api/public/forms/${encodeURIComponent(slug)}/responses/${token}`, {
      method: "PATCH",
      body: json({ answers, last_question_id }),
    }),
  submit: (slug: string, answers: Answers, token?: string | null) =>
    request<{ response_id: number }>(`/api/public/forms/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      body: json({ answers, token }),
    }),

  // AI
  aiStatus: () => request<{ enabled: boolean; model: string | null }>("/api/ai/status"),
  aiGenerateForm: (prompt: string) =>
    request<{ form: FormDetail; source: string }>("/api/ai/generate-form", { method: "POST", body: json({ prompt }) }),
  aiRewrite: (title: string, type: string) =>
    request<{ suggestions: string[]; source: string }>("/api/ai/rewrite-question", {
      method: "POST",
      body: json({ title, type }),
    }),
  aiSuggest: (form_title: string, existing: string[]) =>
    request<{ questions: Question[]; source: string }>("/api/ai/suggest-questions", {
      method: "POST",
      body: json({ form_title, existing }),
    }),
};
