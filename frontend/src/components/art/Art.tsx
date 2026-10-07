"use client";

/**
 * Line-art accents, plotted from the equations in lib/art/geometry.
 * Used sparingly: one signature mark (a wireframe sphere with an orbit),
 * a soft backdrop for the respondent view, and a few data/feedback visuals.
 */
import { motion } from "motion/react";
import { useMemo } from "react";
import { arc, ellipse, ellipsePoint, sphere } from "@/lib/art/geometry";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  vectorEffect: "non-scaling-stroke" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ------------------------------------------------------------ signature mark */

/**
 * Wireframe sphere with a tilted orbit. The orbit is split at the horizon so
 * its far half passes *behind* the sphere; an optional satellite dot travels
 * along x = a·cos t, y = b·sin t and fades out while hidden.
 */
export function OrbitMark({
  size = 120,
  animate = true,
  className,
  accent = "var(--violet)",
}: {
  size?: number;
  animate?: boolean;
  className?: string;
  accent?: string;
}) {
  const art = useMemo(() => {
    const R = 46, cx = 100, cy = 100, a = 84, b = 22, rot = -0.32;
    const s = sphere(cx, cy, R, { yaw: 0.5, pitch: 0.45, lat: 6, lon: 8 });
    const back = ellipse(cx, cy, a, b, rot, Math.PI, Math.PI * 2);
    const front = ellipse(cx, cy, a, b, rot, 0, Math.PI);
    const N = 90;
    const xs: number[] = [], ys: number[] = [], op: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const [x, y] = ellipsePoint(cx, cy, a, b, rot, t);
      xs.push(x);
      ys.push(y);
      const behind = t > Math.PI && (x - cx) ** 2 + (y - cy) ** 2 < R * R;
      op.push(behind ? 0 : 1);
    }
    return { s, back, front, xs, ys, op };
  }, []);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-hidden>
      <path d={art.back} {...stroke} strokeWidth={1} opacity={0.35} />
      <path d={art.s.outline} fill="var(--orbit-planet, #fff)" stroke="none" />
      <path d={art.s.back} {...stroke} strokeWidth={0.6} opacity={0.12} />
      <path d={art.s.front} {...stroke} strokeWidth={0.7} opacity={0.45} />
      <path d={art.s.outline} {...stroke} strokeWidth={1.1} />
      <path d={art.front} {...stroke} strokeWidth={1.1} />
      {animate ? (
        <motion.circle
          r={4.5}
          fill={accent}
          initial={{ cx: art.xs[0], cy: art.ys[0] }}
          animate={{ cx: art.xs, cy: art.ys, opacity: art.op }}
          transition={{ duration: 9, ease: "linear", repeat: Infinity }}
        />
      ) : (
        <circle cx={art.xs[18]} cy={art.ys[18]} r={4.5} fill={accent} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------ backdrop */

/**
 * Respondent backdrop: a soft accent glow and a dot grid that fades out from
 * the top-right corner. Quiet enough to sit behind
 * any question; driven by the form theme's answer colour.
 */
export function RunnerBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden style={{ color: "var(--tf-answer)" }}>
      <div
        className={`absolute -right-[20%] -top-[30%] rounded-full blur-3xl ${compact ? "h-[70%] w-[60%]" : "h-[80%] w-[70%]"}`}
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--tf-answer) 14%, transparent), transparent)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--tf-question) 16%, transparent) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "radial-gradient(ellipse 60% 55% at 100% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 100% 0%, black, transparent)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ data & feedback */

/** 270° gauge: track arc + animated value arc (pathLength 0 → value). */
export function Gauge({ value, size = 92, label }: { value: number; size?: number; label?: string }) {
  const a0 = -0.75 * Math.PI, a1 = 0.75 * Math.PI;
  const track = useMemo(() => arc(50, 50, 40, a0, a1), [a0, a1]);
  const v = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <path d={track} fill="none" stroke="var(--line)" strokeWidth={8} strokeLinecap="round" />
        <motion.path
          d={track}
          fill="none"
          stroke="var(--violet)"
          strokeWidth={8}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[18px] font-semibold tabular-nums">{Math.round(value)}%</span>
          <span className="text-[10px] text-muted">{label}</span>
        </div>
      )}
    </div>
  );
}

/** Loading spinner: a track ring and a rotating quarter arc. */
export function OrbitSpinner({ size = 24, className }: { size?: number; className?: string }) {
  const d = useMemo(() => arc(50, 50, 38, 0, Math.PI / 2), []);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label="Loading">
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth={10} opacity={0.15} />
      <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} style={{ originX: "50px", originY: "50px" }}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

/** Completion mark: ring draws in, check draws in, a small orbit dot sweeps once. */
export function SuccessMark({ size = 84 }: { size?: number }) {
  const ring = useMemo(() => arc(50, 50, 34, 0, Math.PI * 2), []);
  const orbit = useMemo(() => ellipse(50, 50, 46, 46, 0), []);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={{ color: "var(--tf-answer)" }}>
      <circle cx="50" cy="50" r="34" fill="color-mix(in srgb, var(--tf-answer) 10%, transparent)" />
      <path d={orbit} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="1.5 4" opacity={0.45} />
      <motion.path d={ring} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeInOut" }} />
      <motion.path
        d="M35 51 L45.5 61 L66 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
      />
      <motion.g initial={{ rotate: -90 }} animate={{ rotate: 270 }} transition={{ delay: 0.3, duration: 1.4, ease: [0.3, 0.7, 0.3, 1] }} style={{ originX: "50px", originY: "50px" }}>
        <circle cx="50" cy="4" r="3" fill="currentColor" />
      </motion.g>
    </svg>
  );
}
