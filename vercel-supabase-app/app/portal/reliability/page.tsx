"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, RED, AMBER, card } from "../../../lib/ui";

// Reliability tab (wireframe 22a) · exact design layout: a horizontal overall
// strip, then Reliability by agent + by issue type SIDE BY SIDE, then a
// full-width Human-panel-vs-LLM-judge split into two columns. Every figure is
// computed from real review data (/api/portal/reliability). inter-panel =
// reviewers agree with each other; vs GT = reviewers match the hidden expert.
// Green = human, purple = machine.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

type AgentRow = { agent: string; raters: number; inter_panel: number | null; vs_gt: number | null; gt_calls: number; trust: string };
type IssueRow = { key: string; label: string; inter_panel: number | null; vs_gt: number | null; unit: string; formula: string };
type HWin = { label: string; human: number | null; llm: number; machine: string };
type MWin = { label: string; human: number | null; llm: number | null; llm_support: number; human_calls: number; judge_calls: number };
type Data = { overall: { inter_panel: number; vs_gt: number; delta: number; calls: number }; by_agent: AgentRow[]; by_issue: IssueRow[]; human_vs_llm: { human_wins: HWin[]; machine_wins: MWin[]; method: string } };

const trustPill = (t: string) =>
  t === "high" ? { bg: "#e7f4ee", fg: GREEN }
  : t === "medium" ? { bg: "#faf3e3", fg: AMBER }
  : t === "low" ? { bg: "#fbeaea", fg: RED }
  : { bg: "#faf3e3", fg: AMBER };
const gtColor = (v: number | null) => v == null ? MUT : v >= 70 ? GREEN : v >= 55 ? AMBER : RED;

