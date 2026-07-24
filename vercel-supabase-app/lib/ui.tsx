import React from "react";

// realloop design system · single source of truth for the whole app.
// Colors, one canonical content width, the shared card surface, and a few
// primitives. Pages import from here instead of re-declaring the palette.

// palette
export const INK = "#10181f";      // primary text
export const MUT = "#6b7885";      // muted text
export const LINE = "#e2e8ee";     // borders
export const BG = "#f5f7f9";       // app canvas
export const GREEN = "#0e8a5f";    // primary / human
export const PURPLE = "#7c5cbf";   // machine / LLM
export const AMBER = "#b07a15";    // warning / partial
export const RED = "#d6484f";      // error / failure
export const BLUE = "#5b8def";     // user / secondary accent

// layout
export const PAGE = 1040;          // canonical portal content width

// surfaces
export const card: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

// primitives (adopt incrementally)
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "purple" }) {
  const map = { neutral: ["#eef2f6", "#4d5a66"], green: ["#e7f4ee", GREEN], amber: ["#faf3e3", AMBER], red: ["#fbeaea", RED], purple: ["#f1ecfa", PURPLE] } as const;
  const [bg, fg] = map[tone];
  return <span style={{ borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", lineHeight: 1.1, whiteSpace: "nowrap" }}>{children}</span>;
}

export function Bar({ pct, color = GREEN, height = 6 }: { pct: number; color?: string; height?: number }) {
  return <div style={{ height, borderRadius: height / 2, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: height / 2, background: color }} /></div>;
}
