"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, Clock, CornerDownLeft, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { recall } from "@/lib/format";
import { nextQuestionId } from "@/lib/logic";
import { themeVars } from "@/lib/theme";
import type { AnswerValue, Answers, Question, RunnableForm } from "@/lib/types";
import { isEmptyAnswer, normalizeForSubmit, validateAnswer } from "@/lib/validation";
import { OrbitMark, RunnerBackdrop, SuccessMark } from "../art/Art";
import { LogoMark } from "../Logo";
import { QuestionScreen } from "./QuestionScreen";

type Stage = "welcome" | "question" | "done";

/**
 * The respondent experience: one question at a time, animated, keyboard driven.
 * mode="live" talks to the API (views, partial saves, submit);
 * mode="preview" runs entirely in memory (builder preview).
 */
export function FormRunner({
  form,
  mode,
  embedded,
}: {
  form: RunnableForm;
  mode: "live" | "preview";
  /** rendered inside a modal/frame instead of the full viewport */
  embedded?: boolean;
}) {
  const questions = form.questions;
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const welcomeOn = !!form.welcome_screen?.enabled;

  const [stage, setStage] = useState<Stage>(welcomeOn ? "welcome" : "question");
  const [history, setHistory] = useState<string[]>(questions[0] ? [questions[0].id] : []);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Refs so delayed auto-advance callbacks always see fresh state.
  const answersRef = useRef(answers);
  const historyRef = useRef(history);
  useLayoutEffect(() => {
    answersRef.current = answers;
    historyRef.current = history;
  }, [answers, history]);
  const tokenRef = useRef<string | null>(null);
  const startingRef = useRef<Promise<void> | null>(null);
  const lockRef = useRef(false);

  const currentId = history[history.length - 1];
  const current = currentId ? byId.get(currentId) : undefined;

  // ---- analytics: record a view once per mount (live only)
  useEffect(() => {
    if (mode !== "live") return;
    let vid = "";
    try {
      vid = localStorage.getItem("fw_visitor") || "";
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem("fw_visitor", vid);
      }
    } catch {
      vid = crypto.randomUUID();
    }
    api.recordView(form.slug, vid).catch(() => {});
  }, [mode, form.slug]);

  // ---- partial response tracking (fire-and-forget)
  const savePartial = useCallback(
    (qid: string, value: AnswerValue) => {
      if (mode !== "live") return;
      const q = byId.get(qid);
      if (!q) return;
      const payload = { [qid]: normalizeForSubmit(q, value) };
      if (tokenRef.current) {
        api.savePartial(form.slug, tokenRef.current, payload, qid).catch(() => {});
      } else if (!startingRef.current) {
        if (isEmptyAnswer(value)) return;
        startingRef.current = api
          .startResponse(form.slug, payload, qid)
          .then((r) => {
            tokenRef.current = r.token;
          })
          .catch(() => {});
      } else {
        startingRef.current.then(() => {
          if (tokenRef.current) api.savePartial(form.slug, tokenRef.current, payload, qid).catch(() => {});
        });
      }
    },
    [byId, form.slug, mode],
  );

  const path = useMemo(() => history.map((id) => byId.get(id)).filter(Boolean) as Question[], [history, byId]);

  const submit = useCallback(async () => {
    const a = answersRef.current;
    const onPath = historyRef.current;
    const payload: Answers = {};
    for (const id of onPath) {
      const q = byId.get(id);
      if (q && !isEmptyAnswer(a[id])) payload[id] = normalizeForSubmit(q, a[id]);
    }
    if (mode === "preview") {
      setDirection(1);
      setStage("done");
      return;
    }
    setSubmitting(true);
    try {
      if (startingRef.current) await startingRef.current;
      await api.submit(form.slug, payload, tokenRef.current);
      setDirection(1);
      setStage("done");
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        const firstBad = onPath.find((id) => e.fieldErrors[id]);
        if (firstBad) {
          const idx = onPath.indexOf(firstBad);
          setHistory(onPath.slice(0, idx + 1));
          setError(e.fieldErrors[firstBad]);
          setShake((s) => s + 1);
        } else setError(e.message);
      } else if (e instanceof ApiError && e.status === 409) {
        setStage("done");
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [byId, form.slug, mode]);

  const next = useCallback(() => {
    if (lockRef.current) return;
    const h = historyRef.current;
    const q = byId.get(h[h.length - 1]);
    if (!q) return;
    const value = answersRef.current[q.id];
    const err = validateAnswer(q, value);
    if (err) {
      setError(err);
      setShake((s) => s + 1);
      return;
    }
    setError(null);
    savePartial(q.id, value ?? null);
    const nxt = nextQuestionId(questions, q, normalizeForSubmit(q, value));
    if (!nxt) {
      void submit();
      return;
    }
    lockRef.current = true;
    setTimeout(() => (lockRef.current = false), 380);
    setDirection(1);
    setHistory([...h, nxt]);
  }, [byId, questions, savePartial, submit]);

  const back = useCallback(() => {
    const h = historyRef.current;
    if (h.length <= 1) return;
    setError(null);
    setDirection(-1);
    setHistory(h.slice(0, -1));
  }, []);

  const setAnswer = (v: AnswerValue) => {
    if (!current) return;
    setError(null);
    setAnswers((a) => ({ ...a, [current.id]: v }));
  };

  // ---- global keyboard: Enter to advance, arrows to move
  useEffect(() => {
    if (stage === "done") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inText = t.tagName === "TEXTAREA" || t.tagName === "INPUT";
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        if (stage === "welcome") {
          e.preventDefault();
          setStage("question");
          return;
        }
        if (t.tagName === "BUTTON") return; // let buttons handle themselves
        e.preventDefault();
        next();
      } else if (!inText && stage === "question" && (e.key === "ArrowDown" || e.key === "PageDown")) {
        e.preventDefault();
        next();
      } else if (!inText && stage === "question" && (e.key === "ArrowUp" || e.key === "PageUp")) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, next, back]);

  const answeredCount = path.filter((q) => !isEmptyAnswer(answers[q.id]) && !validateAnswer(q, answers[q.id])).length;
  const progress = stage === "done" ? 1 : questions.length ? answeredCount / questions.length : 0;
  const showProgress = form.settings?.show_progress_bar !== false;
  const showNumbers = form.settings?.show_question_numbers !== false;
  const isLast = current ? nextQuestionId(questions, current, normalizeForSubmit(current, answers[current.id])) === null : false;

  const variants = {
    enter: (d: number) => ({ y: d > 0 ? 80 : -80, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    exit: (d: number) => ({ y: d > 0 ? -80 : 80, opacity: 0 }),
  };

  const restart = () => {
    setAnswers({});
    setHistory(questions[0] ? [questions[0].id] : []);
    setError(null);
    tokenRef.current = null;
    startingRef.current = null;
    setStage(welcomeOn ? "welcome" : "question");
  };

  return (
    <div
      className={`tf-runner relative flex w-full flex-col overflow-hidden ${embedded ? "h-full" : "h-dvh"}`}
      style={themeVars(form.theme)}
    >
      {form.settings?.show_artwork !== false && <RunnerBackdrop compact={embedded} />}

      {showProgress && (
        <div className="absolute inset-x-0 top-0 z-10 h-1" style={{ background: "color-mix(in srgb, var(--tf-answer) 20%, transparent)" }}>
          <motion.div className="h-full" style={{ background: "var(--tf-answer)" }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      <div className="relative flex flex-1 items-center overflow-y-auto py-16">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          {stage === "welcome" && (
            <motion.div key="welcome" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }} className="w-full">
              <div className="mx-auto max-w-[720px] px-6 text-center">
                <div className="mx-auto mb-5 w-fit" style={{ color: "var(--tf-question)" }}>
                  <OrbitMark size={96} accent="var(--tf-answer)" />
                </div>
                <h1 className="text-[28px] leading-tight md:text-[36px]" style={{ color: "var(--tf-question)" }}>
                  {form.welcome_screen.title || form.title}
                </h1>
                {form.welcome_screen.description && (
                  <p className="mt-3 text-[18px] opacity-70 md:text-[20px]" style={{ color: "var(--tf-question)" }}>
                    {form.welcome_screen.description}
                  </p>
                )}
                <div
                  className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px]"
                  style={{ color: "var(--tf-question)", background: "color-mix(in srgb, var(--tf-question) 6%, transparent)" }}
                >
                  <Clock size={13} /> Takes {Math.max(1, Math.round((questions.length * 12) / 60))} min · {questions.length} questions
                </div>
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button onClick={() => setStage("question")} className="tf-btn h-12 rounded-[4px] px-6 text-[20px] font-semibold shadow-sm">
                    {form.welcome_screen.button_text || "Start"}
                  </button>
                  <span className="inline-flex items-center gap-1 text-[12px] opacity-70" style={{ color: "var(--tf-question)" }}>
                    press <b>Enter</b> <CornerDownLeft size={12} />
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "question" && current && (
            <motion.div
              key={current.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full"
            >
              <QuestionScreen
                question={current}
                number={questions.findIndex((q) => q.id === current.id) + 1}
                title={recall(current.title, questions, answers)}
                description={current.description ? recall(current.description, questions, answers) : null}
                value={answers[current.id]}
                onChange={setAnswer}
                onNext={next}
                error={error}
                isLast={isLast}
                showNumber={showNumbers}
                autoFocus
                shakeKey={shake}
              />
              {submitting && (
                <div className="mx-auto mt-2 max-w-[720px] px-6 text-[14px] opacity-70 md:px-10" style={{ color: "var(--tf-question)" }}>
                  Submitting…
                </div>
              )}
            </motion.div>
          )}

          {stage === "question" && !current && (
            <motion.div key="empty" className="w-full text-center text-lg opacity-70">
              This form has no questions yet.
            </motion.div>
          )}

          {stage === "done" && (
            <motion.div key="done" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }} className="w-full">
              <div className="mx-auto max-w-[720px] px-6 text-center">
                <div className="mx-auto mb-6 w-fit">
                  <SuccessMark size={92} />
                </div>
                <h1 className="text-[26px] leading-tight md:text-[32px]" style={{ color: "var(--tf-question)" }}>
                  {form.thankyou_screen?.title || "Thanks for completing this form!"}
                </h1>
                {form.thankyou_screen?.description && (
                  <p className="mt-3 text-[18px] opacity-70" style={{ color: "var(--tf-question)" }}>
                    {form.thankyou_screen.description}
                  </p>
                )}
                {mode === "preview" ? (
                  <button onClick={restart} className="tf-btn mt-8 inline-flex h-11 items-center gap-2 rounded-[4px] px-5 text-[17px] font-semibold">
                    <RotateCcw size={16} /> Restart preview
                  </button>
                ) : (
                  <a href="/workspace" className="tf-btn mt-8 inline-flex h-11 items-center rounded-[4px] px-5 text-[17px] font-semibold">
                    Create your own form
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* bottom-right navigation + branding */}
      {stage === "question" && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2 md:bottom-6 md:right-6">
          <div className="pointer-events-auto flex overflow-hidden rounded-[4px] shadow-sm">
            <button aria-label="Previous question" onClick={back} disabled={history.length <= 1} className="tf-btn flex h-9 w-9 items-center justify-center border-r border-black/10 disabled:opacity-50">
              <ChevronUp size={20} />
            </button>
            <button aria-label="Next question" onClick={next} className="tf-btn flex h-9 w-9 items-center justify-center">
              <ChevronDown size={20} />
            </button>
          </div>
          <a
            href="/workspace"
            target="_blank"
            rel="noreferrer"
            className="tf-btn pointer-events-auto hidden h-9 items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium sm:inline-flex"
          >
            Made with <LogoMark size={16} /> <b>formwise</b>
          </a>
        </div>
      )}
    </div>
  );
}
