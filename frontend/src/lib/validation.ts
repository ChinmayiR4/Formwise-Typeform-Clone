/** Client mirror of backend/app/services/validation.py (server stays the source of truth). */
import type { AnswerValue, Question } from "./types";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmptyAnswer = (v: AnswerValue | undefined) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Returns an error message, or null when the answer is acceptable. */
export function validateAnswer(q: Question, value: AnswerValue | undefined): string | null {
  if (isEmptyAnswer(value)) return q.required ? "Please fill this in" : null;
  const p = q.properties || {};
  switch (q.type) {
    case "short_text":
    case "long_text": {
      const limit = p.max_length || (q.type === "short_text" ? 1000 : 10000);
      return String(value).trim().length > limit ? `Please keep it under ${limit} characters` : null;
    }
    case "email":
      return EMAIL_RE.test(String(value).trim()) ? null : "Hmm... that email doesn't look valid";
    case "number": {
      const n = Number(value);
      if (typeof value === "boolean" || Number.isNaN(n) || !Number.isFinite(n)) return "Numbers only please";
      if (p.min !== undefined && p.min !== null && n < p.min) return `Number must be at least ${p.min}`;
      if (p.max !== undefined && p.max !== null && n > p.max) return `Number must be at most ${p.max}`;
      return null;
    }
    case "rating": {
      const steps = p.steps || 5;
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= steps ? null : `Rating must be between 1 and ${steps}`;
    }
    case "dropdown":
      return q.choices.some((c) => c.id === value) ? null : "Please select an option from the list";
    case "multiple_choice": {
      const sel = Array.isArray(value) ? value : [String(value)];
      if (!sel.every((s) => q.choices.some((c) => c.id === s))) return "Please select a valid option";
      if (!p.allow_multiple && sel.length > 1) return "Please select only one option";
      return null;
    }
    case "yes_no":
      return typeof value === "boolean" ? null : "Please choose Yes or No";
  }
}

/** Value as it is sent to the API (numbers parsed, text trimmed). */
export function normalizeForSubmit(q: Question, value: AnswerValue | undefined): AnswerValue {
  if (isEmptyAnswer(value)) return null;
  if (q.type === "number") return Number(value);
  if (typeof value === "string") return value.trim();
  return value ?? null;
}
