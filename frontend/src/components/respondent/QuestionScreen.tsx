"use client";

import { AlertTriangle, ArrowRight, Check, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { AnswerValue, Question } from "@/lib/types";
import { AnswerInput } from "./QuestionInputs";

/** One full-screen question, Typeform style. Used by the runner and the builder canvas. */
export function QuestionScreen({
  question,
  number,
  title,
  description,
  value,
  onChange,
  onNext,
  error,
  isLast,
  showNumber = true,
  readOnly,
  autoFocus,
  shakeKey,
}: {
  question: Question;
  number: number;
  title: string;
  description?: string | null;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  onNext: () => void;
  error?: string | null;
  isLast?: boolean;
  showNumber?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  shakeKey?: number;
}) {
  const t = question.type;
  const showOk = !(t === "yes_no" || t === "rating" || (t === "multiple_choice" && !question.properties.allow_multiple) || t === "dropdown") || isLast;
  const textLike = t === "short_text" || t === "email" || t === "number" || t === "long_text";

  return (
    <div className="relative mx-auto w-full max-w-[720px] px-6 md:px-10">
      <div className="relative">
        {showNumber && (
          <div
            className="mb-1 flex items-center gap-1 text-[15px] font-medium md:absolute md:-left-1 md:top-[6px] md:mb-0 md:-translate-x-full md:pr-2 md:text-[17px]"
            style={{ color: "var(--tf-answer)" }}
            aria-hidden
          >
            {number}
            <ArrowRight size={14} strokeWidth={2.5} />
          </div>
        )}
        <h1 className="whitespace-pre-wrap break-words text-[22px] leading-[1.3] md:text-[26px]" style={{ color: "var(--tf-question)" }}>
          {title || <span className="opacity-40">…</span>}
          {question.required && <span aria-label="required"> *</span>}
        </h1>
        {description && (
          <p className="mt-2 whitespace-pre-wrap text-[17px] leading-snug opacity-70 md:text-[20px]" style={{ color: "var(--tf-question)" }}>
            {description}
          </p>
        )}
      </div>

      <motion.div
        key={shakeKey}
        className="mt-8"
        animate={shakeKey ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
        transition={{ duration: 0.35 }}
      >
        <AnswerInput
          question={question}
          value={value}
          onChange={onChange}
          onAutoAdvance={onNext}
          readOnly={readOnly}
          autoFocus={autoFocus}
        />
      </motion.div>

      <div className="mt-4 min-h-[52px]">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2 rounded-md bg-[#FDECEE] px-3 py-1.5 text-[14px] text-[#B42335]"
              role="alert"
            >
              <AlertTriangle size={15} /> {error}
            </motion.div>
          ) : showOk ? (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
              <button
                type="button"
                tabIndex={readOnly ? -1 : 0}
                onClick={readOnly ? undefined : onNext}
                className="tf-btn inline-flex h-10 items-center gap-1.5 rounded-[4px] px-4 text-[18px] font-semibold shadow-sm transition"
              >
                {isLast ? "Submit" : "OK"}
                {!isLast && <Check size={18} strokeWidth={3} />}
              </button>
              {textLike && (
                <span className="hidden text-[12px] md:inline" style={{ color: "var(--tf-question)" }}>
                  {t === "long_text" ? (
                    <>
                      <b>Shift ⇧</b> + <b>Enter ↵</b> to make a line break
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 opacity-80">
                      press <b>Enter</b> <CornerDownLeft size={12} />
                    </span>
                  )}
                </span>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
