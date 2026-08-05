import React from "react";

// realloop design system · single source of truth for the whole app.
// Colors, one canonical content width, the shared card surface, and a few
// primitives. Pages import from here instead of re-declaring the palette.

// palette · every name resolves to a CSS custom property so the whole app
// follows the light/dark flip on <html data-theme>. Inline style={{}} accepts
// var(), which is why these can stay plain strings.
export const INK = "var(--ink)";        // primary text
export const MUT = "var(--muted)";      // muted text
export const LINE = "var(--line)";      // borders
export const BG = "var(--bg)";          // app canvas
export const GREEN = "var(--accent)";   // primary / human
export const PURPLE = "var(--purple)";  // machine / LLM
export const AMBER = "var(--warn)";     // warning / partial
export const RED = "var(--red)";        // error / failure
export const BLUE = "var(--blue)";      // user / secondary accent

// layout
export const PAGE = 1040;          // canonical portal content width

// surfaces
export const card: React.CSSProperties = { background: "var(--panel)", border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: "var(--shadow)" };

// primitives (adopt incrementally)
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "purple" }) {
  const map = { neutral: ["var(--chip)", "var(--tx-slate2)"], green: ["var(--submitted)", GREEN], amber: ["var(--wash-warn-bg)", AMBER], red: ["var(--wash-red-bg)", RED], purple: ["var(--wash-purple)", PURPLE] } as const;
  const [bg, fg] = map[tone];
  return <span style={{ borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", lineHeight: 1.1, whiteSpace: "nowrap" }}>{children}</span>;
}

export function Bar({ pct, color = GREEN, height = 6 }: { pct: number; color?: string; height?: number }) {
  return <div style={{ height, borderRadius: height / 2, background: "var(--chip)", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: height / 2, background: color }} /></div>;
}
