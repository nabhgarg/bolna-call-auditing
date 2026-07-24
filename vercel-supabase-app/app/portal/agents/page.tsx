"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, RED, AMBER, card } from "../../../lib/ui";

// Agent insights · Overall + By-agent MERGED into one master-detail screen
// (wireframe 19a / 20a + philosophy 21a). Left: agents ranked by how much
// they need attention, each with a plain-words verdict. Right: the selected
// agent, led by "what to fix" (root cause first, playable), then no-nonsense
// metrics, then the human-vs-LLM issue rows with timestamped evidence.
// Philosophy honored: verdict first · every number is playable · root cause
// over volume · green = human, purple = machine.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const CANON = "https://api.bolna.ai/recordings/call/";

type L2 = { key: string; label: string; human_calls: number; llm_calls: number; occ: number; evidence: any[]; subtypes: [string, number][] };
type Agent = { agent: string; avg: number; dist: number[]; calls: number; avg_raters: number; reviewed: number; calls_with_issue: number; bad_pct: number; trend: { first: number; last: number }; daily: any[]; l2: L2[]; fixes: { title: string; count: number }[] };

const L2_ISSUE_ROUTE: Record<string, string> = { transcription: "asr", response: "response", naturalness: "tone", proper_noun: "proper_noun", pronunciation: "pronunciation" };

// distinctive-issue verdict: for the given agent, the issue whose per-call rate
// most exceeds the fleet baseline (transcription is high everywhere, so it only
// wins the headline where it is genuinely this agent's defining problem).
function verdictFor(a: Agent, fleetRate: Record<string, number>) {
  let best: { key: string; lift: number; calls: number; row: L2 } | null = null;
  for (const r of a.l2 || []) {
    const affected = r.human_calls + r.llm_calls;
    if (affected < 2 || a.calls < 1) continue;
    const rate = affected / a.calls;
    const base = fleetRate[r.key] || 0.0001;
    const lift = rate / base;
    if (!best || lift > best.lift) best = { key: r.key, lift, calls: affected, row: r };
  }
  if (!best) return { label: "clean", key: "", row: null as L2 | null };
  const r = best.row;
  if (best.key === "transcription") return { label: "ASR mishears input", key: "transcription", row: r };
  if (best.key === "pronunciation") return { label: "pronunciation misses", key: "pronunciation", row: r };
  if (best.key === "proper_noun") return { label: "proper nouns misheard", key: "proper_noun", row: r };
  if (best.key === "naturalness") return { label: "tone drifts", key: "naturalness", row: r };
  // response: name it by the leading subtype
  const top = (r.subtypes && r.subtypes[0] && r.subtypes[0][0] || "").toLowerCase();
  let label = "wrong responses";
  if (/repeat|loop|stuck/.test(top)) label = "repetition loops";
  else if (/input capture/.test(top)) label = "input capture misses";
  else if (/language/.test(top)) label = "language switching";
  else if (/context|rule|instruction|navigation/.test(top)) label = "instruction not followed";
  else if (/irrelevant|wrong|hallucinat|factual/.test(top)) label = "wrong responses";
  return { label, key: "response", row: r };
}

