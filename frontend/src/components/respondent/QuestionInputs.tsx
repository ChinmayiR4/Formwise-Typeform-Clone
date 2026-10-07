"use client";

import { Check, ChevronDown, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { letter } from "@/lib/format";
import type { AnswerValue, Question } from "@/lib/types";

export interface InputProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  /** Called when the input wants to move on (single choice picked, Enter in dropdown, …). */
  onAutoAdvance: () => void;
  /** Builder canvas: render statically, never steal focus. */
  readOnly?: boolean;
  autoFocus?: boolean;
}

/* ------------------------------------------------------------------ text */

export function TextAnswer({ question, value, onChange, readOnly, autoFocus }: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !readOnly) setTimeout(() => ref.current?.focus({ preventScroll: true }), 350);
  }, [autoFocus, readOnly]);
  const type = question.type === "email" ? "email" : "text";
  const placeholder =
    question.properties.placeholder ||
    (question.type === "email" ? "name@example.com" : question.type === "number" ? "Type a number..." : "Type your answer here...");
  return (
    <input
      ref={ref}
      type={type}
      inputMode={question.type === "number" ? "decimal" : question.type === "email" ? "email" : "text"}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : 0}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => {
        let v = e.target.value;
        if (question.type === "number") v = v.replace(/[^0-9.\-]/g, "");
        onChange(v);
      }}
      placeholder={placeholder}
      className="tf-input w-full bg-transparent pb-2 text-[22px] leading-snug md:text-[28px]"
      aria-label={question.title || "Answer"}
      autoComplete={question.type === "email" ? "email" : "off"}
    />
  );
}

export function LongTextAnswer({ question, value, onChange, readOnly, autoFocus }: InputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus && !readOnly) setTimeout(() => ref.current?.focus({ preventScroll: true }), 350);
  }, [autoFocus, readOnly]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : 0}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.properties.placeholder || "Type your answer here..."}
      className="tf-input w-full resize-none bg-transparent pb-2 text-[22px] leading-snug md:text-[28px]"
      aria-label={question.title || "Answer"}
    />
  );
}

/* ---------------------------------------------------------------- choices */

