import type { Answers, Question } from "./types";

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(s: number | null | undefined): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export const letter = (i: number) => String.fromCharCode(65 + i);

/** Display string for a respondent's answer (used by recall). */
export function answerText(q: Question | undefined, v: Answers[string]): string {
  if (v === null || v === undefined || !q) return "";
  if (q.type === "yes_no") return v ? "Yes" : "No";
  if (q.type === "multiple_choice" || q.type === "dropdown") {
    const ids = Array.isArray(v) ? v : [String(v)];
    return ids.map((id) => q.choices.find((c) => c.id === id)?.label ?? "").filter(Boolean).join(", ");
  }
  return String(v);
}

/**
 * "Recall information": replace {{question_id}} in titles with the respondent's
 * answer (Typeform's @-mention piping). Unanswered references render as "...".
 */
export function recall(text: string, questions: Question[], answers: Answers): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, id: string) => {
    const q = questions.find((x) => x.id === id);
    const t = answerText(q, answers[id]);
    return t || "...";
  });
}

/** In the builder, show recall tokens as the referenced question's short label. */
export function recallLabel(text: string, questions: Question[]): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, id: string) => {
    const idx = questions.findIndex((x) => x.id === id);
    return idx >= 0 ? `[Q${idx + 1} answer]` : "[deleted answer]";
  });
}

export function publicUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/to/${slug}`;
}
