"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN } from "../../lib/ui";

// Portal shell · Raindrop-style left nav. Four stable destinations:
// Overview (how is my AI doing) · Agents (which agent breaks, how) ·
// Datasets (what am I accumulating) · Add use case (give realloop more).
// Issues drill-down stays reachable from Overview/Agents, not a nav item.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"] });


// New use case is home: it is where a client starts and where /portal lands.
// It is also the public front door · the landing page's main CTA points here,
// so it must work for someone who has never logged in. Everything below it
// reads a live client's data and stays behind the expert gate.
const NAV = [
  { href: "/portal/new-use-case", label: "New use case", icon: "＋", pub: true },
  { href: "/portal/evaluation", label: "Evaluation design", icon: "⌘" },
  { href: "/portal/agents", label: "Agent insights", icon: "◐" },
  { href: "/portal/reliability", label: "Reliability", icon: "◎" },
  { href: "/portal/datasets", label: "Datasets", icon: "▤" },
  { href: "/portal/connect", label: "Connect via MCP", icon: "⌥" }
];

export default function PortalShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const path = usePathname();
  const [programs, setPrograms] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  // Anonymous until proven otherwise · a visitor arriving cold from the landing
  // page must never see a live client's name in the program pill.
  const [expert, setExpert] = useState(false);
  useEffect(() => {
    try {
      const isExpert = (window.localStorage.getItem("auditReviewerRole") || "") === "expert";
      setExpert(isExpert);
      if (!isExpert) return;
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
        <div style={{ margin: "0 10px 14px", position: "relative", display: expert ? "block" : "none" }}>
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
              <a href="/portal/new-use-case" style={{ display: "block", padding: "7px 9px", fontSize: 12, color: GREEN, textDecoration: "none", borderTop: "1px solid #eef2f6", marginTop: 2 }}>+ Add use case</a>
            </div>
          )}
        </div>
        {NAV.filter((n) => expert || n.pub).map((n) => {
          const active = path === n.href;
          return (
            <a key={n.href} href={n.href} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, padding: "9px 10px", margin: "1px 0", textDecoration: "none", background: active ? "#e7f4ee" : "transparent", color: active ? GREEN : INK, fontWeight: active ? 600 : 400, fontSize: 13.5, border: active ? "1px solid #cde8db" : "1px solid transparent" }}>
              <span style={{ fontSize: 13, width: 16, textAlign: "center", color: active ? GREEN : MUT }}>{n.icon}</span>
              {n.label}
            </a>
          );
        })}
        <span style={{ flex: 1 }} />
        <a href="https://marketplace.realloop.in" style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, padding: "9px 10px", margin: "1px 0", textDecoration: "none", color: MUT, fontSize: 13 }}>
          <span style={{ fontSize: 13, width: 16, textAlign: "center", color: MUT }}>⋱</span>
          Marketplace
        </a>
        {expert && (
          <div style={{ borderTop: "1px solid #eef2f6", margin: "8px 4px 0", paddingTop: 10, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: INK, color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>N</span>
            <span className={mono.className} style={{ fontSize: 11.5, color: "#4d5a66" }}>bolna-ops</span>
          </div>
        )}
      </div>
      {/* content */}
      <div className="portal-content" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="portal-topbar">{right}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
