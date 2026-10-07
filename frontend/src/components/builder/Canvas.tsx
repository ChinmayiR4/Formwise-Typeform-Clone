"use client";

import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { letter } from "@/lib/format";
import { newId } from "@/lib/ids";
import { isChoiceType } from "@/lib/questionTypes";
import { themeVars } from "@/lib/theme";
import type { FormDetail, Question, ScreenConfig } from "@/lib/types";
import { RunnerBackdrop } from "../art/Art";
import { AnswerInput } from "../respondent/QuestionInputs";
import { useToast } from "../ui/Toast";
import type { Selection } from "./QuestionList";

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  style,
  maxLength,
  autoFocus,
  ariaLabel,
  fit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
  maxLength?: number;
  autoFocus?: boolean;
  ariaLabel: string;
  /** shrink-wrap the textarea to its content so trailing markers (like *) sit right after the text */
  fit?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const area = (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={maxLength}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:opacity-40 ${fit ? "[grid-area:1/1]" : ""} ${className || ""}`}
      style={style}
    />
  );
  if (!fit) return area;
  return (
    <div className="grid min-w-[4ch] max-w-full">
      <span aria-hidden className={`invisible whitespace-pre-wrap break-words [grid-area:1/1] ${className || ""}`}>
        {(value || placeholder) + " "}
      </span>
      {area}
    </div>
  );
}

function ChoicesEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusNext = useRef<string | null>(null);
  const setFocusId = (id: string) => {
    focusNext.current = id;
  };
  useEffect(() => {
    if (focusNext.current) {
      refs.current[focusNext.current]?.focus();
      focusNext.current = null;
    }
  }, [q.choices]);

  const setLabel = (id: string, label: string) => onChange({ ...q, choices: q.choices.map((c) => (c.id === id ? { ...c, label } : c)) });
  const remove = (id: string) => {
    const idx = q.choices.findIndex((c) => c.id === id);
    onChange({ ...q, choices: q.choices.filter((c) => c.id !== id), logic: q.logic.filter((r) => r.value !== id) });
    const prev = q.choices[idx - 1];
    if (prev) setFocusId(prev.id);
  };
  const addAfter = (idx: number) => {
    const c = { id: newId(), label: "" };
    const choices = [...q.choices];
    choices.splice(idx + 1, 0, c);
    onChange({ ...q, choices });
    setFocusId(c.id);
  };

  return (
    <div className="inline-flex min-w-[260px] max-w-full flex-col gap-2">
      {q.choices.map((c, i) => (
        <div
          key={c.id}
          className="tf-answer-tint tf-answer-border group flex items-center gap-3 rounded-[4px] border px-2 py-1.5 text-[18px]"
          style={{ color: "var(--tf-answer)" }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border text-[12px] font-semibold"
            style={{ borderColor: "color-mix(in srgb, var(--tf-answer) 60%, transparent)" }}
          >
            {letter(i)}
          </span>
          <input
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            value={c.label}
            maxLength={500}
            placeholder={`Choice ${letter(i)}`}
            aria-label={`Choice ${letter(i)}`}
            onChange={(e) => setLabel(c.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAfter(i);
              } else if (e.key === "Backspace" && !c.label && q.choices.length > 1) {
                e.preventDefault();
                remove(c.id);
              }
            }}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-40"
          />
          {q.choices.length > 1 && (
            <button aria-label="Remove choice" onClick={() => remove(c.id)} className="rounded p-0.5 opacity-0 hover:bg-black/5 group-hover:opacity-80">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <button onClick={() => addAfter(q.choices.length - 1)} className="w-fit text-[15px] underline underline-offset-4 opacity-80 hover:opacity-100" style={{ color: "var(--tf-answer)" }}>
        Add choice
      </button>
    </div>
  );
}

function AIRewrite({ q, onPick }: { q: Question; onPick: (t: string) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const run = async () => {
    if (!q.title.trim()) {
      toast.info("Write a question first, then let AI polish it");
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const r = await api.aiRewrite(q.title, q.type);
      setItems(r.suggestions);
    } catch {
      toast.error("AI is unavailable right now");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="relative">
      <button
        onClick={run}
        title="Rewrite with AI"
        className="inline-flex items-center gap-1 rounded-full border border-violet/30 bg-white/80 px-2.5 py-1 text-[12px] font-medium text-violet shadow-sm backdrop-blur hover:bg-white"
      >
        <Sparkles size={13} /> Improve with AI
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-[320px] rounded-xl border border-line bg-surface p-2 text-ink shadow-[var(--shadow-pop)]" style={{ fontFamily: "var(--font-inter)" }}>
          <div className="flex items-center justify-between px-2 py-1 section-label">
            Suggestions
            <button aria-label="Close" onClick={() => setOpen(false)} className="rounded p-0.5 hover:bg-ink/5">
              <X size={14} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-muted">
              <Loader2 size={14} className="animate-spin" /> Thinking…
            </div>
          ) : (
            items.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-violet-tint"
              >
                {s}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ScreenEditor({
  screen,
  kind,
  onChange,
}: {
  screen: Partial<ScreenConfig>;
  kind: "welcome" | "ending";
  onChange: (patch: Partial<ScreenConfig>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-8 text-center">
      {kind === "welcome" && !screen.enabled && (
        <div className="mb-6 rounded-lg bg-black/5 px-3 py-2 text-[13px]" style={{ fontFamily: "var(--font-inter)" }}>
          The welcome screen is off. Turn it on in the panel on the right.
        </div>
      )}
      {kind === "ending" && (
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--tf-answer) 15%, transparent)", color: "var(--tf-answer)" }}>
          <Check size={26} strokeWidth={2.6} />
        </div>
      )}
      <AutoTextarea
        ariaLabel="Screen title"
        value={screen.title || ""}
        onChange={(title) => onChange({ title })}
        placeholder={kind === "welcome" ? "Say hi! Recall information with {{" : "Thanks for completing this form!"}
        className="text-center text-[28px] leading-tight"
        style={{ color: "var(--tf-question)" }}
        maxLength={300}
      />
      <AutoTextarea
        ariaLabel="Screen description"
        value={screen.description || ""}
        onChange={(description) => onChange({ description })}
        placeholder="Description (optional)"
        className="mt-3 text-center text-[18px] opacity-70"
        style={{ color: "var(--tf-question)" }}
        maxLength={1000}
      />
      {kind === "welcome" && (
        <div className="mt-8 inline-flex">
          <input
            aria-label="Button text"
            value={screen.button_text || ""}
            placeholder="Start"
            maxLength={40}
            onChange={(e) => onChange({ button_text: e.target.value })}
            className="tf-btn h-12 rounded-[4px] px-6 text-center text-[20px] font-semibold outline-none placeholder:text-current placeholder:opacity-70"
            style={{ width: `${Math.max(6, (screen.button_text || "Start").length + 3)}ch` }}
          />
        </div>
      )}
    </div>
  );
}

export function Canvas({
  form,
  questions,
  selection,
  onChangeQuestion,
  onChangeScreen,
  device,
}: {
  form: FormDetail;
  questions: Question[];
  selection: Selection;
  onChangeQuestion: (q: Question) => void;
  onChangeScreen: (kind: "welcome" | "ending", patch: Partial<ScreenConfig>) => void;
  device: "desktop" | "mobile";
}) {
  const idx = questions.findIndex((q) => q.id === selection);
  const q = idx >= 0 ? questions[idx] : null;
  const showNumbers = form.settings?.show_question_numbers !== false;
  const recallTokens = q ? [...q.title.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1]) : [];

  return (
    <div
      className={`tf-runner relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-xl border border-black/5 shadow-[var(--shadow-card)] transition-[max-width] duration-300 ${
        device === "mobile" ? "max-w-[390px]" : "max-w-none"
      }`}
      style={themeVars(form.theme)}
    >
      {form.settings?.show_artwork !== false && <RunnerBackdrop compact />}
      {form.settings?.show_progress_bar !== false && q && (
        <div className="h-1 w-full" style={{ background: "color-mix(in srgb, var(--tf-answer) 20%, transparent)" }}>
          <div className="h-full" style={{ width: `${(idx / Math.max(questions.length, 1)) * 100}%`, background: "var(--tf-answer)" }} />
        </div>
      )}
      <div className="relative flex flex-1 items-center overflow-y-auto py-12">
        {selection === "welcome" && <ScreenEditor kind="welcome" screen={form.welcome_screen} onChange={(p) => onChangeScreen("welcome", p)} />}
        {selection === "ending" && <ScreenEditor kind="ending" screen={form.thankyou_screen} onChange={(p) => onChangeScreen("ending", p)} />}
        {q && (
          <div key={q.id} className={`relative mx-auto w-full max-w-[720px] ${device === "mobile" ? "px-6" : "px-10 md:px-16"}`}>
            <div className="absolute right-4 top-[-36px] md:right-8">
              <AIRewrite q={q} onPick={(title) => onChangeQuestion({ ...q, title })} />
            </div>
            <div className="relative">
              {showNumbers && (
                <div
                  className={`flex items-center gap-1 text-[16px] font-medium ${device === "mobile" ? "mb-1" : "absolute -left-1 top-[5px] -translate-x-full pr-2"}`}
                  style={{ color: "var(--tf-answer)" }}
                >
                  {idx + 1}
                  <ArrowRight size={14} strokeWidth={2.5} />
                </div>
              )}
              <div className="flex items-start">
                <AutoTextarea
                  fit
                  ariaLabel="Question title"
                  value={q.title}
                  onChange={(title) => onChangeQuestion({ ...q, title })}
                  placeholder="Your question here. Recall information with {{"
                  className="text-[24px] leading-[1.3]"
                  style={{ color: "var(--tf-question)" }}
                  maxLength={2000}
                  autoFocus={!q.title}
                />
                {q.required && (
                  <span className="text-[24px]" style={{ color: "var(--tf-question)" }}>
                    *
                  </span>
                )}
              </div>
              {recallTokens.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-[12px]" style={{ fontFamily: "var(--font-inter)" }}>
                  {recallTokens.map((t) => {
                    const ri = questions.findIndex((x) => x.id === t);
                    return (
                      <span key={t} className="rounded bg-black/5 px-1.5 py-0.5" style={{ color: "var(--tf-question)" }}>
                        {`{{${t}}}`} → {ri >= 0 ? `answer to Q${ri + 1}` : "deleted question"}
                      </span>
                    );
                  })}
                </div>
              )}
              <AutoTextarea
                ariaLabel="Question description"
                value={q.description || ""}
                onChange={(description) => onChangeQuestion({ ...q, description })}
                placeholder="Description (optional)"
                className="mt-2 text-[18px] leading-snug opacity-70"
                style={{ color: "var(--tf-question)" }}
                maxLength={4000}
              />
            </div>
            <div className="mt-8">
              {isChoiceType(q.type) ? (
                q.type === "dropdown" ? (
                  <div className="space-y-4">
                    <div className="pointer-events-none">
                      <AnswerInput question={q} value={null} onChange={() => {}} onAutoAdvance={() => {}} readOnly />
                    </div>
                    <div className="rounded-lg bg-black/[0.03] p-3">
                      <div className="mb-2 text-[12px] font-medium opacity-60" style={{ fontFamily: "var(--font-inter)", color: "var(--tf-question)" }}>
                        Dropdown options
                      </div>
                      <ChoicesEditor q={q} onChange={onChangeQuestion} />
                    </div>
                  </div>
                ) : (
                  <>
                    {q.properties.allow_multiple && <p className="mb-3 text-[15px] opacity-70">Choose as many as you like</p>}
                    <ChoicesEditor q={q} onChange={onChangeQuestion} />
                  </>
                )
              ) : (
                <div className="pointer-events-none">
                  <AnswerInput question={q} value={null} onChange={() => {}} onAutoAdvance={() => {}} readOnly />
                </div>
              )}
            </div>
            <div className={`mt-6 flex items-center gap-3 ${
              idx !== questions.length - 1 && (q.type === "yes_no" || q.type === "rating" || q.type === "dropdown" || (q.type === "multiple_choice" && !q.properties.allow_multiple)) ? "hidden" : ""
            }`}>
              <span className="tf-btn inline-flex h-10 items-center gap-1.5 rounded-[4px] px-4 text-[18px] font-semibold">
                {idx === questions.length - 1 ? "Submit" : "OK"}
                {idx !== questions.length - 1 && <Check size={18} strokeWidth={3} />}
              </span>
            </div>
          </div>
        )}
        {!q && selection !== "welcome" && selection !== "ending" && (
          <div className="mx-auto text-center opacity-60" style={{ fontFamily: "var(--font-inter)" }}>
            Select a question on the left, or add a new one.
          </div>
        )}
      </div>
    </div>
  );
}
