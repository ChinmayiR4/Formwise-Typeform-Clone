"use client";
/* eslint-disable react-hooks/preserve-manual-memoization -- callbacks intentionally read mutable refs (save queue); compiler auto-memo is not needed here */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { FormDetail, Question } from "@/lib/types";

export type SaveState = "saved" | "unsaved" | "saving" | "error";
type MetaPatch = Partial<Pick<FormDetail, "title" | "theme" | "welcome_screen" | "thankyou_screen" | "settings">>;

/**
 * Local-first editor state for one form.
 *
 * Questions are edited locally and autosaved (debounced) with a single
 * PUT /questions sync call; ids are generated client-side so nothing needs
 * remapping after a save. Saves are serialised: if edits arrive while a save
 * is in flight, exactly one follow-up save runs with the latest state.
 */
export function useFormEditor(formId: number) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [questions, setQuestionsState] = useState<Question[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const latestQuestions = useRef<Question[]>([]);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingAgain = useRef(false);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMeta = useRef<MetaPatch>({});

  const load = useCallback(
    () =>
      api.form(formId).then(
        (f) => {
          setForm(f);
          setQuestionsState(f.questions);
          latestQuestions.current = f.questions;
          setLoadError(null);
        },
        (e) => setLoadError(e instanceof ApiError ? e.message : "Could not load form"),
      ),
    [formId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const runQuestionSave = useCallback(async () => {
    if (inFlight.current) {
      pendingAgain.current = true;
      return inFlight.current;
    }
    setSaveState("saving");
    const p = (async () => {
      try {
        const f = await api.saveQuestions(formId, latestQuestions.current);
        setForm((prev) => (prev ? { ...prev, updated_at: f.updated_at, question_count: f.question_count } : f));
        setSaveError(null);
        setSaveState(pendingAgain.current ? "unsaved" : "saved");
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof ApiError ? e.message : "Couldn't save changes");
      } finally {
        inFlight.current = null;
        if (pendingAgain.current) {
          pendingAgain.current = false;
          void runQuestionSave();
        }
      }
    })();
    inFlight.current = p;
    return p;
  }, [formId]);

  const setQuestions = useCallback(
    (updater: Question[] | ((prev: Question[]) => Question[])) => {
      setQuestionsState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Question[]) => Question[])(prev) : updater;
        latestQuestions.current = next;
        return next;
      });
      setSaveState("unsaved");
      if (qTimer.current) clearTimeout(qTimer.current);
      qTimer.current = setTimeout(() => void runQuestionSave(), 700);
    },
    [runQuestionSave],
  );

  const flushMeta = useCallback(async () => {
    const patch = pendingMeta.current;
    pendingMeta.current = {};
    if (!Object.keys(patch).length) return;
    setSaveState("saving");
    try {
      const f = await api.updateForm(formId, patch);
      setForm((prev) => (prev ? { ...prev, updated_at: f.updated_at } : f));
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof ApiError ? e.message : "Couldn't save changes");
    }
  }, [formId]);

  /** Optimistically update form-level settings; persisted after a short debounce. */
  const updateMeta = useCallback(
    (patch: MetaPatch, immediate = false) => {
      setForm((prev) => (prev ? { ...prev, ...patch } : prev));
      pendingMeta.current = { ...pendingMeta.current, ...patch };
      setSaveState("unsaved");
      if (metaTimer.current) clearTimeout(metaTimer.current);
      metaTimer.current = setTimeout(() => void flushMeta(), immediate ? 0 : 600);
    },
    [flushMeta],
  );

  const flushAll = useCallback(async () => {
    if (qTimer.current) {
      clearTimeout(qTimer.current);
      qTimer.current = null;
      await runQuestionSave();
    } else if (inFlight.current) await inFlight.current;
    if (metaTimer.current) {
      clearTimeout(metaTimer.current);
      metaTimer.current = null;
      await flushMeta();
    }
  }, [runQuestionSave, flushMeta]);

  const setStatus = useCallback(
    async (publish: boolean) => {
      await flushAll();
      const f = publish ? await api.publish(formId) : await api.unpublish(formId);
      setForm((prev) => (prev ? { ...prev, status: f.status, published_at: f.published_at } : f));
      return f;
    },
    [flushAll, formId],
  );

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === "unsaved" || saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  return { form, questions, setQuestions, updateMeta, saveState, saveError, loadError, reload: load, flushAll, setStatus };
}