function ChoiceBox({
  k,
  label,
  selected,
  blinking,
  onClick,
  readOnly,
}: {
  k: string;
  label: string;
  selected: boolean;
  blinking?: boolean;
  onClick: () => void;
  readOnly?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={readOnly ? -1 : 0}
      onClick={readOnly ? undefined : onClick}
      aria-pressed={selected}
      className={`tf-answer-tint tf-answer-border group flex w-full min-w-[200px] items-center gap-3 rounded-[4px] border px-2 py-1.5 text-left text-[17px] transition-[box-shadow,background] md:text-[20px] ${
        selected ? "shadow-[inset_0_0_0_1px_var(--tf-answer)]" : ""
      } ${blinking ? "tf-blink" : ""}`}
      style={{ color: "var(--tf-answer)" }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border text-[12px] font-semibold"
        style={{
          borderColor: "color-mix(in srgb, var(--tf-answer) 60%, transparent)",
          background: selected ? "var(--tf-answer)" : "color-mix(in srgb, var(--tf-bg) 85%, transparent)",
          color: selected ? "var(--tf-bg)" : "var(--tf-answer)",
        }}
      >
        {k}
      </span>
      <span className="flex-1 break-words">{label}</span>
      <Check size={20} className={`shrink-0 transition-opacity ${selected ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}

export function MultipleChoiceAnswer({ question, value, onChange, onAutoAdvance, readOnly }: InputProps) {
  const multi = !!question.properties.allow_multiple;
  const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
  const [blink, setBlink] = useState<string | null>(null);
  const choices = question.choices;

  const toggle = (id: string) => {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
      return;
    }
    if (selected[0] === id) {
      onChange([]);
      return;
    }
    onChange([id]);
    setBlink(id);
    setTimeout(() => {
      setBlink(null);
      onAutoAdvance();
    }, 520);
  };

  // Letter shortcuts (A, B, C…)
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const idx = e.key.toUpperCase().charCodeAt(0) - 65;
      if (e.key.length === 1 && idx >= 0 && idx < choices.length) {
        e.preventDefault();
        toggle(choices[idx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      {multi && <p className="mb-3 text-[15px] opacity-70">Choose as many as you like</p>}
      <div className="inline-flex min-w-[min(100%,260px)] max-w-full flex-col gap-2">
        {choices.map((c, i) => (
          <ChoiceBox
            key={c.id}
            k={letter(i)}
            label={c.label}
            selected={selected.includes(c.id)}
            blinking={blink === c.id}
            onClick={() => toggle(c.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

export function YesNoAnswer({ value, onChange, onAutoAdvance, readOnly }: InputProps) {
  const [blink, setBlink] = useState<boolean | null>(null);
  const pick = (v: boolean) => {
    onChange(v);
    setBlink(v);
    setTimeout(() => {
      setBlink(null);
      onAutoAdvance();
    }, 520);
  };
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === "y") pick(true);
      if (e.key.toLowerCase() === "n") pick(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="inline-flex w-[200px] flex-col gap-2">
      <ChoiceBox k="Y" label="Yes" selected={value === true} blinking={blink === true} onClick={() => pick(true)} readOnly={readOnly} />
      <ChoiceBox k="N" label="No" selected={value === false} blinking={blink === false} onClick={() => pick(false)} readOnly={readOnly} />
    </div>
  );
}

/* ----------------------------------------------------------------- rating */

export function RatingAnswer({ question, value, onChange, onAutoAdvance, readOnly }: InputProps) {
  const steps = question.properties.steps || 5;
  const [hover, setHover] = useState<number | null>(null);
  const current = typeof value === "number" ? value : value ? Number(value) : 0;
  const shown = hover ?? current;
  const pick = (n: number) => {
    onChange(n);
    setTimeout(onAutoAdvance, 450);
  };
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      const n = e.key === "0" ? 10 : Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= steps) pick(n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="flex max-w-full flex-wrap gap-1 md:gap-2" onMouseLeave={() => setHover(null)} role="radiogroup">
      {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={`${n} of ${steps}`}
          tabIndex={readOnly ? -1 : 0}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && pick(n)}
          className="flex flex-col items-center gap-1 px-0.5"
          style={{ color: "var(--tf-answer)" }}
        >
          <Star
            className="h-9 w-9 transition-transform md:h-11 md:w-11"
            strokeWidth={1.4}
            style={{
              fill: n <= shown ? "var(--tf-answer)" : "transparent",
              transform: hover === n ? "scale(1.08)" : undefined,
            }}
          />
          <span className="text-[14px] font-medium">{n}</span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- dropdown */

export function DropdownAnswer({ question, value, onChange, onAutoAdvance, readOnly, autoFocus }: InputProps) {
  const options = useMemo(() => {
    const cs = [...question.choices];
    if (question.properties.alphabetical) cs.sort((a, b) => a.label.localeCompare(b.label));
    return cs;
  }, [question.choices, question.properties.alphabetical]);
  const selected = options.find((c) => c.id === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && !readOnly) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
  }, [autoFocus, readOnly]);

  const filtered = options.filter((c) => !query || selected?.label === query || c.label.toLowerCase().includes(query.toLowerCase()));

  const choose = (id: string) => {
    const c = options.find((x) => x.id === id)!;
    onChange(id);
    setQuery(c.label);
    setOpen(false);
    setTimeout(onAutoAdvance, 380);
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : 0}
          value={query}
          placeholder={question.properties.placeholder || "Type or select an option"}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (selected) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && filtered[active] && !selected) {
              e.preventDefault();
              e.stopPropagation();
              choose(filtered[active].id);
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={`dd-${question.id}`}
          className="tf-input w-full bg-transparent pb-2 pr-10 text-[22px] md:text-[28px]"
          aria-label={question.title || "Answer"}
        />
        <span className="pointer-events-none absolute right-1 top-1.5 flex gap-1" style={{ color: "var(--tf-answer)" }}>
          {selected && !readOnly ? (
            <button
              type="button"
              className="pointer-events-auto"
              aria-label="Clear"
              onClick={() => {
                onChange(null);
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={26} />
            </button>
          ) : (
            <ChevronDown size={28} />
          )}
        </span>
      </div>
      {open && !readOnly && (
        <div
          ref={listRef}
          id={`dd-${question.id}`}
          role="listbox"
          className="absolute z-10 mt-2 max-h-[240px] w-full overflow-y-auto rounded p-1"
          style={{ background: "var(--tf-bg)", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}
        >
          {filtered.length === 0 && <div className="px-3 py-2 text-[16px] opacity-60">No suggestions found</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              data-idx={i}
              role="option"
              aria-selected={c.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c.id)}
              onMouseEnter={() => setActive(i)}
              className={`tf-answer-border mb-1 block w-full rounded-[4px] border px-3 py-2 text-left text-[17px] ${i === active ? "tf-answer-tint" : ""}`}
              style={{ color: "var(--tf-answer)" }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnswerInput(props: InputProps) {
  switch (props.question.type) {
    case "long_text":
      return <LongTextAnswer {...props} />;
    case "multiple_choice":
      return <MultipleChoiceAnswer {...props} />;
    case "dropdown":
      return <DropdownAnswer {...props} />;
    case "yes_no":
      return <YesNoAnswer {...props} />;
    case "rating":
      return <RatingAnswer {...props} />;
    default:
      return <TextAnswer {...props} />;
  }
}
