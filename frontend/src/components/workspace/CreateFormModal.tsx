"use client";

import { ArrowLeft, FilePlus2, FileUp, LayoutTemplate, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { blankQuestion } from "@/lib/questionTypes";
import { Modal } from "../ui/Modal";
import { Button, ComingSoon } from "../ui/primitives";
import { useToast } from "../ui/Toast";

const EXAMPLES = [
  "Customer feedback survey for a coffee shop",
  "RSVP form for a design meetup",
  "Job application for a frontend engineer",
  "Employee engagement pulse survey",
];

export function CreateFormModal({ open, onClose, workspaceId }: { open: boolean; onClose: () => void; workspaceId?: number }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"pick" | "ai">("pick");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"scratch" | "ai" | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => setMode("pick"), 200);
  };

  const fromScratch = async () => {
    setBusy("scratch");
    try {
      const f = await api.createForm("My new form", workspaceId, [blankQuestion("short_text")]);
      router.push(`/form?id=${f.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create form");
      setBusy(null);
    }
  };

  const withAI = async () => {
    if (prompt.trim().length < 3) return;
    setBusy("ai");
    try {
      const { form, source } = await api.aiGenerateForm(prompt.trim());
      if (workspaceId && form.workspace_id !== workspaceId) await api.updateForm(form.id, { workspace_id: workspaceId });
      toast.success(source === "hf" ? "Your AI-generated form is ready ✨" : "Draft created from a smart template (AI offline)");
      router.push(`/form?id=${form.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "AI generation failed");
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={close} width={720} bare>
      {mode === "pick" ? (
        <div className="p-6 md:p-8">
          <h2 className="text-[22px] font-semibold">Create a new form</h2>
          <p className="mt-1 text-sm text-muted">Pick how you want to start. You can change everything later.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <button
              onClick={fromScratch}
              disabled={!!busy}
              className="group flex flex-col items-start rounded-xl border border-line bg-cream/60 p-5 text-left transition hover:border-ink/30 hover:bg-cream"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white">
                <FilePlus2 size={20} />
              </span>
              <span className="mt-4 font-semibold">Start from scratch</span>
              <span className="mt-1 text-[13px] text-muted">A blank canvas with your first question ready.</span>
              {busy === "scratch" && <span className="mt-2 text-[12px] text-violet">Creating…</span>}
            </button>
            <button
              onClick={() => setMode("ai")}
              disabled={!!busy}
              className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-violet/30 bg-violet-tint p-5 text-left transition hover:border-violet"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet text-white shadow-[0_6px_16px_-6px_var(--violet)]">
                <Sparkles size={20} />
              </span>
              <span className="mt-4 font-semibold">Create with AI</span>
              <span className="mt-1 text-[13px] text-muted">Describe your form and we&apos;ll draft the questions.</span>
            </button>
            <div className="flex flex-col items-start rounded-xl border border-dashed border-line-2 p-5 text-left opacity-80">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream-2 text-ink-2">
                <LayoutTemplate size={20} />
              </span>
              <span className="mt-4 flex items-center gap-2 font-semibold">
                Templates <ComingSoon small />
              </span>
              <span className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                <FileUp size={13} /> Import questions too
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 md:p-8">
          <button onClick={() => setMode("pick")} className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="flex items-center gap-2 text-[22px] font-semibold">
            <Wand2 size={22} className="text-violet" /> Create with AI
          </h2>
          <p className="mt-1 text-sm text-muted">Tell us what the form is for and who it&apos;s for. Be as specific as you like.</p>
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && withAI()}
            maxLength={1000}
            rows={4}
            placeholder="e.g. A short feedback survey for customers of my bakery, asking about taste, price and service"
            className="mt-5 w-full resize-none rounded-xl border border-line-2 bg-surface p-4 text-[15px] focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full border border-line bg-cream px-3 py-1 text-[12.5px] text-ink-2 hover:border-violet hover:text-violet">
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] text-muted">Powered by open models on Hugging Face</span>
            <Button variant="accent" size="lg" icon={<Sparkles size={16} />} loading={busy === "ai"} disabled={prompt.trim().length < 3} onClick={withAI}>
              {busy === "ai" ? "Generating…" : "Generate form"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
