import { TYPE_META } from "@/lib/questionTypes";
import type { QuestionType } from "@/lib/types";

export function TypeBadge({ type, number, size = "md" }: { type: QuestionType; number?: number; size?: "sm" | "md" }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-between gap-1 rounded-md font-semibold ${size === "sm" ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-[12px]"}`}
      style={{ background: m.bg, color: m.fg, minWidth: number !== undefined ? (size === "sm" ? 38 : 44) : undefined }}
    >
      <Icon size={size === "sm" ? 12 : 14} strokeWidth={2.2} />
      {number !== undefined && <span>{number}</span>}
    </span>
  );
}
