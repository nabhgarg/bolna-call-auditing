"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, RED, AMBER, card } from "../../../lib/ui";
import { isPortalUser } from "../../../lib/role";
import DemoReady from "../../../lib/DemoReady";

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
type HvLRow = { label: string; human: number; llm: number; blind?: boolean; route: string; support: number };
type Data = { overall: { inter_panel: number; vs_gt: number; delta: number; calls: number }; by_agent: AgentRow[]; by_issue: IssueRow[]; human_vs_llm: { rows: HvLRow[]; method: string } };

const trustPill = (t: string) =>
  t === "high" ? { bg: "#e7f4ee", fg: GREEN }
  : t === "medium" ? { bg: "#faf3e3", fg: AMBER }
  : t === "low" ? { bg: "#fbeaea", fg: RED }
  : { bg: "#faf3e3", fg: AMBER };
const gtColor = (v: number | null) => v == null ? MUT : v >= 70 ? GREEN : v >= 55 ? AMBER : RED;

const AGENT_COLS = "1.7fr 58px 84px 84px 62px";
const ISSUE_COLS = "1.5fr 66px 66px";

function Inner() {
  const params = useSearchParams();
  const want = params.get("agent") || "";
  const [d, setD] = useState<Data | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(isPortalUser());
    fetch("/api/portal/reliability").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  // Ready only once the numbers are actually on screen · a gate message or a
  // spinner must not tell the shell this pane worked.
  const ready = allowed === true && !!d;

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to your team. <a href="/portal/login?next=/portal/reliability" style={{ color: GREEN }}>Log in</a> to see this program, or <a href="/portal/new-use-case" style={{ color: GREEN }}>start a use case</a>.</main>;
  if (!d) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading reliability…</main>;

  const o = d.overall;
  const fmt = (v: number | null, unit: string) => v == null ? "·" : unit === "F1" ? String(v) : v + "%";

  // focused mode · ?agent=… lands here from Agent insights. The strip shows
  // THIS agent's reliability against the program average; everything we only
  // have program-wide is labelled as such rather than silently reused.
  const focus = want ? d.by_agent.find((a) => a.agent.toLowerCase().includes(want.toLowerCase())) || null : null;
  const dp = focus && focus.inter_panel != null ? focus.inter_panel - o.inter_panel : 0;
  const dg = focus && focus.vs_gt != null ? focus.vs_gt - o.vs_gt : 0;
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  const dcolor = (n: number) => (n > 0 ? GREEN : n < 0 ? AMBER : MUT);

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Reliability</span>
        {focus
          ? <><span style={{ fontSize: 12.5, color: MUT }}>· {focus.agent}</span><a href="/portal/reliability" style={{ fontSize: 12.5, color: GREEN, textDecoration: "none" }}>all agents →</a></>
          : <span style={{ fontSize: 12.5, color: MUT }}>how much to trust every number in this portal · refreshed weekly on hidden expert-rated calls</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 22px 30px", color: INK }}>
        <DemoReady ready={ready} />

        {/* overall strip · becomes THIS agent's strip in focused mode */}
        <div style={{ ...card, padding: "16px 22px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", borderLeft: focus ? `4px solid ${GREEN}` : undefined }}>
          <div style={{ maxWidth: 250 }}>
            <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>{focus ? focus.agent : "Overall panel reliability"}</div>
            <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>
              {focus
                ? <>how much to trust this agent&apos;s numbers · {focus.raters} reviewers per call · {focus.gt_calls} hidden expert-rated calls</>
                : <>across every scored call · the same dataset feeds every breakdown below</>}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8ee" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 34, fontWeight: 600 }}>{focus ? focus.inter_panel : o.inter_panel}%</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>inter-panel</div>
              <div style={{ fontSize: 11, color: MUT }}>reviewers agree, within 1 point</div>
              {focus && <div style={{ fontSize: 11, color: dcolor(dp), marginTop: 1 }}>{sign(dp)} vs program ({o.inter_panel}%)</div>}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8ee" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 34, fontWeight: 600, color: GREEN }}>{focus ? focus.vs_gt : o.vs_gt}%</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>vs ground truth</div>
              <div style={{ fontSize: 11, color: MUT }}>panel matches the hidden expert, within 1 point</div>
              {focus && <div style={{ fontSize: 11, color: dcolor(dg), marginTop: 1 }}>{sign(dg)} vs program ({o.vs_gt}%)</div>}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          {focus && (
            <a href={`/portal/agents?agent=${encodeURIComponent(focus.agent)}`} style={{ fontSize: 12.5, fontWeight: 600, color: INK, background: "#fff", border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>← back to findings</a>
          )}
        </div>

        {/* agent + issue type, side by side */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>

          {/* reliability by agent */}
          <div style={{ ...card, flex: 1, minWidth: 400, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Reliability by agent</span>
              <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>where the overall number comes from · click any agent to see it on its own</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: AGENT_COLS, fontSize: 11, color: "#93a1ae" }}>
              <span>agent</span><span style={{ textAlign: "right" }}>raters</span><span style={{ textAlign: "right" }}>inter-panel</span><span style={{ textAlign: "right" }}>vs expert</span><span style={{ textAlign: "right" }}>trust</span>
            </div>
            {d.by_agent.map((a) => {
              const p = trustPill(a.trust); const thin = a.trust === "thin";
              const on = !!focus && a.agent === focus.agent;
              return (
                <a key={a.agent} href={on ? "/portal/reliability" : `/portal/reliability?agent=${encodeURIComponent(a.agent)}`}
                  style={{ display: "grid", gridTemplateColumns: AGENT_COLS, fontSize: 13, alignItems: "center", borderTop: "1px solid #eef2f6", padding: "10px 0", textDecoration: "none", color: INK, background: on ? "#eef4f1" : "transparent", boxShadow: on ? `inset 3px 0 0 ${GREEN}` : "none", opacity: focus && !on ? 0.5 : 1 }}>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: on ? 9 : 0 }}>{a.agent}</b>
                  <span className={mono.className} style={{ textAlign: "right" }}>{a.raters}</span>
                  <span className={mono.className} style={{ textAlign: "right", color: thin ? AMBER : INK }}>{thin ? "low n" : a.inter_panel + "%"}</span>
                  <span className={mono.className} style={{ textAlign: "right", color: thin ? AMBER : gtColor(a.vs_gt) }}>{thin ? "low n" : a.vs_gt + "%"}</span>
                  <span style={{ textAlign: "right" }}><span style={{ borderRadius: 999, background: p.bg, color: p.fg, fontSize: 10, fontWeight: 600, padding: "3px 9px" }}>{a.trust}</span></span>
                </a>
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
              <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>the same number split by activity · each uses its own formula{focus ? " · program-wide, not agent-specific" : ""}</div>
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
            <span style={{ fontSize: 11.5, color: MUT }}>where the judge can stand in for a human, and where it can&apos;t · scored on the same expert-reviewed calls{focus ? " · program-wide" : ""}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5 }}><span style={{ color: GREEN }}>●</span> human</span>
            <span style={{ fontSize: 11.5 }}><span style={{ color: PURPLE }}>●</span> LLM judge</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 84px 190px", gap: "10px 14px", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#93a1ae" }}>issue</span>
            <span style={{ fontSize: 11, color: "#93a1ae" }}>human vs LLM judge agreement</span>
            <span style={{ fontSize: 11, color: "#93a1ae", textAlign: "right" }}>H v L</span>
            <span style={{ fontSize: 11, color: "#93a1ae" }}>routing</span>
            {d.human_vs_llm.rows.map((r) => (
              <React.Fragment key={r.label}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</span>
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#eef2f6", overflow: "hidden" }}><div style={{ width: `${r.human}%`, height: 20, borderRadius: 5, background: GREEN }} /></div>
                  <div style={{ flex: 1, height: 20, borderRadius: 5, background: "#eef2f6", overflow: "hidden", position: "relative" }}>
                    <div style={{ width: `${r.llm}%`, height: 20, borderRadius: 5, background: PURPLE }} />
                    {r.blind && <span style={{ position: "absolute", left: 8, top: 3, fontSize: 10, color: PURPLE }}>audio-blind</span>}
                  </div>
                </div>
                <span className={mono.className} style={{ fontSize: 12, textAlign: "right" }}>{r.human} v {r.llm}</span>
                <span style={{ fontSize: 11, color: r.llm >= 80 ? PURPLE : r.llm === 0 ? GREEN : MUT }}>{r.route}</span>
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: MUT, borderTop: "1px solid #eef2f6", paddingTop: 10, lineHeight: 1.5 }}>{d.human_vs_llm.method}</div>
        </div>

      </div>
    </PortalShell>
  );
}

export default function Reliability() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
