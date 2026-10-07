"use client";

import { ArrowRight, GitBranch, Plus, Trash2 } from "lucide-react";
import { newId } from "@/lib/ids";
import { OPERATORS_BY_TYPE } from "@/lib/logic";
import type { LogicRule, Question } from "@/lib/types";
import { Button } from "../ui/primitives";

const END = "__end__";
const NEXT = "__next__";

const selectCls = "h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-[13px] focus:border-violet focus:outline-none";

/**
 * Logic jumps for one question: "If answer <op> <value> → go to <question|end>",
 * evaluated top to bottom, plus an "All other cases" fallback (stored as an
 * `always` rule at the end). Jumps can only target later questions.
 */
export function LogicEditor({ q, questions, onChange }: { q: Question; questions: Question[]; onChange: (q: Question) => void }) {
  const idx = questions.findIndex((x) => x.id === q.id);
  const later = questions.slice(idx + 1);
  const ops = OPERATORS_BY_TYPE[q.type];
  const conditional = q.logic.filter((r) => r.operator !== "always");
  const fallback = q.logic.find((r) => r.operator === "always");

  const write = (cond: LogicRule[], fb: LogicRule | undefined) => onChange({ ...q, logic: fb ? [...cond, fb] : cond });

  const defaultValue = () => {
    if (q.type === "yes_no") return "true";
    if (q.type === "multiple_choice" || q.type === "dropdown") return q.choices[0]?.id ?? "";
    if (q.type === "rating") return String(Math.ceil((q.properties.steps || 5) / 2));
    return "";
  };

  const addRule = () =>
    write([...conditional, { id: newId(), operator: ops[0].value, value: defaultValue(), target_question_id: later[0]?.id ?? null }], fallback);
  const update = (id: string, patch: Partial<LogicRule>) =>
    write(conditional.map((r) => (r.id === id ? { ...r, ...patch } : r)), fallback);
  const remove = (id: string) => write(conditional.filter((r) => r.id !== id), fallback);

  const targetSelect = (value: string | null, onSel: (v: string | null) => void, allowNext = false) => (
    <select
      className={selectCls}
      value={value === null ? END : value}
      onChange={(e) => onSel(e.target.value === END ? null : e.target.value)}
      aria-label="Jump to"
    >
      {allowNext && <option value={NEXT}>Next question (default)</option>}
      {later.map((t) => (
        <option key={t.id} value={t.id}>
          {questions.indexOf(t) + 1}. {t.title.slice(0, 40) || "Untitled"}
        </option>
      ))}
      <option value={END}>Ending — thank you screen</option>
    </select>
  );

  const valueInput = (r: LogicRule) => {
    if (q.type === "yes_no")
      return (
        <select className={selectCls} value={r.value ?? "true"} onChange={(e) => update(r.id, { value: e.target.value })} aria-label="Value">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    if (q.type === "multiple_choice" || q.type === "dropdown")
      return (
        <select className={selectCls} value={r.value ?? ""} onChange={(e) => update(r.id, { value: e.target.value })} aria-label="Value">
          {q.choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || "(empty choice)"}
            </option>
          ))}
        </select>
      );
    if (q.type === "rating")
      return (
        <select className={selectCls} value={r.value ?? "1"} onChange={(e) => update(r.id, { value: e.target.value })} aria-label="Value">
          {Array.from({ length: q.properties.steps || 5 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
      );
    return (
      <input
        className={selectCls}
        value={r.value ?? ""}
        inputMode={q.type === "number" ? "decimal" : "text"}
        placeholder={q.type === "number" ? "0" : "Value"}
        onChange={(e) => update(r.id, { value: e.target.value })}
        aria-label="Value"
      />
    );
  };

  if (idx === questions.length - 1)
    return (
      <div className="rounded-lg bg-cream p-3 text-[13px] text-muted">
        This is the last question — respondents always go to the ending next. Add questions after it to create logic jumps.
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Send people to different questions based on their answer. Rules run top to bottom; the first match wins.
      </p>
      {conditional.map((r, i) => (
        <div key={r.id} className="space-y-2 rounded-lg border border-line bg-cream/50 p-3">
          <div className="flex items-center justify-between section-label">
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} className="text-violet" /> {i === 0 ? "If" : "Else if"} answer
            </span>
            <button aria-label="Delete rule" onClick={() => remove(r.id)} className="rounded p-1 text-muted hover:bg-danger-soft hover:text-danger">
              <Trash2 size={13} />
            </button>
          </div>
          <select className={selectCls} value={r.operator} onChange={(e) => update(r.id, { operator: e.target.value as LogicRule["operator"] })} aria-label="Condition">
            {ops.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {valueInput(r)}
          <div className="flex items-center gap-1.5 pt-1 section-label">
            <ArrowRight size={13} /> then jump to
          </div>
          {targetSelect(r.target_question_id, (v) => update(r.id, { target_question_id: v }))}
        </div>
      ))}
      <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addRule} className="w-full">
        Add rule
      </Button>
      <div className="space-y-2 border-t border-line pt-3">
        <div className="section-label">All other cases go to</div>
        {targetSelect(
          fallback ? fallback.target_question_id : NEXT,
          (v) =>
            write(
              conditional,
              v === NEXT ? undefined : { id: fallback?.id ?? newId(), operator: "always", value: null, target_question_id: v },
            ),
          true,
        )}
      </div>
    </div>
  );
}
