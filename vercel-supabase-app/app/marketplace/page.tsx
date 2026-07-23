"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

// Marketplace home — company-side view of live reviewer supply, grouped by
// job role (roles-first hierarchy per design review D2). Every card is a real
// reviewer, anonymized to an RL-xx code with a persona line derived only from
// real role/tenure data (D3). Mobile: role sections collapse to accordions (D5).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

const ROLE_ORDER = ["AI Call Reviewer", "Hindi Transcriber", "AI Call Expert"];
const ROLE_BLURB: Record<string, string> = {
  "AI Call Reviewer": "scores production calls, logs issues with timestamps",
  "Hindi Transcriber": "produces expert golden transcripts the ASR can be measured against",
  "AI Call Expert": "sets ground truth, vets the panel, calibrates new reviewers"
};

function ReviewerCard({ r }: { r: any }) {
  return (
    <div style={{ ...card, width: 250, flex: "none", padding: "13px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={mono.className} style={{ fontSize: 13.5, fontWeight: 600 }}>{r.code}</span>
        <span style={{ flex: 1 }} />
        {r.active && <span style={{ width: 7, height: 7, borderRadius: 4, background: GREEN }} title="active this month" />}
        <span style={{ fontSize: 10.5, color: r.tier.startsWith("Tier 1") ? GREEN : "#b07a15", fontWeight: 600 }}>{r.tier}</span>
      </div>
      <div style={{ fontSize: 11.5, color: MUT, lineHeight: 1.4 }}>{r.persona}</div>
      <div style={{ display: "flex", gap: 5 }}>
        {r.languages.map((l: string) => (
          <span key={l} style={{ borderRadius: 999, background: "#eef2f6", fontSize: 10.5, padding: "2px 9px", color: "#4d5a66" }}>{l}</span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>{r.reviews.toLocaleString()}</span>
        <span style={{ fontSize: 10.5, color: MUT }}>reviews</span>
        <span style={{ flex: 1 }} />
        {r.agreement !== null && <>
          <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600, color: GREEN }}>{r.agreement}%</span>
          <span style={{ fontSize: 10.5, color: MUT }}>panel agreement</span>
        </>}
      </div>
      {r.agreement !== null && (
        <div style={{ height: 5, borderRadius: 3, background: "#eef2f6", overflow: "hidden" }}>
          <div style={{ width: `${r.agreement}%`, height: "100%", background: GREEN, borderRadius: 3 }} />
        </div>
      )}
      <button style={{ marginTop: 2, border: `1px solid ${GREEN}`, color: GREEN, background: "transparent", borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        Add to panel
      </button>
    </div>
  );
}

export default function Marketplace() {
  const [mk, setMk] = useState<any>(null);
  const [error, setError] = useState("");
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)").matches;
    setMobile(m);
    setOpenRoles(m ? {} : { "AI Call Reviewer": true, "Hindi Transcriber": true, "AI Call Expert": true });
    fetch("/api/marketplace").then((r) => r.json()).then(setMk).catch((e) => setError(String(e)));
  }, []);

  if (!mk) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Loading live supply…"}</main>;

  const byRole: Record<string, any[]> = {};
  for (const r of mk.reviewers || []) { (byRole[r.role] = byRole[r.role] || []).push(r); }
  const totals = mk.totals || {};

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Marketplace</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}><a href="/marketplace/join" style={{ color: MUT }}>Become a reviewer</a> · <a href="/portal" style={{ color: MUT }}>Portal</a></span>
        <a href="/marketplace/start" style={{ fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, borderRadius: 8, padding: "9px 16px", textDecoration: "none" }}>Start a program</a>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* thin stats strip — supports, doesn't lead */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {[
            [`${totals.reviewers ?? "—"}`, "calibrated reviewers"],
            ["1,733+", "structured reviews delivered"],
            ["78%", "panel agreement ±1 · published"],
            ["247", "expert golden-transcript calls"],
            ["100%", "reviewers measured against ground truth"]
          ].map(([n, l]) => (
            <span key={l} style={{ ...card, flex: "none", display: "inline-flex", alignItems: "baseline", gap: 6, borderRadius: 999, padding: "7px 14px" }}>
              <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600, color: GREEN }}>{n}</span>
              <span style={{ fontSize: 11.5, color: MUT }}>{l}</span>
            </span>
          ))}
        </div>

        {/* roles-first supply */}
        {ROLE_ORDER.filter((role) => (byRole[role] || []).length > 0).map((role) => {
          const list = byRole[role] || [];
          const open = !!openRoles[role];
          return (
            <div key={role} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setOpenRoles((s) => ({ ...s, [role]: !s[role] }))}
                style={{ display: "flex", alignItems: "baseline", gap: 10, background: "transparent", border: "none", cursor: "pointer", padding: 0, textAlign: "left", color: INK }}>
                <span className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>{role}</span>
                <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600, color: GREEN }}>· {list.length} available</span>
                <span style={{ fontSize: 11.5, color: MUT }}>{ROLE_BLURB[role]}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: MUT }}>{open ? "▾" : "▸"}</span>
              </button>
              {open && (
                <div style={{ display: "flex", gap: 10, flexWrap: mobile ? "nowrap" : "wrap", overflowX: mobile ? "auto" : "visible" }}>
                  {list.map((r: any) => <ReviewerCard key={r.code} r={r} />)}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, fontSize: 12.5, color: MUT }}>
            Every reviewer here passed the <b style={{ color: INK }}>calibration track</b>: rate expert-graded calls, get measured
            against ground truth, earn a tier. Agreement is re-measured on every batch — <span style={{ color: PURPLE }}>hidden ground-truth calls</span> keep everyone honest.
          </div>
          <a href="/marketplace/join" style={{ flex: "none", fontSize: 12.5, fontWeight: 600, color: GREEN, textDecoration: "none" }}>How reviewers get here →</a>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Live supply · profiles anonymized (codes, no names) · stats computed from {"1,733+"} real reviews · updated {String(mk.generated_at || "").slice(0, 10)}
        </div>
      </div>
    </div>
  );
}
