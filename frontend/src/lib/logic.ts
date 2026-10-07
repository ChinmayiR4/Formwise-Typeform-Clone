/** Client mirror of backend/app/services/logic.py — keep the two in sync. */
import type { AnswerValue, LogicOperator, Question } from "./types";

const isEmpty = (v: AnswerValue | undefined) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export function ruleMatches(q: Question, op: LogicOperator, ruleValue: string | null, answer: AnswerValue | undefined): boolean {
  if (op === "always") return true;
  if (isEmpty(answer)) return false;
  const rv = ruleValue ?? "";

  switch (q.type) {
    case "yes_no": {
      const target = ["true", "yes", "1"].includes(rv.toLowerCase());
      if (op === "is") return Boolean(answer) === target;
      if (op === "is_not") return Boolean(answer) !== target;
      return false;
    }
    case "multiple_choice": {
      const sel = Array.isArray(answer) ? answer : [String(answer)];
      if (op === "is" || op === "contains") return sel.includes(rv);
      if (op === "is_not" || op === "not_contains") return !sel.includes(rv);
      return false;
    }
    case "dropdown":
      if (op === "is") return answer === rv;
      if (op === "is_not") return answer !== rv;
      return false;
    case "number":
    case "rating": {
      const a = Number(answer);
      const b = Number(rv);
      if (Number.isNaN(a) || rv === "" || Number.isNaN(b)) return false;
      switch (op) {
        case "eq": case "is": return a === b;
        case "neq": case "is_not": return a !== b;
        case "gt": return a > b;
        case "gte": return a >= b;
        case "lt": return a < b;
        case "lte": return a <= b;
        default: return false;
      }
    }
    default: {
      const a = String(answer).trim().toLowerCase();
      const b = rv.trim().toLowerCase();
      switch (op) {
        case "is": case "eq": return a === b;
        case "is_not": case "neq": return a !== b;
        case "contains": return a.includes(b);
        case "not_contains": return !a.includes(b);
        default: return false;
      }
    }
  }
}

/** Next question id after `current`, or null for the end of the form. */
export function nextQuestionId(questions: Question[], current: Question, answer: AnswerValue | undefined): string | null {
  for (const r of current.logic || []) {
    if (ruleMatches(current, r.operator, r.value, answer)) {
      // A target that no longer exists falls back to the end.
      return r.target_question_id && questions.some((q) => q.id === r.target_question_id) ? r.target_question_id : null;
    }
  }
  const idx = questions.findIndex((q) => q.id === current.id);
  return idx >= 0 && idx + 1 < questions.length ? questions[idx + 1].id : null;
}

export const OPERATORS_BY_TYPE: Record<Question["type"], { value: LogicOperator; label: string }[]> = {
  short_text: [
    { value: "is", label: "is equal to" },
    { value: "is_not", label: "is not equal to" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
  long_text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
  email: [
    { value: "is", label: "is equal to" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
  ],
  multiple_choice: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  dropdown: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  yes_no: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  number: [
    { value: "eq", label: "is equal to" },
    { value: "neq", label: "is not equal to" },
    { value: "gt", label: "is greater than" },
    { value: "gte", label: "is greater or equal to" },
    { value: "lt", label: "is lower than" },
    { value: "lte", label: "is lower or equal to" },
  ],
  rating: [
    { value: "eq", label: "is equal to" },
    { value: "neq", label: "is not equal to" },
    { value: "gt", label: "is greater than" },
    { value: "gte", label: "is greater or equal to" },
    { value: "lt", label: "is lower than" },
    { value: "lte", label: "is lower or equal to" },
  ],
};
