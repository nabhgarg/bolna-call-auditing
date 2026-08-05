"use client";

import { useEffect, useState } from "react";

// The light/dark switch, shared by every review screen.
//
// The theme lives in ONE place — data-theme on <html> — and this component is
// only a hand on that lever. layout.tsx sets the attribute before first paint
// from the same localStorage key, so there is no flash; this component reads
// whatever that script decided and toggles it.
//
// Pages that need to react in JS (the transcribe waveform draws its colours
// onto a canvas, where var() does not resolve) listen for the "rl-theme"
// window event instead of tracking their own copy of the state.

const KEY = "rl-theme";

export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => { setTheme(currentTheme()); }, []);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem(KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent("rl-theme", { detail: next }));
  }

  return (
    <button onClick={flip} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        minHeight: 0, height: compact ? 26 : 30, padding: compact ? "0 9px" : "0 11px",
        fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: "pointer",
        border: "1px solid var(--line)", background: "var(--panel)", color: "var(--muted)"
      }}>
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>{theme === "dark" ? "☀" : "☾"}</span>
      {!compact && (theme === "dark" ? "Light" : "Dark")}
    </button>
  );
}
