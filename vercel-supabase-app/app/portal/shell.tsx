"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";

// Portal shell — Raindrop-style left nav. Four stable destinations:
// Overview (how is my AI doing) · Agents (which agent breaks, how) ·
// Datasets (what am I accumulating) · Add use case (give realloop more).
// Issues drill-down stays reachable from Overview/Agents, not a nav item.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f";

const NAV = [
  { href: "/portal", label: "Overall", icon: "◍" },
  { href: "/portal/agents", label: "By agent", icon: "◐" },
  { href: "/portal/datasets", label: "Datasets", icon: "▤" }
];

export default function PortalShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK, display: "flex" }}>
      {/* sidebar */}
      <div style={{ width: 200, flex: "none", background: "#fff", borderRight: "1px solid #e2e8ee", display: "flex", flexDirection: "column", padding: "14px 10px", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 10px 12px" }}>
          <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        </div>
        <div style={{ margin: "0 10px 14px", borderRadius: 8, background: "#f5f7f9", padding: "8px 10px" }}>
          <div style={{ fontSize: 10.5, color: MUT, textTransform: "uppercase", letterSpacing: 0.5 }}>Program</div>
          <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            Bolna <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} /> <span style={{ fontSize: 11, color: GREEN, fontWeight: 500 }}>live</span>
          </div>
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
        <a href="/marketplace/start" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8, padding: "10px 10px", margin: "0 2px 8px", textDecoration: "none", background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13 }}>
          + Add use case
        </a>
        <div style={{ fontSize: 10.5, color: MUT, padding: "0 10px 4px" }}>
          <a href="/dashboard" style={{ color: MUT }}>Calibration</a> · <a href="/marketplace" style={{ color: MUT }}>Marketplace</a>
        </div>
      </div>
      {/* content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {right}
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
