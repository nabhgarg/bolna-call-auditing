"use client";

import { useEffect, useState } from "react";

// The light/dark switch, shared by every review screen.
//
// The theme lives in ONE place — data-theme on <html> — and this component is
// only a hand on that lever. layout.tsx sets the attribute before first paint
// from the same localStorage key, so there is no flash; this component reads
// whatever that script decided and toggles it.
//
// It renders as a small FIXED button in the bottom-right corner, outside the
// page flow entirely, so it cannot shift any layout it is dropped into. The
// bottom-LEFT corner is taken (the dev avatar bubble); headers and toolbars
// are the pages' own.
//
// Pages that need to react in JS (the transcribe waveform draws its colours
// onto a canvas, where var() does not resolve) listen for the "rl-theme"
// window event instead of tracking their own copy of the state.

const KEY = "rl-theme";

export function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle({ compact }: { compact?: boolean } = {}) {
  void compact; // kept for call-site compatibility · the control is always the corner dot
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
        position: "fixed", right: 14, bottom: 14, zIndex: 60,
        width: 36, height: 36, minHeight: 0, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, lineHeight: 1, borderRadius: 999, cursor: "pointer",
        border: "1px solid var(--line)", background: "var(--panel)", color: "var(--muted)",
        boxShadow: "var(--shadow-bar)", opacity: 0.92
      }}>
      <span aria-hidden>{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