function Inner() {
  const params = useSearchParams();
  const [data, setData] = useState<{ agents: Agent[] } | null>(null);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<string>(params.get("l2") || "");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/byagent").then((r) => r.json()).then((d) => {
      setData(d);
      const want = params.get("agent");
      if (want && d?.agents) {
        const i = d.agents.findIndex((x: Agent) => String(x.agent).toLowerCase().includes(want.toLowerCase()));
        if (i >= 0) setSel(i);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agents = data?.agents || [];

  // fleet baseline rate per L2 (mean calls-affected / calls across agents)
  const fleetRate = useMemo(() => {
    const acc: Record<string, { s: number; n: number }> = {};
    for (const a of agents) for (const r of a.l2 || []) {
      const k = r.key; if (!acc[k]) acc[k] = { s: 0, n: 0 };
      acc[k].s += (r.human_calls + r.llm_calls) / Math.max(1, a.calls); acc[k].n += 1;
    }
    const out: Record<string, number> = {};
    for (const k in acc) out[k] = acc[k].s / Math.max(1, acc[k].n);
    return out;
  }, [agents]);

  // rank: needs-attention (avg<=2.9) worst-first, then healthy best-first
  const ranked = useMemo(() => {
    const idx = agents.map((a, i) => ({ a, i, v: verdictFor(a, fleetRate) }));
    const needs = idx.filter((x) => x.a.avg <= 2.9).sort((x, y) => x.a.avg - y.a.avg);
    const healthy = idx.filter((x) => x.a.avg > 2.9).sort((x, y) => y.a.avg - x.a.avg);
    return { needs, healthy };
  }, [agents, fleetRate]);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!data) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading agent insights…</main>;

  const a = agents[Math.min(sel, agents.length - 1)] || ({} as Agent);
  const v = verdictFor(a, fleetRate);
  const needsAttention = a.avg <= 2.9;
  const totalCalls = agents.reduce((s, x) => s + (x.calls || 0), 0);
  const scoreColor = (x: number) => x <= 2.5 ? RED : x <= 2.9 ? AMBER : GREEN;

  function play(callId: string, ts: string) {
    const el = audioRef.current; if (!el) return;
    el.src = `/api/audio?url=${encodeURIComponent(CANON + callId)}`;
    const [m2, s2] = String(ts || "0:0").split(":");
    const go = () => { try { el.currentTime = Math.max(0, Number(m2) * 60 + Number(s2 || 0) - 2); } catch {} el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
  }

  // what-to-fix: root cause first. Item 1 from the distinctive issue + its top
  // subtype; item 2 from the next-biggest response subtype (the fixes list).
  const leadRow = v.row;
  const leadEvidence = (leadRow?.evidence || [])[0];
  const fixes = a.fixes || [];
  const secondFix = fixes.find((f) => !new RegExp((leadRow?.subtypes?.[0]?.[0] || "###").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(f.title)) || fixes[1];
  const leadCount = leadRow?.subtypes?.[0]?.[1] ?? leadRow?.occ ?? 0;
  const leadSub = leadRow?.subtypes?.[0]?.[0] || "";
  const isRootCause = v.key === "transcription";
  // how much of the list traces to the lead issue
  const leadCalls = leadRow ? leadRow.human_calls + leadRow.llm_calls : 0;

  const AgentRow = ({ x, i, verd, best }: { x: Agent; i: number; verd: ReturnType<typeof verdictFor>; best?: boolean }) => {
    const active = i === sel;
    return (
      <button onClick={() => { setSel(i); setOpen(""); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: active ? "#eef4f1" : "transparent", border: active ? `1px solid #cde8db` : "1px solid transparent", borderLeft: active ? `3px solid ${GREEN}` : "3px solid transparent", borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: INK }}>
        <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 600, color: scoreColor(x.avg), width: 30, flex: "none" }}>{x.avg}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.agent}</span>
          <span style={{ display: "block", fontSize: 11, color: verd.key ? (x.avg <= 2.9 ? "#b5555a" : MUT) : GREEN, marginTop: 1 }}>
            {best ? "best · " : ""}{verd.key ? `${verd.label} · ${x.calls} calls` : `clean · ${x.calls} calls`}
          </span>
        </span>
        <span style={{ color: MUT, fontSize: 11, flex: "none" }}>{active ? "▾" : "›"}</span>
      </button>
    );
  };

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Agent insights</span>
        <span style={{ fontSize: 12.5, color: MUT }}>{agents.length} agents · ranked by how much they need attention · {totalCalls.toLocaleString()} calls</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, padding: "16px 22px 28px", alignItems: "start" }}>
        <audio ref={audioRef} style={{ display: "none" }} />

        {/* LEFT · ranked agent list */}
        <div style={{ ...card, padding: 10, position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.6, padding: "4px 11px 3px" }}>Needs attention · {ranked.needs.length}</div>
          {ranked.needs.map(({ a: x, i, v: verd }) => <AgentRow key={x.agent} x={x} i={i} verd={verd} />)}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.6, padding: "10px 11px 3px" }}>Healthy · {ranked.healthy.length}</div>
          {ranked.healthy.map(({ a: x, i, v: verd }, k) => <AgentRow key={x.agent} x={x} i={i} verd={verd} best={k === 0} />)}
        </div>

        {/* RIGHT · selected agent detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>

          {/* header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 22, fontWeight: 600 }}>{a.agent}</span>
            <span style={{ fontSize: 12.5, color: MUT }}>{a.calls} calls · {a.avg_raters} raters each · {a.avg}/4 avg</span>
            <span style={{ flex: 1 }} />
            {needsAttention
              ? <span style={{ borderRadius: 999, background: "#fbeaea", color: RED, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>needs attention</span>
              : <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>healthy</span>}
          </div>

          {/* what to fix — verdict first, root cause, playable */}
          <div style={{ ...card, padding: "16px 18px", borderLeft: `4px solid ${needsAttention ? RED : GREEN}`, display: "flex", flexDirection: "column", gap: 12 }}>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>What to fix <span style={{ color: MUT, fontWeight: 400, fontSize: 12.5 }}>· in priority order</span></span>
            {v.key ? (
              <>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <span style={{ borderRadius: 999, fontSize: 12, padding: "3px 9px", background: INK, color: "#fff", fontWeight: 600, flex: "none", marginTop: 1 }}>1</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                      <b style={{ textTransform: "capitalize" }}>{v.label}</b>{leadSub ? <> · leading cause <b style={{ color: RED }}>{leadSub.toLowerCase()}</b> ({leadCount} findings)</> : leadRow ? <> · {leadRow.occ} findings across {leadCalls} calls</> : null}.
                      {isRootCause ? <span style={{ color: MUT }}> Root cause — fixing this clears most of the list below.</span> : null}
                    </div>
                    {leadEvidence && (
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8, background: "#fbfcfd", border: "1px solid #e2e8ee", borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }}>
                        <button onClick={() => play(leadEvidence.call_id, leadEvidence.ts)} style={{ width: 24, height: 24, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 9, cursor: "pointer", flex: "none" }}>▶</button>
                        <span className={mono.className} style={{ fontSize: 11.5, flex: "none" }}>{String(leadEvidence.call_id).slice(0, 8)} @{leadEvidence.ts}</span>
                        <span style={{ color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leadEvidence.note}</span>
                      </div>
                    )}
                  </div>
                </div>
                {secondFix && (
                  <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <span style={{ borderRadius: 999, fontSize: 12, padding: "3px 9px", background: "#eef2f6", color: "#4d5a66", fontWeight: 600, flex: "none", marginTop: 1 }}>2</span>
                    <div style={{ fontSize: 14, lineHeight: 1.5, flex: 1 }}>
                      <b style={{ textTransform: "capitalize" }}>{secondFix.title.toLowerCase()}</b> · {secondFix.count} findings by the human panel. Next after the root cause.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13.5, color: MUT }}>Nothing needs urgent attention — this agent is clean across the taxonomy. Keep sampling to hold the score.</div>
            )}
          </div>

          {/* metric chips */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600, color: scoreColor(a.avg) }}>{a.avg} / 4</div>
              <div style={{ fontSize: 11.5, color: MUT }}>avg call quality · human panel</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600 }}>{a.calls_with_issue} <span style={{ fontSize: 13, color: MUT, fontWeight: 400 }}>of {a.reviewed}</span></div>
              <div style={{ fontSize: 11.5, color: MUT }}>calls with ≥1 issue</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600, color: (a.dist?.[0] ?? 0) >= 25 ? RED : INK }}>{a.dist?.[0] ?? 0}%</div>
              <div style={{ fontSize: 11.5, color: MUT }}>rated 1 · major failure</div>
            </div>
          </div>

          {/* issue rows · human vs LLM + evidence */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 10, flexWrap: "wrap" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>What&apos;s breaking, ranked</span>
              <span style={{ fontSize: 12, color: MUT }}>share of this agent&apos;s <b style={{ color: INK }}>{a.calls} calls</b> · click a row for evidence</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: GREEN }}>● human</span>
              <span style={{ fontSize: 11, color: PURPLE }}>● LLM judge</span>
            </div>
            {(a.l2 || []).slice().sort((r1, r2) => (r2.human_calls + r2.llm_calls) - (r1.human_calls + r1.llm_calls)).map((r) => {
              const isOpen = open === r.key;
              const total = r.human_calls + r.llm_calls;
              const none = total === 0;
              return (
                <div key={r.key} style={{ borderTop: "1px solid #eef2f6", background: isOpen ? "#fbfcfd" : "transparent", margin: "0 -18px", padding: "0 18px" }}>
                  <button onClick={() => !none && setOpen(isOpen ? "" : r.key)}
                    style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "10px 0", width: "100%", background: "transparent", border: "none", cursor: none ? "default" : "pointer", textAlign: "left", color: none ? MUT : INK }}>
                    <span style={{ width: 14, color: isOpen ? GREEN : MUT }}>{none ? "·" : isOpen ? "▾" : "▸"}</span>
                    <span style={{ width: 210, fontWeight: 600, flex: "none" }}>{r.label}</span>
                    <div style={{ flex: 1, display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#eef2f6", minWidth: 90 }}>
                      <div style={{ width: `${(r.human_calls / Math.max(a.calls, 1)) * 100}%`, background: GREEN }} />
                      <div style={{ width: `${(r.llm_calls / Math.max(a.calls, 1)) * 100}%`, background: PURPLE }} />
                    </div>
                    <span style={{ width: 152, textAlign: "right", lineHeight: 1.25, fontSize: 12.5, flex: "none" }}>
                      {none ? <span style={{ color: MUT }}>nothing flagged</span> : <>
                        <b>{total} of {a.reviewed} calls</b><br />
                        <span style={{ fontSize: 11 }}><span style={{ color: GREEN }}>{r.human_calls} human · {r.occ} findings</span>{r.llm_calls ? <> · <span style={{ color: PURPLE }}>{r.llm_calls} LLM</span></> : null}</span>
                      </>}
                    </span>
                  </button>
                  {isOpen && !none && (
                    <div style={{ padding: "2px 0 12px 24px", display: "flex", flexDirection: "column", gap: 7 }}>
                      {r.subtypes?.length > 0 && (
                        <div style={{ display: "flex", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
                          {r.subtypes.map(([st, n], i) => (
                            <span key={st} style={{ borderRadius: 999, padding: "4px 11px", fontSize: 11.5, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? "#fbeaea" : "#eef2f6", color: i === 0 ? RED : "#4d5a66" }}>{st} · {n}</span>
                          ))}
                        </div>
                      )}
                      {(r.evidence || []).map((e: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
                          <button onClick={() => play(e.call_id, e.ts)} style={{ width: 24, height: 24, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 9, cursor: "pointer", flex: "none" }}>▶</button>
                          <span className={mono.className} style={{ fontSize: 11.5, flex: "none" }}>{String(e.call_id).slice(0, 8)} @{e.ts}</span>
                          <span style={{ borderRadius: 999, fontSize: 10, background: r.key === "response" && r.llm_calls > r.human_calls ? "#f3eefc" : "#e7f4ee", color: r.key === "response" && r.llm_calls > r.human_calls ? PURPLE : GREEN, padding: "2px 8px", flex: "none" }}>{r.key === "response" && r.llm_calls > r.human_calls ? "LLM judge" : "human"}</span>
                          <span style={{ color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</span>
                        </div>
                      ))}
                      <a href={`/portal/issues?type=${L2_ISSUE_ROUTE[r.key] || "pronunciation"}`} style={{ fontSize: 12, color: GREEN, textDecoration: "none" }}>all {total} calls with evidence →</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* closing insight line */}
          <div style={{ fontSize: 12, color: MUT }}>
            {v.key && leadCalls > 0
              ? <>{leadCalls} of this agent&apos;s issues trace back to <b style={{ color: INK, textTransform: "capitalize" }}>{v.label}</b> — one fix, most of the list clears. </>
              : <>Clean across the taxonomy. </>}
            Golden transcripts for this agent are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>.
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

export default function AgentInsights() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
