"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  success: (m: string, action?: ToastItem["action"]) => void;
  error: (m: string) => void;
  info: (m: string, action?: ToastItem["action"]) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Kind, message: string, action?: ToastItem["action"]) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, kind, message, action }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push("success", m, a),
      error: (m) => push("error", m),
      info: (m, a) => push("info", m, a),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex min-w-[280px] max-w-[440px] items-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-[var(--shadow-pop)]"
              role="status"
            >
              {t.kind === "success" && <CheckCircle2 size={18} className="shrink-0 text-[#6EE7B7]" />}
              {t.kind === "error" && <XCircle size={18} className="shrink-0 text-[#FCA5A5]" />}
              {t.kind === "info" && <Info size={18} className="shrink-0 text-[#A5B8FF]" />}
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  className="rounded px-2 py-1 font-semibold text-[#A5B8FF] hover:bg-white/10"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss" className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => dismiss(t.id)}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
