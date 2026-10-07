import type { CSSProperties } from "react";
import type { Theme } from "./types";

export const THEME_PRESETS: Theme[] = [
  { preset: "classic", background: "#FFFFFF", question_color: "#111318", answer_color: "#2F54EB", button_color: "#2F54EB", button_text_color: "#FFFFFF", font: "Inter" },
  { preset: "ink", background: "#111318", question_color: "#F5F6F8", answer_color: "#8EA6FF", button_color: "#8EA6FF", button_text_color: "#111318", font: "Inter" },
  { preset: "paper", background: "#F7F5F0", question_color: "#1F1B16", answer_color: "#1F1B16", button_color: "#1F1B16", button_text_color: "#F7F5F0", font: "Instrument Serif" },
  { preset: "cobalt", background: "#2F54EB", question_color: "#FFFFFF", answer_color: "#DCE4FF", button_color: "#FFFFFF", button_text_color: "#2F54EB", font: "Inter" },
  { preset: "forest", background: "#F2F6F3", question_color: "#123526", answer_color: "#1E7A55", button_color: "#1E7A55", button_text_color: "#FFFFFF", font: "Inter" },
  { preset: "clay", background: "#FBF4EF", question_color: "#3A2117", answer_color: "#C2552D", button_color: "#C2552D", button_text_color: "#FFFFFF", font: "Inter" },
  { preset: "plum", background: "#F7F3FA", question_color: "#2B1638", answer_color: "#7B3FB0", button_color: "#7B3FB0", button_text_color: "#FFFFFF", font: "Inter" },
  { preset: "graphite", background: "#EDEDEC", question_color: "#1E1E1E", answer_color: "#4A4A4A", button_color: "#1E1E1E", button_text_color: "#FFFFFF", font: "Inter" },
];

export const FONTS = [
  { value: "Inter", label: "Inter (sans)" },
  { value: "Instrument Serif", label: "Instrument Serif (display)" },
  { value: "Georgia", label: "Georgia (serif)" },
  { value: "ui-monospace", label: "Monospace" },
];

export function resolveTheme(t: Partial<Theme> | undefined): Theme {
  return { ...THEME_PRESETS[0], ...(t || {}) };
}

/** CSS font-family for a theme font name. */
export function fontCss(name: string): string {
  if (name === "Inter" || name === "Space Grotesk") return "var(--font-inter), system-ui, sans-serif";
  if (name === "Instrument Serif") return "var(--font-serif-family), Georgia, serif";
  if (name === "ui-monospace" || name === "Space Mono") return "ui-monospace, SFMono-Regular, Menlo, monospace";
  return `${name}, system-ui, serif`;
}

/** CSS variables consumed by `.tf-runner` styles in globals.css. */
export function themeVars(t: Partial<Theme> | undefined): CSSProperties {
  const th = resolveTheme(t);
  const font = fontCss(th.font);
  return {
    ["--tf-bg" as string]: th.background,
    ["--tf-question" as string]: th.question_color,
    ["--tf-answer" as string]: th.answer_color,
    ["--tf-button" as string]: th.button_color,
    ["--tf-button-text" as string]: th.button_text_color,
    ["--orbit-planet" as string]: th.background,
    fontFamily: font,
  };
}
