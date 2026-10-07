"use client";

import { Plus, Search, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, COMING_SOON, TYPE_META } from "@/lib/questionTypes";
import type { Question, QuestionType } from "@/lib/types";
import { Modal } from "../ui/Modal";
import { Button, ComingSoon, Spinner } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { TypeBadge } from "./TypeBadge";

export function AddContentModal({
  open,
  onClose,
  onAdd,
  onAddQuestions,
  formTitle,
  existingTitles,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (t: QuestionType) => void;
  onAddQuestions: (qs: Question[]) => void;
  formTitle: string;
  existingTitles: string[];
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Question[] | null>(null);

  const match = (label: string) => label.toLowerCase().includes(q.toLowerCase());

  const suggest = async () => {
    setSuggesting(true);
    try {
      const r = await api.aiSuggest(formTitle, existingTitles);
      setSuggestions(r.questions);
    } catch {
      toast.error("Couldn't get suggestions right now");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width={860} bare>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-[18px] font-semibold">Add form elements</h2>
        <button aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-ink/5">
          <X size={18} />
        </button>
      </div>
      <div className="grid max-h-[72vh] overflow-y-auto md:grid-cols-[1fr_280px]">
        <div className="p-6">
          <div className="relative mb-5">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find question type"
              className="h-10 w-full rounded-lg border border-line-2 pl-9 pr-3 text-sm focus:border-violet focus:outline-none"
            />
          </div>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {CATEGORIES.map((cat) => {
              const real = Object.values(TYPE_META).filter((m) => m.category === cat && match(m.label));
              const soon = COMING_SOON.filter((m) => m.category === cat && match(m.label));
              if (!real.length && !soon.length) return null;
              return (
                <div key={cat}>
                  <div className="mb-1.5 section-label">{cat}</div>
                  {real.map((m) => (
                    <button
                      key={m.type}
                      onClick={() => {
                        onAdd(m.type);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[14px] hover:bg-cream-2"
                      title={m.hint}
                    >
                      <TypeBadge type={m.type} />
                      {m.label}
                    </button>
                  ))}
                  {soon.map((m) => (
                    <div key={m.label} className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-2 py-2 text-[14px] text-muted">
                      <span className="inline-flex h-7 w-[30px] items-center justify-center rounded-md bg-cream-2">
                        <m.icon size={14} />
                      </span>
                      {m.label}
                      <ComingSoon small />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="border-t border-line bg-violet-tint p-6 md:border-l md:border-t-0">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-violet" /> AI suggestions
          </div>
          <p className="mt-1 text-[13px] text-muted">Get question ideas that fit “{formTitle}”.</p>
          {!suggestions && (
            <Button variant="accent" className="mt-4 w-full" icon={<Sparkles size={15} />} loading={suggesting} onClick={suggest}>
              Suggest questions
            </Button>
          )}
          {suggesting && suggestions && <Spinner className="mt-4" />}
          {suggestions && (
            <div className="mt-4 flex flex-col gap-2">
              {suggestions.length === 0 && <p className="text-[13px] text-muted">No new ideas — your form looks complete!</p>}
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onAddQuestions([s]);
                    setSuggestions((xs) => xs?.filter((x) => x.id !== s.id) ?? null);
                    toast.success("Question added");
                  }}
                  className="group flex items-start gap-2 rounded-lg border border-violet/20 bg-surface p-3 text-left text-[13px] hover:border-violet"
                >
                  <TypeBadge type={s.type} size="sm" />
                  <span className="flex-1">{s.title}</span>
                  <Plus size={15} className="mt-0.5 text-violet opacity-60 group-hover:opacity-100" />
                </button>
              ))}
              <button onClick={suggest} className="mt-1 text-[12px] font-medium text-violet hover:underline">
                {suggesting ? "Thinking…" : "Suggest more"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
