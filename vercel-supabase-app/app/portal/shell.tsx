"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import { INK, MUT, GREEN } from "../../lib/ui";

// Portal shell · Raindrop-style left nav. Four stable destinations:
// Overview (how is my AI doing) · Agents (which agent breaks, how) ·
// Datasets (what am I accumulating) · Add use case (give realloop more).
// Issues drill-down stays reachable from Overview/Agents, not a nav item.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });


const NAV = [
  { href: "/portal/evaluation", label: "Evaluation design", icon: "⇶" },
  { href: "/portal/agents", label: "Agent insights", icon: "◐" },
  { href: "/portal/reliability", label: "Reliability", icon: "◎" },
  { href: "/portal/datasets", label: "Datasets", icon: "▤" }
];

export default function PortalShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const path = usePathname();
  const [programs, setPrograms] = useState<string[]>([]);
  const [active, setActive] = useState("Bolna");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const extra = JSON.parse(window.localStorage.getItem("rlPrograms") || "[]");
      setPrograms(["Bolna", ...extra]);
      setActive(window.localStorage.getItem("rlActiveProgram") || "Bolna");
    } catch {}
  }, []);
  function pick(p: string) { setActive(p); setOpen(false); try { window.localStorage.setItem("rlActiveProgram", p); } catch {} }
  return (
    <div className={`portal-shell ${instrument.className}`} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK, display: "flex" }}>
      {/* sidebar */}
      <div className="portal-sidebar" style={{ width: 200, flex: "none", background: "#fff", borderRight: "1px solid #e2e8ee", display: "flex", flexDirection: "column", padding: "14px 10px", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 10px 12px" }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN, flex: "none" }} />
          <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 700 }}>realloop</span>
        </div>
        <div style={{ margin: "0 10px 14px", position: "relative" }}>
          <button onClick={() => programs.length > 1 && setOpen(!open)} style={{ width: "100%", textAlign: "left", borderRadius: 8, background: "#f5f7f9", padding: "8px 10px", border: "none", cursor: programs.length > 1 ? "pointer" : "default" }}>
            <div style={{ fontSize: 10.5, color: MUT, textTransform: "uppercase", letterSpacing: 0.5 }}>Program{programs.length > 1 ? ` · ${programs.length}` : ""}</div>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active}</span>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN, flex: "none" }} />
              <span style={{ fontSize: 11, color: GREEN, fontWeight: 500 }}>live</span>
              <span style={{ flex: 1 }} />
              {programs.length > 1 && <span style={{ color: MUT, fontSize: 10 }}>▾</span>}
            </div>
          </button>
          {open && (
            <div style={{ position: "absolute", top: "104%", left: 0, right: 0, zIndex: 30, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,31,.12)", padding: 4 }}>
              {programs.map((p) => (
                <button key={p} onClick={() => pick(p)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: p === active ? "#e7f4ee" : "transparent", border: "none", borderRadius: 6, padding: "7px 9px", cursor: "pointer", fontSize: 12.5, fontWeight: p === active ? 600 : 400, color: INK }}>
                  {p === active && <span style={{ color: GREEN }}>✓</span>}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
                </button>
              ))}
              <a href="/portal/add" style={{ display: "block", padding: "7px 9px", fontSize: 12, color: GREEN, textDecoration: "none", borderTop: "1px solid #eef2f6", marginTop: 2 }}>+ Add use case</a>
            </div>
          )}
        </div>
        {NAV.map((n) => {
          const active = path === n.href;
          return (
            <a key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, padding: "9px 10px", margin: "1px 0", textDecoration: "none", background: active ? "#e7f4ee" : "transparent", color: active ? GREEN : INK, fontWeight: active ? 600 : 400, fontSize: 13.5, border: active ? "1px solid #cde8db" : "1px solid transparent" }}>
              <span style={{ fontSize: 13, width: 16, textAlign: "center", color: active ? GREEN : MUT }}>{n.icon}</span>
              {n.label}
            </a>
          );
        })}
        <span style={{ flex: 1 }} />
        <a href="/portal/add" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8, padding: "10px 10px", margin: "0 2px 8px", textDecoration: "none", background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13 }}>
          + Add use case
        </a>
        <div style={{ fontSize: 10.5, color: MUT, padding: "0 10px 4px" }}>
          <a href="/marketplace/join" style={{ color: MUT }}>Work with us</a>
        </div>
      </div>
      {/* content */}
      <div className="portal-content" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="portal-topbar">{right}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
