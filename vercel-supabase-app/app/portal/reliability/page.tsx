"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, RED, AMBER, card } from "../../../lib/ui";

// Reliability tab (wireframe 22a, readable rev) · "can you trust the numbers?"
// Reads top-down: one overall verdict, then where it comes from (per agent),
// then the same number split by activity with its formula, then human-vs-LLM
// to prove the routing. Every figure computed from real review data
// (/api/portal/reliability). inter-panel = reviewers agree with each other;
// vs GT = reviewers match the hidden expert. Green = human, purple = machine.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

type AgentRow = { agent: string; raters: number; inter_panel: number | null; vs_gt: number | null; gt_calls: number; trust: string };
type IssueRow = { key: string; label: string; inter_panel: number | null; vs_gt: number | null; unit: string; formula: string };
type HWin = { label: string; human: number | null; llm: number; machine: string; human_calls: number; judge_calls: number };
type MWin = { label: string; human: number | null; llm: number | null; llm_support: number; human_calls: number; judge_calls: number };
type Data = { overall: { inter_panel: number; vs_gt: number; delta: number; calls: number }; gt_calls: number; by_agent: AgentRow[]; by_issue: IssueRow[]; human_vs_llm: { human_wins: HWin[]; machine_wins: MWin[]; method: string } };

const trustStyle = (t: string) =>
  t === "high" ? { bg: "#e7f4ee", fg: GREEN, label: "high" }
  : t === "medium" ? { bg: "#fdf4e3", fg: AMBER, label: "medium" }
  : t === "low" ? { bg: "#fbeaea", fg: RED, label: "low" }
  : { bg: "#eef2f6", fg: MUT, label: "n thin" };
const valColor = (v: number | null) => v == null ? MUT : v >= 70 ? GREEN : v >= 55 ? AMBER : RED;

