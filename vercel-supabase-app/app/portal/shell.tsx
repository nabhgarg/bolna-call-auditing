"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN } from "../../lib/ui";
import { isPortalUser } from "../../lib/role";
import { isDemo, demoHref } from "../../lib/demo";

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
  { href: "/portal/agents", label: "Agent insights", icon: "◐" },
  { href: "/portal/reliability", label: "Reliability", icon: "◎" },
  { href: "/portal/datasets", label: "Datasets", icon: "▤" },
  { href: "/portal/connect", label: "Connect via MCP", icon: "⌥" }
];

// Guided walk through the portal, for the YC demo only. Four stops in the order
// a client actually asks the questions: what is broken, can I believe it, what
// am I accumulating, how do I get it out. The step lives in sessionStorage
// because each stop is a real page load · the tour has to survive navigation.
const TOUR = [
  { href: "/portal/agents", label: "Agent insights",
    body: "Every agent ranked by how badly it needs attention, what is breaking on each, and the evidence behind the number. Click a row to open it." },
  { href: "/portal/reliability", label: "Reliability",
    body: "How far to trust those numbers. How often reviewers agree with each other, and how often they match a hidden expert." },
  { href: "/portal/datasets", label: "Datasets",
    body: "Every human judgment doubles as labelled training data. This is what the client accumulates by running the panel." },
  { href: "/portal/connect", label: "Connect via MCP",
    body: "Pull all of it into your own stack. Last stop · thanks for walking through it." }
];
const TOUR_KEY = "rlTourStep";
function readTourStep(): number {
  try {
    const v = window.sessionStorage.getItem(TOUR_KEY);
    if (v === "off") return -1;
    return v === null ? 0 : Number(v);
  } catch { return 0; }
}

