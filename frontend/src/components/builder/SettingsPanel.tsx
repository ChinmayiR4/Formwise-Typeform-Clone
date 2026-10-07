"use client";

import { AtSign, ImageIcon, Info } from "lucide-react";
import { useState } from "react";
import { TYPE_META, convertQuestion } from "@/lib/questionTypes";
import { FONTS, THEME_PRESETS, fontCss, resolveTheme } from "@/lib/theme";
import type { FormDetail, Question, QuestionType, ScreenConfig, Theme } from "@/lib/types";
import { ComingSoon, Input, Toggle } from "../ui/primitives";
import { LogicEditor } from "./LogicEditor";
import type { Selection } from "./QuestionList";
import { TypeBadge } from "./TypeBadge";

type PanelTab = "question" | "logic" | "design";

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-1 text-[13px] text-ink-2">
        {label}
        {hint && (
          <span title={hint} className="text-muted">
            <Info size={12} />
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function NumberField({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <Input
      className="h-8 w-24 text-right"
      inputMode="decimal"
      placeholder={placeholder}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => {
        const v = e.target.value.trim();
        if (v === "") onChange(null);
        else if (!Number.isNaN(Number(v))) onChange(Number(v));
      }}
    />
  );
}

function QuestionSettings({ q, questions, onChange }: { q: Question; questions: Question[]; onChange: (q: Question) => void }) {
  const p = q.properties;
  const setProp = (patch: Partial<Question["properties"]>) => onChange({ ...q, properties: { ...p, ...patch } });
  const idx = questions.findIndex((x) => x.id === q.id);
  const earlier = questions.slice(0, idx);

  return (
    <div className="divide-y divide-line">
      <div className="pb-4">
        <label className="mb-1.5 block section-label">Type</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
            <TypeBadge type={q.type} size="sm" />
          </span>
          <select
            value={q.type}
            onChange={(e) => onChange(convertQuestion(q, e.target.value as QuestionType))}
            className="h-10 w-full appearance-none rounded-lg border border-line-2 bg-surface pl-12 pr-3 text-[14px] font-medium focus:border-violet focus:outline-none"
            aria-label="Question type"
          >
            {Object.values(TYPE_META).map((m) => (
              <option key={m.type} value={m.type}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="py-2">
        <div className="pb-1 pt-2 section-label">Settings</div>
        <Row label="Required">
          <Toggle checked={q.required} onChange={(required) => onChange({ ...q, required })} label="Required" />
        </Row>

        {q.type === "multiple_choice" && (
          <Row label="Multiple selection">
            <Toggle checked={!!p.allow_multiple} onChange={(v) => setProp({ allow_multiple: v })} label="Multiple selection" />
          </Row>
        )}
        {q.type === "dropdown" && (
          <Row label="Alphabetical order">
            <Toggle checked={!!p.alphabetical} onChange={(v) => setProp({ alphabetical: v })} label="Alphabetical order" />
          </Row>
        )}
        {q.type === "rating" && (
          <Row label="Steps">
            <select
              value={p.steps || 5}
              onChange={(e) => setProp({ steps: Number(e.target.value) })}
              className="h-8 rounded-md border border-line-2 bg-surface px-2 text-[13px]"
              aria-label="Rating steps"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Row>
        )}
        {q.type === "number" && (
          <>
            <Row label="Min number">
              <NumberField value={p.min} onChange={(min) => setProp({ min })} placeholder="None" />
            </Row>
            <Row label="Max number">
              <NumberField value={p.max} onChange={(max) => setProp({ max })} placeholder="None" />
            </Row>
          </>
        )}
        {(q.type === "short_text" || q.type === "long_text") && (
          <Row label="Max length">
            <NumberField value={p.max_length} onChange={(v) => setProp({ max_length: v ?? undefined })} placeholder="None" />
          </Row>
        )}
        {["short_text", "long_text", "email", "number", "dropdown"].includes(q.type) && (
          <div className="py-2.5">
            <label className="mb-1.5 block text-[13px] text-ink-2">Placeholder</label>
            <Input value={p.placeholder || ""} maxLength={120} onChange={(e) => setProp({ placeholder: e.target.value || undefined })} placeholder="Type your answer here..." />
          </div>
        )}
      </div>

      <div className="py-3">
        <div className="mb-2 flex items-center gap-1 section-label">
          <AtSign size={12} /> Recall information
        </div>
        {earlier.length === 0 ? (
          <p className="text-[12.5px] text-muted">Answers from earlier questions can be inserted into this question&apos;s title.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {earlier.map((e) => (
              <button
                key={e.id}
                onClick={() => onChange({ ...q, title: `${q.title}${q.title.endsWith(" ") || !q.title ? "" : " "}{{${e.id}}}` })}
                className="max-w-full truncate rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] hover:border-violet hover:text-violet"
                title={`Insert answer to Q${questions.indexOf(e) + 1}`}
              >
                Q{questions.indexOf(e) + 1}: {e.title.slice(0, 22) || "Untitled"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="py-3">
        <Row label="Image or video">
          <span className="flex items-center gap-1.5 text-muted">
            <ImageIcon size={14} />
            <ComingSoon small />
          </span>
        </Row>
      </div>
    </div>
  );
}

function DesignSettings({ form, onTheme, onSettings }: { form: FormDetail; onTheme: (t: Theme) => void; onSettings: (s: FormDetail["settings"]) => void }) {
  const theme = resolveTheme(form.theme);
  const colors: { key: keyof Theme; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "question_color", label: "Questions" },
    { key: "answer_color", label: "Answers" },
    { key: "button_color", label: "Buttons" },
    { key: "button_text_color", label: "Button text" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 section-label">Themes</div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((t) => (
            <button
              key={t.preset}
              onClick={() => onTheme(t)}
              className={`overflow-hidden rounded-lg border text-left transition ${theme.preset === t.preset ? "border-violet ring-2 ring-violet/25" : "border-line hover:border-line-2"}`}
            >
              <div className="flex h-14 flex-col justify-center gap-1.5 px-3" style={{ background: t.background }}>
                <span className="text-[13px] font-medium" style={{ color: t.question_color, fontFamily: fontCss(t.font) }}>
                  Question
                </span>
                <span className="flex gap-1">
                  <span className="h-2 w-8 rounded-full" style={{ background: t.answer_color }} />
                  <span className="h-2 w-4 rounded-full" style={{ background: t.button_color }} />
                </span>
              </div>
              <div className="px-3 py-1.5 text-[12px] capitalize">{t.preset}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 section-label">Customize</div>
        {colors.map((c) => (
          <Row key={c.key} label={c.label}>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              {String(theme[c.key]).toUpperCase()}
              <input
                type="color"
                value={String(theme[c.key])}
                onChange={(e) => onTheme({ ...theme, preset: "custom", [c.key]: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-line-2 bg-transparent p-0"
                aria-label={`${c.label} color`}
              />
            </label>
          </Row>
        ))}
        <Row label="Font">
          <select value={theme.font} onChange={(e) => onTheme({ ...theme, font: e.target.value })} className="h-8 rounded-md border border-line-2 bg-surface px-2 text-[13px]" aria-label="Font">
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Background image">
          <ComingSoon small />
        </Row>
      </div>
      <div>
        <div className="mb-1 section-label">Form settings</div>
        <Row label="Progress bar">
          <Toggle checked={form.settings?.show_progress_bar !== false} onChange={(v) => onSettings({ ...form.settings, show_progress_bar: v })} label="Progress bar" />
        </Row>
        <Row label="Background accents" hint="A soft glow and dot grid behind the questions">
          <Toggle checked={form.settings?.show_artwork !== false} onChange={(v) => onSettings({ ...form.settings, show_artwork: v })} label="Background accents" />
        </Row>
        <Row label="Question numbers">
          <Toggle checked={form.settings?.show_question_numbers !== false} onChange={(v) => onSettings({ ...form.settings, show_question_numbers: v })} label="Question numbers" />
        </Row>
      </div>
    </div>
  );
}

function ScreenSettings({ kind, screen, onChange }: { kind: "welcome" | "ending"; screen: Partial<ScreenConfig>; onChange: (p: Partial<ScreenConfig>) => void }) {
  return (
    <div className="space-y-3">
      <div className="text-[13px] font-semibold">{kind === "welcome" ? "Welcome screen" : "Thank you screen"}</div>
      {kind === "welcome" && (
        <Row label="Show welcome screen">
          <Toggle checked={!!screen.enabled} onChange={(enabled) => onChange({ enabled })} label="Show welcome screen" />
        </Row>
      )}
      <p className="text-[12.5px] leading-relaxed text-muted">Edit the title, description{kind === "welcome" ? " and button" : ""} directly on the canvas.</p>
      {kind === "ending" && (
        <div className="rounded-lg bg-cream p-3 text-[12.5px] text-muted">
          Multiple endings & redirect on completion <ComingSoon small />
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({
  form,
  questions,
  selection,
  onChangeQuestion,
  onChangeScreen,
  onTheme,
  onSettings,
}: {
  form: FormDetail;
  questions: Question[];
  selection: Selection;
  onChangeQuestion: (q: Question) => void;
  onChangeScreen: (kind: "welcome" | "ending", patch: Partial<ScreenConfig>) => void;
  onTheme: (t: Theme) => void;
  onSettings: (s: FormDetail["settings"]) => void;
}) {
  const [tab, setTab] = useState<PanelTab>("question");
  const q = questions.find((x) => x.id === selection);
  const tabs: { id: PanelTab; label: string }[] = [
    { id: "question", label: q ? "Question" : "Content" },
    { id: "logic", label: "Logic" },
    { id: "design", label: "Design" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-line px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-3 text-[13px] font-medium ${tab === t.id ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
            {t.id === "logic" && q && q.logic.length > 0 && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-violet align-middle" />}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" />}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "design" && <DesignSettings form={form} onTheme={onTheme} onSettings={onSettings} />}
        {tab === "question" && q && <QuestionSettings q={q} questions={questions} onChange={onChangeQuestion} />}
        {tab === "question" && (selection === "welcome" || selection === "ending") && (
          <ScreenSettings
            kind={selection}
            screen={selection === "welcome" ? form.welcome_screen : form.thankyou_screen}
            onChange={(p) => onChangeScreen(selection, p)}
          />
        )}
        {tab === "logic" && q && <LogicEditor q={q} questions={questions} onChange={onChangeQuestion} />}
        {tab === "logic" && !q && <p className="text-[13px] text-muted">Select a question to add logic jumps.</p>}
      </div>
    </div>
  );
}
