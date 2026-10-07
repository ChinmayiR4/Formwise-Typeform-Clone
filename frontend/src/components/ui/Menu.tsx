"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  divider?: boolean;
}

/** Small popover menu rendered in a portal so it is never clipped by scroll containers. */
export function Menu({
  trigger,
  items,
  align = "right",
  width = 220,
}: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || anchorEl?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const scroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
      window.removeEventListener("resize", scroll);
    };
  }, [open, anchorEl]);

  return (
    <>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          const el = e.currentTarget as HTMLElement;
          const r = el.getBoundingClientRect();
          const estH = items.length * 36 + 12;
          const top = r.bottom + 6 + estH > window.innerHeight ? Math.max(8, r.top - estH - 6) : r.bottom + 6;
          const left = align === "right" ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8);
          setPos({ top, left });
          setAnchorEl(el);
          setOpen((o) => !o);
        },
        "aria-expanded": open,
      })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panel}
                role="menu"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="fixed z-[95] rounded-lg border border-line bg-surface py-1.5 shadow-[var(--shadow-pop)]"
                style={{ top: pos.top, left: pos.left, width }}
                onClick={(e) => e.stopPropagation()}
              >
                {items.map((it, i) =>
                  it.divider ? (
                    <div key={i} className="my-1 border-t border-line" />
                  ) : (
                    <button
                      key={i}
                      role="menuitem"
                      disabled={it.disabled}
                      onClick={() => {
                        setOpen(false);
                        it.onClick?.();
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50 ${
                        it.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-cream-2"
                      }`}
                    >
                      {it.icon && <span className="flex w-4 justify-center opacity-80">{it.icon}</span>}
                      <span className="flex-1">{it.label}</span>
                      {it.hint}
                    </button>
                  ),
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
