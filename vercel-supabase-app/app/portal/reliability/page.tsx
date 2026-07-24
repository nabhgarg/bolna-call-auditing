"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, RED, AMBER, card } from "../../../lib/ui";

// Reliability tab (wireframe 22a) · "can you trust the numbers?" Three boxes,
// every figure computed from real review data (/api/portal/reliability):
// 1. reliability by agent (raters/call, vs hidden GT ±1, trust tier)
// 2. reliability by issue type, each with its own formula
// 3. human panel vs LLM judge coverage — proves why routing sends each activity
//    where it does (green = human, purple = machine, per the philosophy doc).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

type AgentRow = { agent: string; raters_per_call: number; vs_gt: number; gt_calls: number; trust: string };
type IssueRow = { key: string; label: string; value: number | null; unit: string; support: number; formula: string };
type HvL = { label: string; human_calls: number; llm_calls: number; route: string; agreement: number | null; agreement_support: number };
type Data = { fleet_vs_gt: number; gt_calls: number; by_agent: AgentRow[]; by_issue: IssueRow[]; human_vs_llm: { human_only: HvL[]; machine_scales: HvL[]; method: string } };

const trustStyle = (t: string) =>
  t === "high" ? { bg: "#e7f4ee", fg: GREEN, label: "high" }
  : t === "medium" ? { bg: "#fdf4e3", fg: AMBER, label: "medium" }
  : t === "low" ? { bg: "#fbeaea", fg: RED, label: "low" }
  : { bg: "#eef2f6", fg: MUT, label: "thin" };

export default function Reliability() {
  const [d, setD] = useState<Data | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/reliability").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!d) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading reliability…</main>;

  const maxCov = Math.max(1, ...[...d.human_vs_llm.human_only, ...d.human_vs_llm.machine_scales].flatMap((h) => [h.human_calls, h.llm_calls]));

  const HvLRow = ({ h }: { h: HvL }) => (
    <div style={{ padding: "10px 0", borderTop: "1px solid #eef2f6" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{h.label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: MUT }}>{h.route}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 74, fontSize: 10.5, color: GREEN, flex: "none" }}>● human</span>
          <div style={{ flex: 1, height: 12, borderRadius: 6, background: "#eef2f6", overflow: "hidden" }}>
            <div style={{ width: `${(h.human_calls / maxCov) * 100}%`, height: 12, background: GREEN }} />
          </div>
          <span className={mono.className} style={{ width: 74, textAlign: "right", fontSize: 11.5, flex: "none" }}>{h.human_calls} calls</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 74, fontSize: 10.5, color: PURPLE, flex: "none" }}>● LLM judge</span>
          <div style={{ flex: 1, height: 12, borderRadius: 6, background: "#eef2f6", overflow: "hidden" }}>
            <div style={{ width: `${(h.llm_calls / maxCov) * 100}%`, height: 12, background: PURPLE }} />
          </div>
          <span className={mono.className} style={{ width: 74, textAlign: "right", fontSize: 11.5, flex: "none" }}>{h.llm_calls === 0 ? "0 · blind" : `${h.llm_calls} calls`}</span>
        </div>
      </div>
      {h.agreement != null && h.agreement_support >= 15 && h.llm_calls > 0 && (
        <div style={{ fontSize: 11, color: MUT, marginTop: 6 }}>Where both looked, the judge agrees with the panel on <b style={{ color: PURPLE }}>{h.agreement}%</b> of calls.</div>
      )}
    </div>
  );

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Reliability</span>
        <span style={{ fontSize: 12.5, color: MUT }}>how much to trust every number in this portal · recomputed weekly on hidden ground truth</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "16px 22px 28px", alignItems: "start", color: INK }}>

        {/* box 1 · reliability by agent (spans full width) */}
        <div style={{ ...card, padding: "16px 18px", gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 8, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by agent</span>
            <span style={{ flex: 1 }} />
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600, color: GREEN }}>{d.fleet_vs_gt}%</span>
            <span style={{ fontSize: 12, color: MUT }}>avg vs GT · {d.gt_calls} hidden-GT calls</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr 90px", gap: 8, fontSize: 11, color: MUT, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 0", borderBottom: "1px solid #eef2f6" }}>
            <span>agent</span><span style={{ textAlign: "right" }}>raters / call</span><span>vs GT ±1</span><span style={{ textAlign: "right" }}>trust</span>
          </div>
          {d.by_agent.map((a) => {
            const ts = trustStyle(a.trust);
            return (
              <div key={a.agent} style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr 90px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "9px 0", borderBottom: "1px solid #f4f7f9" }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.agent}</span>
                <span className={mono.className} style={{ textAlign: "right" }}>{a.raters_per_call}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 9, borderRadius: 5, background: "#eef2f6", overflow: "hidden", maxWidth: 130 }}>
                    <div style={{ width: `${a.vs_gt}%`, height: 9, background: a.trust === "thin" ? "#c7d0d8" : ts.fg }} />
                  </div>
                  <span className={mono.className} style={{ fontSize: 11.5, width: 34 }}>{a.trust === "thin" ? "·" : a.vs_gt + "%"}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ borderRadius: 999, background: ts.bg, color: ts.fg, fontSize: 11, fontWeight: 600, padding: "3px 10px" }}>{a.trust === "thin" ? "n thin" : ts.label}</span>
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: MUT, marginTop: 9, lineHeight: 1.5 }}>
            For each agent, the share of its calls where the ≥3 raters agree within ±1 and match the hidden expert rating. <b style={{ color: INK }}>High</b> ≥70% with ≥3 raters · <b style={{ color: INK }}>thin</b> = too few raters to be sure, so we auto-route more reviewers to it next batch.
          </div>
        </div>

        {/* box 2 · reliability by issue type */}
        <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 6 }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by issue type</span>
            <span style={{ fontSize: 12, color: MUT }}>each activity, its own formula</span>
          </div>
          {d.by_issue.map((b) => (
            <div key={b.key} style={{ padding: "11px 0", borderTop: "1px solid #eef2f6" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{b.label}</span>
                <span className={grotesk.className} style={{ fontSize: 20, fontWeight: 600, color: b.value == null ? MUT : b.unit === "F1" ? INK : (b.value >= 70 ? GREEN : b.value >= 55 ? AMBER : RED) }}>
                  {b.value == null ? "·" : b.unit === "F1" ? b.value : b.value + "%"}{b.unit === "F1" ? " F1" : ""}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: MUT, marginTop: 3, lineHeight: 1.5 }}>{b.formula}</div>
            </div>
          ))}
        </div>

        {/* box 3 · human vs LLM */}
        <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 4 }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Human panel vs LLM judge</span>
          </div>
          <div style={{ fontSize: 12, color: MUT, marginBottom: 2 }}>who catches what · this is why routing sends each activity where it does</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>Only humans can see it → 100% human</div>
          {d.human_vs_llm.human_only.map((h) => <HvLRow key={h.label} h={h} />)}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 12 }}>Transcript-visible → judge scales the check</div>
          {d.human_vs_llm.machine_scales.map((h) => <HvLRow key={h.label} h={h} />)}
          <div style={{ fontSize: 11, color: MUT, marginTop: 10, lineHeight: 1.5 }}>{d.human_vs_llm.method}</div>
        </div>

      </div>
    </PortalShell>
  );
}
