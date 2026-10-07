/**
 * Small, dependency-free geometry helpers for the app's line-art accents.
 * Everything returns SVG path data computed from equations, so the art is
 * crisp at any size, theme-able via `currentColor`, and costs no image bytes.
 */

export type Pt = [number, number];

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function polyline(pts: Pt[], close = false): string {
  if (!pts.length) return "";
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${f(pts[i][0])} ${f(pts[i][1])}`;
  return close ? d + "Z" : d;
}

/** Sample a parametric curve on t ∈ [t0, t1]. */
export function sample(fn: (t: number) => Pt, t0: number, t1: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(fn(t0 + ((t1 - t0) * i) / n));
  return out;
}

/** Point on a rotated ellipse (x/a)² + (y/b)² = 1. */
export function ellipsePoint(cx: number, cy: number, a: number, b: number, rot: number, t: number): Pt {
  const c = Math.cos(rot), s = Math.sin(rot);
  const x = a * Math.cos(t), y = b * Math.sin(t);
  return [cx + x * c - y * s, cy + x * s + y * c];
}

export function ellipse(cx: number, cy: number, a: number, b: number, rot = 0, t0 = 0, t1 = Math.PI * 2): string {
  return polyline(sample((t) => ellipsePoint(cx, cy, a, b, rot, t), t0, t1, 140));
}

/** Circular arc from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  return polyline(sample((a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], a0, a1, Math.max(8, Math.ceil(Math.abs(a1 - a0) * 40))));
}

type V3 = [number, number, number];

function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return [x1, y * Math.cos(pitch) - z1 * Math.sin(pitch), y * Math.sin(pitch) + z1 * Math.cos(pitch)];
}

/**
 * Orthographic wireframe sphere: parallels (φ const) and meridians (λ const)
 * of a rotated unit sphere, split into the visible (z ≥ 0) and hidden halves.
 */
export function sphere(cx: number, cy: number, R: number, { yaw = 0.5, pitch = 0.4, lat = 6, lon = 8 } = {}) {
  const proj = (v: V3): Pt => [cx + R * v[0], cy - R * v[1]];
  let front = "", back = "";
  const curve = (fn: (t: number) => V3) => {
    let seg: Pt[] = [];
    let vis: boolean | null = null;
    const flush = () => {
      if (seg.length > 1) {
        if (vis) front += polyline(seg);
        else back += polyline(seg);
      }
    };
    for (let i = 0; i <= 96; i++) {
      const v = rotate(fn((i / 96) * Math.PI * 2), yaw, pitch);
      const now = v[2] >= 0;
      if (vis !== null && now !== vis) {
        seg.push(proj(v));
        flush();
        seg = [];
      }
      vis = now;
      seg.push(proj(v));
    }
    flush();
  };
  for (let i = 1; i < lat; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / lat;
    curve((t) => [Math.cos(phi) * Math.sin(t), Math.sin(phi), Math.cos(phi) * Math.cos(t)]);
  }
  for (let j = 0; j < lon; j++) {
    const lam = (Math.PI * j) / lon;
    curve((t) => [Math.cos(t) * Math.sin(lam), Math.sin(t), Math.cos(t) * Math.cos(lam)]);
  }
  const outline = polyline(sample((t) => [cx + R * Math.cos(t), cy + R * Math.sin(t)], 0, Math.PI * 2, 120), true);
  return { front, back, outline };
}