const AGENT_COLS = "1.7fr 58px 84px 84px 62px";
const ISSUE_COLS = "1.5fr 66px 66px";

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
  const fmt = (v: number | null, unit: string) => v == null ? "·" : unit === "F1" ? String(v) : v + "%";

  // one human-vs-LLM row: label, two side-by-side bars (green human / purple machine), "H v L"
  const HvL = ({ label, human, llm, blind, tail }: { label: string; human: number | null; llm: number | null; blind?: boolean; tail?: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
      <span style={{ width: 148, flex: "none" }}>{label}</span>
      <div style={{ flex: 1, display: "flex", gap: 5 }}>
        <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${human ?? 0}%`, height: 20, borderRadius: 5, background: GREEN }} /></div>
        <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${blind ? 0 : (llm ?? 0)}%`, height: 20, borderRadius: 5, background: PURPLE }} /></div>
      </div>
      <span className={mono.className} style={{ width: 82, textAlign: "right", fontSize: 11.5, flex: "none", color: MUT }}>
        {human ?? "·"} v {blind ? "0" : (llm == null ? "·" : llm)}
      </span>
    </div>
  );

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Reliability</span>
        <span style={{ fontSize: 12.5, color: MUT }}>how much to trust every number in this portal · refreshed weekly on hidden expert-rated calls</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 22px 30px", color: INK }}>

        {/* overall strip */}
        <div style={{ ...card, padding: "16px 22px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 230 }}>
            <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Overall panel reliability</div>
            <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>across every scored call · the same dataset feeds every breakdown below</div>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8ee" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 34, fontWeight: 600 }}>{o.inter_panel}%</span>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>inter-panel</div><div style={{ fontSize: 11, color: MUT }}>reviewers agree, within 1 point</div></div>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8ee" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 34, fontWeight: 600, color: GREEN }}>{o.vs_gt}%</span>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>vs ground truth</div><div style={{ fontSize: 11, color: MUT }}>panel matches the hidden expert, within 1 point</div></div>
          </div>
          <span style={{ flex: 1 }} />
        </div>

        {/* agent + issue type, side by side */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>

          {/* reliability by agent */}
          <div style={{ ...card, flex: 1, minWidth: 400, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by agent</span>
              <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>where the overall number comes from · per agent, raters × agreement</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: AGENT_COLS, fontSize: 11, color: "#93a1ae" }}>
              <span>agent</span><span style={{ textAlign: "right" }}>raters</span><span style={{ textAlign: "right" }}>inter-panel</span><span style={{ textAlign: "right" }}>vs expert</span><span style={{ textAlign: "right" }}>trust</span>
            </div>
            {d.by_agent.map((a) => {
              const p = trustPill(a.trust); const thin = a.trust === "thin";
              return (
                <div key={a.agent} style={{ display: "grid", gridTemplateColumns: AGENT_COLS, fontSize: 13, alignItems: "center", borderTop: "1px solid #eef2f6", padding: "10px 0" }}>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.agent}</b>
                  <span className={mono.className} style={{ textAlign: "right" }}>{a.raters}</span>
                  <span className={mono.className} style={{ textAlign: "right", color: thin ? AMBER : INK }}>{thin ? "low n" : a.inter_panel + "%"}</span>
                  <span className={mono.className} style={{ textAlign: "right", color: thin ? AMBER : gtColor(a.vs_gt) }}>{thin ? "low n" : a.vs_gt + "%"}</span>
                  <span style={{ textAlign: "right" }}><span style={{ borderRadius: 999, background: p.bg, color: p.fg, fontSize: 10, fontWeight: 600, padding: "3px 9px" }}>{a.trust}</span></span>
                </div>
              );
            })}
            <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "11px 13px", marginTop: "auto", fontSize: 11.5, color: "#4d5a66", lineHeight: 1.55 }}>
              <b style={{ color: INK }}>How this is computed:</b> <b style={{ color: INK }}>inter-panel</b> = how often this agent&apos;s reviewers agree with each other, within 1 point; <b style={{ color: INK }}>vs expert</b> = how often they match the hidden expert, within 1 point. High needs 3+ reviewers and both at least 70%.
            </div>
          </div>

          {/* reliability by issue type */}
          <div style={{ ...card, flex: 1, minWidth: 400, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by issue type</span>
              <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>the same number split by activity · each uses its own formula</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: ISSUE_COLS, fontSize: 11, color: "#93a1ae", padding: "0 14px" }}>
              <span>activity</span><span style={{ textAlign: "right" }}>inter-panel</span><span style={{ textAlign: "right" }}>vs expert</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              {d.by_issue.map((b) => {
                const [lead, ...rest] = b.formula.split(" · ");
                return (
                  <div key={b.key} style={{ border: "1px solid #e2e8ee", borderRadius: 10, padding: "11px 14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: ISSUE_COLS, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                      <span className={mono.className} style={{ textAlign: "right", fontSize: 13 }}>{fmt(b.inter_panel, b.unit)}</span>
                      <span className={mono.className} style={{ textAlign: "right", fontSize: 13, color: gtColor(b.vs_gt) }}>{fmt(b.vs_gt, b.unit)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: MUT, lineHeight: 1.5, marginTop: 4 }}><b style={{ color: INK }}>{lead}</b>{rest.length ? " · " + rest.join(" · ") : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* human panel vs LLM judge */}
        <div style={{ ...card, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Human panel vs LLM judge</span>
            <span style={{ fontSize: 11.5, color: MUT }}>scored against the same expert ground truth · this is why routing sends each activity where it does</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5 }}><span style={{ color: GREEN }}>●</span> human</span>
            <span style={{ fontSize: 11.5 }}><span style={{ color: PURPLE }}>●</span> LLM judge</span>
          </div>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
            {/* human wins */}
            <div style={{ flex: 1, minWidth: 360, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: GREEN }}>Human wins → 100% human route</div>
              {d.human_vs_llm.human_wins.map((h) => <HvL key={h.label} label={h.label} human={h.human} llm={0} blind />)}
              <div style={{ fontSize: 10.5, color: MUT }}>the judge is audio-blind here · it produces no findings, so these lanes stay 100% human.</div>
            </div>
            <div style={{ width: 1, background: "#e2e8ee" }} />
            {/* machine wins */}
            <div style={{ flex: 1, minWidth: 360, display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: PURPLE }}>Transcript-visible → judge owns it</div>
              {d.human_vs_llm.machine_wins.map((m) => (
                m.llm != null
                  ? <HvL key={m.label} label={m.label} human={m.human} llm={m.llm} />
                  : (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                      <span style={{ width: 148, flex: "none" }}>{m.label}</span>
                      <div style={{ flex: 1, display: "flex", gap: 5 }}>
                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${m.human ?? 0}%`, height: 20, borderRadius: 5, background: GREEN }} /></div>
                        <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#f3eefc", display: "flex", alignItems: "center", justifyContent: "center" }}><span className={mono.className} style={{ fontSize: 10, color: PURPLE }}>{m.judge_calls.toLocaleString()} calls at scale</span></div>
                      </div>
                      <span className={mono.className} style={{ width: 82, textAlign: "right", fontSize: 11.5, flex: "none", color: MUT }}>{m.human ?? "·"} v +</span>
                    </div>
                  )
              ))}
              <div style={{ fontSize: 10.5, color: MUT }}>where the judge and panel both looked, they agree (language 85%); elsewhere the judge covers these at scale for the panel to verify.</div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: MUT, borderTop: "1px solid #eef2f6", paddingTop: 10, lineHeight: 1.5 }}>{d.human_vs_llm.method}</div>
        </div>

      </div>
    </PortalShell>
  );
}