// `solo` strips the nav back to the one public destination · used by the new
// use case screen when it is standing in as a front door rather than as one
// tab of a signed-in portal. Nothing else about the shell changes.
export default function PortalShell({ children, right, solo }: { children: React.ReactNode; right?: React.ReactNode; solo?: boolean }) {
  const path = usePathname();
  const [programs, setPrograms] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  // Anonymous until proven otherwise · a visitor arriving cold from the landing
  // page must never see a live client's name in the program pill.
  const [expert, setExpert] = useState(false);
  // Collapsed on first open · the nav is nearly empty for a new visitor, so it
  // should not take a fifth of the screen before they have typed anything.
  // Once someone toggles it, their choice is what sticks.
  const [collapsed, setCollapsed] = useState(true);
  // -1 = dismissed or not a demo session. Only rendered on the stop it belongs
  // to, so wandering off the tour route quietly hides it rather than nagging.
  const [tour, setTour] = useState(-1);
  useEffect(() => {
    try {
      const signedIn = isPortalUser();
      setExpert(signedIn);
      const saved = window.localStorage.getItem("rlNavCollapsed");
      // The YC demo always opens expanded · the tour below walks the nav item
      // by item, and a saved preference from some earlier visit must not be
      // able to hide the thing being pointed at. Toggling still works.
      if (isDemo()) { setCollapsed(false); setTour(readTourStep()); }
      else if (saved !== null) setCollapsed(saved === "1");
      if (!signedIn) return;
      const extra = JSON.parse(window.localStorage.getItem("rlPrograms") || "[]");
      setPrograms(["Bolna", ...extra]);
      setActive(window.localStorage.getItem("rlActiveProgram") || "Bolna");
    } catch {}
  }, []);
  function toggleNav() {
    setCollapsed((c) => {
      const n = !c;
      try { window.localStorage.setItem("rlNavCollapsed", n ? "1" : "0"); } catch {}
      return n;
    });
  }
  function pick(p: string) { setActive(p); setOpen(false); try { window.localStorage.setItem("rlActiveProgram", p); } catch {} }
  function endTour() { setTour(-1); try { window.sessionStorage.setItem(TOUR_KEY, "off"); } catch {} }
  function nextStop() {
    const n = tour + 1;
    if (n >= TOUR.length) { endTour(); return; }
    try { window.sessionStorage.setItem(TOUR_KEY, String(n)); } catch {}
    window.location.href = demoHref(TOUR[n].href);
  }
  // Show a stop only when we are standing on it · the step counter alone would
  // put "Reliability" on screen while the reader is still looking at Datasets.
  const stop = tour >= 0 && TOUR[tour] && path === TOUR[tour].href ? TOUR[tour] : null;
  return (
    <div className={`portal-shell ${collapsed ? "portal-collapsed" : ""} ${instrument.className}`} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK, display: "flex" }}>
      {/* sidebar · collapsible. Structure is kept stable because the mobile
          rules in styles.css select these children positionally. */}
      <div className="portal-sidebar" style={{ width: collapsed ? 64 : 200, flex: "none", background: "#fff", borderRight: "1px solid #e2e8ee", display: "flex", flexDirection: "column", padding: collapsed ? "14px 8px" : "14px 10px", position: "sticky", top: 0, height: "100vh", transition: "width .16s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 4 : 8, padding: collapsed ? "2px 0 12px" : "2px 10px 12px" }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN, flex: "none" }} />
          <span className={`nav-label ${grotesk.className}`} style={{ fontSize: 16, fontWeight: 700 }}>realloop</span>
          <span className="nav-label" style={{ flex: 1 }} />
          <button onClick={toggleNav} className="nav-toggle" title={collapsed ? "Expand menu" : "Collapse menu"} aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            style={{ flex: "none", width: 22, height: 22, borderRadius: 6, border: "1px solid #e2e8ee", background: "#fff", color: MUT, cursor: "pointer", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <div className={"nav-program" + (expert && !solo ? "" : " nav-hidden")} style={{ margin: "0 10px 14px", position: "relative" }}>
          {/* display:block is load-bearing · the global button rule is
              inline-flex, which laid the label and the program name out side
              by side ("PROGRAMBolna · live" on one cramped line) instead of
              stacking them. */}
          <button onClick={() => programs.length > 1 && setOpen(!open)} style={{ display: "block", width: "100%", textAlign: "left", borderRadius: 8, background: "#f5f7f9", padding: "8px 10px", border: "none", cursor: programs.length > 1 ? "pointer" : "default" }}>
            <div style={{ fontSize: 10, color: MUT, textTransform: "uppercase", letterSpacing: 0.6, lineHeight: 1.4, marginBottom: 1 }}>Program{programs.length > 1 ? ` · ${programs.length}` : ""}</div>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, lineHeight: 1.3 }}>
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
        {NAV.filter((n) => (expert && !solo) || n.pub).map((n) => {
          const active = path === n.href;
          return (
            <a key={n.href} href={n.href} title={n.label} style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, padding: "9px 10px", margin: "1px 0", textDecoration: "none", background: active ? "#e7f4ee" : "transparent", color: active ? GREEN : INK, fontWeight: active ? 600 : 400, fontSize: 13.5, border: active ? "1px solid #cde8db" : "1px solid transparent" }}>
              <span style={{ fontSize: 13, width: 16, textAlign: "center", color: active ? GREEN : MUT, flex: "none" }}>{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </a>
          );
        })}
        <span style={{ flex: 1 }} />
        {!solo && <a href="https://marketplace.realloop.in" title="Marketplace" style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 8, padding: "9px 10px", margin: "1px 0", textDecoration: "none", color: MUT, fontSize: 13 }}>
          <span style={{ fontSize: 13, width: 16, textAlign: "center", color: MUT, flex: "none" }}>⋱</span>
          <span className="nav-label">Marketplace</span>
        </a>}
        {expert && !solo && (
          <div className="nav-user" style={{ borderTop: "1px solid #eef2f6", margin: "8px 4px 0", paddingTop: 10, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: INK, color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>N</span>
            <span className={mono.className} style={{ fontSize: 11.5, color: "#4d5a66" }}>bolna-ops</span>
          </div>
        )}
      </div>
      {/* Tour card · bottom-left, tucked against the nav it is describing. The
          shell's own per-tab card sits bottom-right, so the two never overlap. */}
      {stop && (
        <div className="screen-only" style={{ position: "fixed", left: 16, bottom: 16, zIndex: 60, width: "min(330px, calc(100vw - 32px))", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 14, boxShadow: "0 16px 40px rgba(16,24,31,.18)", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className={mono.className} style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: GREEN }}>
            Step {tour + 1} of {TOUR.length} · {stop.label}
          </span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#4b5762" }}>{stop.body}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={nextStop} style={{ border: "none", background: GREEN, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 9, cursor: "pointer" }}>
              {tour + 1 < TOUR.length ? `Next · ${TOUR[tour + 1].label} →` : "Done"}
            </button>
            {tour + 1 < TOUR.length && (
              <button onClick={endTour} style={{ border: "none", background: "none", color: MUT, fontFamily: "inherit", fontSize: 12.5, cursor: "pointer", padding: 0 }}>Skip</button>
            )}
          </div>
        </div>
      )}
      {/* content */}
      <div className="portal-content" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="portal-topbar">{right}</div>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
