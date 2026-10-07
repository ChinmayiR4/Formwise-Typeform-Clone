"use client";

import { Monitor, PanelLeft, Plus, Smartphone, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AddContentModal } from "@/components/builder/AddContentModal";
import { BuilderHeader, type Tab } from "@/components/builder/BuilderHeader";
import { Canvas } from "@/components/builder/Canvas";
import { ConnectTab } from "@/components/builder/ConnectTab";
import { QuestionList, type Selection } from "@/components/builder/QuestionList";
import { SettingsPanel } from "@/components/builder/SettingsPanel";
import { ShareTab } from "@/components/builder/ShareTab";
import { useFormEditor } from "@/components/builder/useFormEditor";
import { FormRunner } from "@/components/respondent/FormRunner";
import { ResultsTab } from "@/components/results/ResultsTab";
import { Modal } from "@/components/ui/Modal";
import { Button, IconButton, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { newId } from "@/lib/ids";
import { blankQuestion, isChoiceType } from "@/lib/questionTypes";
import type { Question, QuestionType, Workspace } from "@/lib/types";

/** Drop logic rules that became invalid after a reorder/delete (server rejects them). */
function sanitizeLogic(qs: Question[]): Question[] {
  const pos = new Map(qs.map((q, i) => [q.id, i]));
  return qs.map((q, i) => {
    const logic = q.logic.filter((r) => {
      if (r.target_question_id !== null && !((pos.get(r.target_question_id) ?? -1) > i)) return false;
      if (isChoiceType(q.type) && r.operator !== "always" && !q.choices.some((c) => c.id === r.value)) return false;
      return true;
    });
    return logic.length === q.logic.length ? q : { ...q, logic };
  });
}

function BuilderInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const formId = Number(params.get("id"));
  const tab = (params.get("tab") as Tab) || "create";

  const editor = useFormEditor(formId);
  const { form, questions, setQuestions, updateMeta, saveState, saveError, loadError } = editor;

  const [selectionState, setSelection] = useState<Selection>("");
  // default to the first question until the user picks something
  const selection: Selection = selectionState || questions[0]?.id || "welcome";
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [showList, setShowList] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    api.workspaces().then(setWorkspaces).catch(() => {});
  }, []);

  const setTab = (t: Tab) => {
    void editor.flushAll();
    router.replace(`/form?id=${formId}${t === "create" ? "" : `&tab=${t}`}`);
  };

  const commit = useCallback((updater: (qs: Question[]) => Question[]) => setQuestions((qs) => sanitizeLogic(updater(qs))), [setQuestions]);

  const changeQuestion = (q: Question) => commit((qs) => qs.map((x) => (x.id === q.id ? q : x)));

  const addQuestion = (type: QuestionType) => {
    const q = blankQuestion(type);
    commit((qs) => {
      const idx = qs.findIndex((x) => x.id === selection);
      const copy = [...qs];
      copy.splice(idx >= 0 ? idx + 1 : qs.length, 0, q);
      return copy;
    });
    setSelection(q.id);
  };

  const addQuestions = (newQs: Question[]) => {
    commit((qs) => [...qs, ...newQs.map((q) => ({ ...q, id: newId(), logic: [] }))]);
  };

  const duplicate = (id: string) => {
    const src = questions.find((q) => q.id === id);
    if (!src) return;
    const copy: Question = { ...src, id: newId(), choices: src.choices.map((c) => ({ ...c, id: newId() })), logic: [] };
    commit((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const out = [...qs];
      out.splice(i + 1, 0, copy);
      return out;
    });
    setSelection(copy.id);
    toast.success("Question duplicated");
  };

  const remove = (id: string) => {
    const i = questions.findIndex((q) => q.id === id);
    const removed = questions[i];
    commit((qs) => qs.filter((q) => q.id !== id));
    const nextSel = questions[i + 1]?.id ?? questions[i - 1]?.id ?? "welcome";
    if (selection === id) setSelection(nextSel);
    toast.info("Question deleted", {
      label: "Undo",
      onClick: () =>
        commit((qs) => {
          const out = [...qs];
          out.splice(Math.min(i, out.length), 0, removed);
          return out;
        }),
    });
  };

  const publish = async () => {
    try {
      await editor.setStatus(true);
      toast.success("Your form is live! Share the link to collect responses 🎉", { label: "Share", onClick: () => setTab("share") });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't publish");
    }
  };
  const unpublish = async () => {
    try {
      await editor.setStatus(false);
      toast.info("Form unpublished — it no longer accepts responses");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't unpublish");
    }
  };

  const liveForm = useMemo(() => (form ? { ...form, questions } : null), [form, questions]);

  // Keyboard shortcut: Cmd/Ctrl+Shift+P → preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPreview(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!formId || loadError)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-xl font-semibold">{loadError || "No form selected"}</h1>
        <Button variant="primary" onClick={() => router.push("/workspace")}>
          Back to workspace
        </Button>
      </div>
    );
  if (!form || !liveForm)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={28} />
      </div>
    );

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <BuilderHeader
        form={liveForm}
        tab={tab}
        onTab={setTab}
        saveState={saveState}
        saveError={saveError}
        workspaceName={workspaces.find((w) => w.id === form.workspace_id)?.name}
        onRename={(title) => {
          updateMeta({ title }, true);
          toast.success("Form renamed");
        }}
        onPreview={() => setPreview(true)}
        onPublish={publish}
        onUnpublish={unpublish}
      />

      {tab === "create" && (
        <div className="relative flex min-h-0 flex-1">
          {/* left: question list */}
          <aside
            className={`absolute inset-y-0 left-0 z-20 w-[280px] shrink-0 border-r border-line bg-surface transition-transform md:static md:translate-x-0 ${
              showList ? "translate-x-0 shadow-[var(--shadow-pop)]" : "-translate-x-full"
            }`}
          >
            <QuestionList
              questions={questions}
              selection={selection}
              onSelect={(s) => {
                setSelection(s);
                setShowList(false);
              }}
              onReorder={(qs) => commit(() => qs)}
              onAdd={() => setAddOpen(true)}
              onDuplicate={duplicate}
              onDelete={remove}
              welcome={form.welcome_screen}
              ending={form.thankyou_screen}
            />
          </aside>

          {/* center: canvas / live preview */}
          <main className="dot-grid flex min-w-0 flex-1 flex-col p-3 md:p-4">
            <div className="mb-3 flex items-center gap-2">
              <IconButton label="Show questions" className="md:hidden" onClick={() => setShowList((v) => !v)}>
                {showList ? <X size={18} /> : <PanelLeft size={18} />}
              </IconButton>
              <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
                Add content
              </Button>
              <div className="ml-auto flex rounded-lg border border-line-2 bg-surface p-0.5">
                <IconButton label="Desktop preview" className={`h-7 w-7 ${device === "desktop" ? "bg-cream-2" : ""}`} onClick={() => setDevice("desktop")}>
                  <Monitor size={15} />
                </IconButton>
                <IconButton label="Mobile preview" className={`h-7 w-7 ${device === "mobile" ? "bg-cream-2" : ""}`} onClick={() => setDevice("mobile")}>
                  <Smartphone size={15} />
                </IconButton>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Canvas
                form={liveForm}
                questions={questions}
                selection={selection}
                onChangeQuestion={changeQuestion}
                onChangeScreen={(kind, patch) =>
                  kind === "welcome"
                    ? updateMeta({ welcome_screen: { ...form.welcome_screen, ...patch } })
                    : updateMeta({ thankyou_screen: { ...form.thankyou_screen, ...patch } })
                }
                device={device}
              />
            </div>
          </main>

          {/* right: settings */}
          <aside className="hidden w-[300px] shrink-0 border-l border-line bg-surface lg:block">
            <SettingsPanel
              form={liveForm}
              questions={questions}
              selection={selection}
              onChangeQuestion={changeQuestion}
              onChangeScreen={(kind, patch) =>
                kind === "welcome"
                  ? updateMeta({ welcome_screen: { ...form.welcome_screen, ...patch } }, true)
                  : updateMeta({ thankyou_screen: { ...form.thankyou_screen, ...patch } }, true)
              }
              onTheme={(theme) => updateMeta({ theme })}
              onSettings={(settings) => updateMeta({ settings }, true)}
            />
          </aside>
        </div>
      )}

      {tab !== "create" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "share" && <ShareTab form={liveForm} onPublish={publish} />}
          {tab === "connect" && <ConnectTab />}
          {tab === "results" && <ResultsTab form={liveForm} onChanged={editor.reload} />}
        </div>
      )}

      <AddContentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addQuestion}
        onAddQuestions={addQuestions}
        formTitle={form.title}
        existingTitles={questions.map((q) => q.title)}
      />

      <Modal open={preview} onClose={() => setPreview(false)} width={1200} bare>
        <div className="relative h-[85vh]">
          <div className="absolute left-3 top-3 z-20 rounded-full bg-ink/80 px-3 py-1 text-[12px] font-medium text-white">Preview — answers aren&apos;t saved</div>
          <button aria-label="Close preview" onClick={() => setPreview(false)} className="absolute right-3 top-3 z-20 rounded-full bg-ink/80 p-1.5 text-white hover:bg-ink">
            <X size={16} />
          </button>
          <FormRunner key={String(preview)} form={liveForm} mode="preview" embedded />
        </div>
      </Modal>
    </div>
  );
}

export default function FormPage() {
  return (
    <Suspense>
      <BuilderInner />
    </Suspense>
  );
}
