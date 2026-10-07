"use client";

import { Loader2 } from "lucide-react";
import { OrbitSpinner } from "../art/Art";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-ink-2 disabled:bg-ink/40",
  accent: "bg-violet text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-violet-hover disabled:bg-violet/40",
  secondary: "bg-surface text-ink border border-line-2 shadow-[var(--shadow-card)] hover:bg-cream disabled:text-muted",
  ghost: "text-ink hover:bg-ink/5 disabled:text-muted",
  danger: "bg-danger text-white hover:brightness-110 disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-ink/5 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`h-9 w-full rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 ${className}`}
      {...rest}
    />
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-violet" : "bg-line-2"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "live" | "violet" | "warn"; children: ReactNode }) {
  const tones = {
    neutral: "bg-cream-2 text-ink-2",
    live: "bg-[#e7f5ef] text-success",
    violet: "bg-violet-soft text-violet",
    warn: "bg-[#fdf3e7] text-[#b25e09]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <OrbitSpinner size={size} className={`text-violet ${className}`} />;
}

export function ComingSoon({ small }: { small?: boolean }) {
  return (
    <span className={`rounded-full bg-violet-soft font-medium text-violet ${small ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-[11.5px]"}`}>
      Coming soon
    </span>
  );
}