export default function Reliability() {
  const [d, setD] = useState<Data | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/reliability").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!d) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading reliability…</main>;

  const o = d.overall;
  const maxCov = Math.max(1, ...d.human_vs_llm.machine_wins.map((m) => Math.max(m.human_calls, m.judge_calls)));

  // one activity row for the human-vs-LLM box: two labelled bars, 0-100 scale
  const Bars = ({ human, llm, blind }: { human: number | null; llm: number | null; blind?: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 240, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 70, fontSize: 10.5, color: GREEN, flex: "none" }}>● human</span>
        <div style={{ flex: 1, height: 13, borderRadius: 6, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${human ?? 0}%`, height: 13, background: GREEN }} /></div>
        <span className={mono.className} style={{ width: 40, textAlign: "right", fontSize: 12, flex: "none" }}>{human == null ? "·" : human + "%"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 70, fontSize: 10.5, color: PURPLE, flex: "none" }}>● LLM judge</span>
        <div style={{ flex: 1, height: 13, borderRadius: 6, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${blind ? 0 : (llm ?? 0)}%`, height: 13, background: PURPLE }} /></div>
        <span className={mono.className} style={{ width: 40, textAlign: "right", fontSize: 12, flex: "none", color: blind ? MUT : INK }}>{blind ? "blind" : llm == null ? "·" : llm + "%"}</span>
      </div>
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
      <div className={instrument.className} style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 22px 30px", display: "flex", flexDirection: "column", gap: 14, color: INK }}>

        {/* 0 · overall panel reliability */}
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Overall panel reliability</span>
            <span style={{ fontSize: 12, color: MUT }}>across all {o.calls.toLocaleString()} scored calls · the same dataset feeds every breakdown below</span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, background: "#f7fbf9", border: "1px solid #dcefe5", borderRadius: 12, padding: "14px 16px" }}>
              <div className={grotesk.className} style={{ fontSize: 34, fontWeight: 600, color: GREEN }}>{o.inter_panel}%</div>
              <div style={{ fontSize: 12.5, color: "#4d5a66" }}>inter-panel · raters agree with each other (±1)</div>
            </div>
            <div style={{ flex: 1, minWidth: 200, background: "#f7fbf9", border: "1px solid #dcefe5", borderRadius: 12, padding: "14px 16px" }}>
              <div className={grotesk.className} style={{ fontSize: 34, fontWeight: 600, color: GREEN }}>{o.vs_gt}%</div>
              <div style={{ fontSize: 12.5, color: "#4d5a66" }}>vs ground truth · panel matches the hidden expert (±1)</div>
            </div>
            <div style={{ flex: 1.3, minWidth: 220, background: "#fbfcfd", border: "1px solid #e2e8ee", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>Δ {o.delta} {o.delta === 1 ? "pt" : "pts"}</div>
              <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.5, marginTop: 2 }}>the panel performs the same when it can&apos;t tell it&apos;s being tested · the hidden-GT calls are seeded unmarked into every batch.</div>
            </div>
          </div>
        </div>

        {/* 1 · reliability by agent */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 4, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by agent</span>
            <span style={{ fontSize: 12, color: MUT }}>where the overall number comes from · per agent, raters × agreement</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 130px 90px", gap: 10, fontSize: 11, color: MUT, textTransform: "uppercase", letterSpacing: 0.4, padding: "8px 0 6px", borderBottom: "1px solid #eef2f6" }}>
            <span>agent</span><span style={{ textAlign: "right" }}>raters</span><span>inter-panel</span><span>vs GT</span><span style={{ textAlign: "right" }}>trust</span>
          </div>
          {d.by_agent.map((a) => {
            const ts = trustStyle(a.trust);
            const Cell = ({ v }: { v: number | null }) => (
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: "#eef2f6", overflow: "hidden", maxWidth: 74 }}><div style={{ width: `${v ?? 0}%`, height: 8, background: v == null ? "#c7d0d8" : valColor(v) }} /></div>
                <span className={mono.className} style={{ fontSize: 11.5, width: 32 }}>{v == null ? "·" : v + "%"}</span>
              </span>
            );
            return (
              <div key={a.agent} style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 130px 90px", gap: 10, alignItems: "center", fontSize: 12.5, padding: "9px 0", borderBottom: "1px solid #f4f7f9" }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.agent}</span>
                <span className={mono.className} style={{ textAlign: "right" }}>{a.raters}</span>
                <Cell v={a.inter_panel} />
                <Cell v={a.vs_gt} />
                <span style={{ textAlign: "right" }}><span style={{ borderRadius: 999, background: ts.bg, color: ts.fg, fontSize: 11, fontWeight: 600, padding: "3px 10px" }}>{ts.label}</span></span>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: MUT, marginTop: 9, lineHeight: 1.5 }}>
            <b style={{ color: INK }}>inter-panel</b> = how often this agent&apos;s raters agree with each other (±1) · <b style={{ color: INK }}>vs GT</b> = how often they match the hidden expert (±1). <b style={{ color: INK }}>High</b> needs ≥3 raters and both ≥70% · <b style={{ color: INK }}>thin</b> = too few raters yet, so we auto-route more next batch.
          </div>
        </div>

        {/* 2 · reliability by issue type */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 4, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by issue type</span>
            <span style={{ fontSize: 12, color: MUT }}>the same number split by activity · each uses its own formula</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "150px 80px 80px 1fr", gap: 12, fontSize: 11, color: MUT, textTransform: "uppercase", letterSpacing: 0.4, padding: "8px 0 6px", borderBottom: "1px solid #eef2f6" }}>
            <span>activity</span><span style={{ textAlign: "right" }}>inter-panel</span><span style={{ textAlign: "right" }}>vs GT</span><span>formula</span>
          </div>
          {d.by_issue.map((b) => (
            <div key={b.key} style={{ display: "grid", gridTemplateColumns: "150px 80px 80px 1fr", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f4f7f9" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{b.label}</span>
              <span className={grotesk.className} style={{ textAlign: "right", fontSize: 17, fontWeight: 600, color: valColor(b.inter_panel) }}>{b.inter_panel == null ? "·" : b.unit === "F1" ? b.inter_panel : b.inter_panel + "%"}</span>
              <span className={grotesk.className} style={{ textAlign: "right", fontSize: 17, fontWeight: 600, color: valColor(b.vs_gt) }}>{b.vs_gt == null ? "·" : b.unit === "F1" ? b.vs_gt : b.vs_gt + "%"}</span>
              <span style={{ fontSize: 11.5, color: MUT, lineHeight: 1.45 }}>{b.formula}</span>
            </div>
          ))}
        </div>

        {/* 3 · human panel vs LLM judge */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 2, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Human panel vs LLM judge</span>
            <span style={{ fontSize: 12, color: MUT }}>both against the same expert ground truth · this is why routing sends each activity where it does</span>
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.6, margin: "14px 0 4px" }}>Only humans can see it → 100% human route</div>
          {d.human_vs_llm.human_wins.map((h) => (
            <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 0", borderTop: "1px solid #eef2f6", flexWrap: "wrap" }}>
              <span style={{ width: 160, fontSize: 13, fontWeight: 600, flex: "none" }}>{h.label}</span>
              <Bars human={h.human} llm={0} blind />
              <span style={{ fontSize: 11, color: MUT, width: 150, flex: "none" }}>judge is audio-blind · 0 findings</span>
            </div>
          ))}

          <div style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.6, margin: "16px 0 4px" }}>Transcript-visible → judge owns it</div>
          {d.human_vs_llm.machine_wins.map((m) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 0", borderTop: "1px solid #eef2f6", flexWrap: "wrap" }}>
              <span style={{ width: 160, fontSize: 13, fontWeight: 600, flex: "none" }}>{m.label}</span>
              <Bars human={m.human} llm={m.llm} />
              <span style={{ fontSize: 11, color: MUT, width: 150, flex: "none" }}>
                {m.llm == null
                  ? <>judge flags <b className={mono.className} style={{ color: PURPLE }}>{m.judge_calls}</b> calls at scale</>
                  : <>agrees with the panel where both looked</>}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: MUT, marginTop: 10, lineHeight: 1.5 }}>{d.human_vs_llm.method}</div>
        </div>

      </div>
    </PortalShell>
  );
}
