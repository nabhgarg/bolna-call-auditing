"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, RED, AMBER, card } from "../../../lib/ui";
import { isPortalUser } from "../../../lib/role";
import DemoReady from "../../../lib/DemoReady";
import ReportPrint from "./report";
import { isDemo } from "../../../lib/demo";

// Agent insights · one card per agent, the four intake checks stacked inside,
// each with its real ASR/response evidence. This is the mirror of the
// new-use-case intake: the client picked checks, we report on those checks.
//
// Scope is deliberate. Of everything Bolna sent, only four agents have enough
// human review (170+ each) to stand behind · every other agent is 11-18 calls,
// single-rater, and there are no unreviewed calls left to deepen them. Showing
// a hard score on 14 calls would contradict the whole reliability pitch, so we
// show the four we can defend and nothing we can't. Every number here is human
// judgment · the machine judge stays internal, same rule as the intake.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const CANON = "https://api.bolna.ai/recordings/call/";

type L2 = { key: string; label: string; human_calls: number; llm_calls: number; occ: number; evidence: any[]; subtypes: [string, number][] };
type Agent = { agent: string; avg: number; dist: number[]; calls: number; avg_raters: number; reviewed: number; calls_with_issue: number; bad_pct: number; trend: { first: number; last: number }; daily: any[]; l2: L2[]; fixes: { title: string; count: number }[] };

// The four checks, in the intake's order. Each maps to one or more raw feed
// categories · "Pronunciation & names" merges the two the feed splits, and
// "Transcription" is named plainly rather than "Input capture" because a
// dashboard whose engine is the transcription tool should say the word.
const CHECKS: { label: string; tag?: string; keys: string[]; route: string }[] = [
  { label: "Transcription", tag: "ASR · input capture", keys: ["transcription"], route: "asr" },
  { label: "Response accuracy", keys: ["response"], route: "response" },
  { label: "Pronunciation & names", keys: ["pronunciation", "proper_noun"], route: "pronunciation" },
  { label: "Tone & naturalness", keys: ["naturalness"], route: "tone" },
];

// The agents deep enough to trust, in display order. Falls back to the highest-
// reviewed agents if the archetype labels ever change upstream.
const TARGET = [
  "Cart Recovery · E-commerce B",
  "Seller Activation · B2B Marketplace",
  "Cart Recovery · E-commerce A",
  "Cart Recovery · Marketplace",
];

function checkStat(a: Agent, keys: string[]) {
  const rows = (a.l2 || []).filter((r) => keys.includes(r.key));
  const den = Math.max(a.reviewed || 0, 1);
  const flagged = Math.min(rows.reduce((s, r) => s + (r.human_calls || 0), 0), den);
  const findings = rows.reduce((s, r) => s + (r.occ || 0), 0);
  const evidence = rows.flatMap((r) => r.evidence || []).slice(0, 2);
  return { flagged, findings, rate: Math.round((flagged / den) * 100), evidence };
}

// verdict label kept only for the printed report's fleet table
function verdictFor(a: Agent) {
  const stats = CHECKS.map((c) => ({ c, ...checkStat(a, c.keys) })).sort((x, y) => y.rate - x.rate);
  const top = stats[0];
  if (!top || top.rate === 0) return { label: "clean", key: "" };
  return { label: top.c.label === "Transcription" ? "ASR mishears input" : top.c.label.toLowerCase(), key: top.c.keys[0] };
}

function Inner() {
  const params = useSearchParams();
  const [data, setData] = useState<{ agents: Agent[] } | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // read after mount, never during render · avoids a hydration mismatch
  const [demo, setDemo] = useState(false);
  // only feeds the printed report's method note
  const [panelRel, setPanelRel] = useState<{ inter_panel: number; vs_gt: number; calls: number } | null>(null);
  const [openCell, setOpenCell] = useState<string>(params.get("l2") || "");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed(isPortalUser());
    setDemo(isDemo());
    fetch("/api/portal/reliability").then((r) => r.json()).then((d) => setPanelRel(d?.overall || null)).catch(() => {});
    fetch("/api/portal/byagent").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const agents = data?.agents || [];

  // The four deep agents, in order · fall back to highest-reviewed if the
  // labels drift upstream, so the page never renders empty.
  const shown = useMemo(() => {
    const picked = TARGET.map((n) => agents.find((x) => x.agent === n)).filter(Boolean) as Agent[];
    if (picked.length >= 4) return picked.slice(0, 4);
    const rest = [...agents].filter((a) => !picked.includes(a)).sort((a, b) => (b.reviewed || 0) - (a.reviewed || 0));
    return [...picked, ...rest].slice(0, 4);
  }, [agents]);

  const scoreColor = (x: number) => (x <= 2.5 ? RED : x <= 2.9 ? AMBER : GREEN);
  const rateColor = (r: number) => (r >= 30 ? AMBER : r >= 60 ? RED : GREEN);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to your team. <a href="/portal/login?next=/portal/agents" style={{ color: GREEN }}>Log in</a> to see this program, or <a href="/portal/new-use-case" style={{ color: GREEN }}>start a use case</a>.</main>;
  if (!data) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading agent insights…</main>;

  const totalReviews = shown.reduce((s, a) => s + (a.reviewed || 0), 0);

  function play(callId: string, ts: string) {
    const el = audioRef.current; if (!el) return;
    el.src = `/api/audio?url=${encodeURIComponent(CANON + callId)}`;
    const [m2, s2] = String(ts || "0:0").split(":");
    const go = () => { try { el.currentTime = Math.max(0, Number(m2) * 60 + Number(s2 || 0) - 2); } catch {} el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
  }

  // one-line, per-agent summary · led by the check that breaks most
  function summary(a: Agent) {
    const stats = CHECKS.map((c) => ({ c, ...checkStat(a, c.keys) })).sort((x, y) => y.rate - x.rate);
    const top = stats[0];
    const resp = checkStat(a, ["response"]).rate;
    if (!top || top.rate < 5) return "Clean across every check a human panel ran. Keep sampling to hold the score.";
    if (top.c.label === "Transcription")
      return `Mishears the customer on ${top.rate}% of calls · the ASR drops or garbles what they say. What the agent says back is mostly fine (${resp}%). Fix transcription and most of the gap closes.`;
    return `${top.c.label} is the gap · flagged on ${top.rate}% of calls. The rest is largely clean.`;
  }

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Agent insights</span>
        <span style={{ fontSize: 12.5, color: MUT }}>{shown.length} agents · deepest coverage · {totalReviews.toLocaleString()} human reviews</span>
        {demo && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#b07a15", background: "#faf3e3", borderRadius: 999, padding: "4px 11px" }}>This is based on what we have done for Bolna</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <ReportPrint agents={shown as never} reliability={panelRel} program="Bolna" verdictLabel={(x) => verdictFor(x as never).label} />

      <div className={`screen-only ${instrument.className}`} style={{ maxWidth: 760, margin: "0 auto", padding: "18px 22px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
        <DemoReady ready={shown.length > 0} />
        <audio ref={audioRef} style={{ display: "none" }} />

        {shown.map((a) => {
          const needsAttention = a.avg <= 2.9;
          const stats = CHECKS.map((c) => ({ c, ...checkStat(a, c.keys) }));
          return (
            <div key={a.agent} style={{ ...card, padding: "16px 18px" }}>
              {/* header */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 600 }}>{a.agent}</span>
                <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 700, color: scoreColor(a.avg) }}>{a.avg} / 4</span>
                <span style={{ fontSize: 11.5, color: MUT }}>{a.reviewed} human reviews · {a.calls} calls</span>
                <span style={{ flex: 1 }} />
                {needsAttention
                  ? <span style={{ borderRadius: 999, background: "#fbeaea", color: RED, fontSize: 11, fontWeight: 600, padding: "3px 10px" }}>needs attention</span>
                  : <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 11, fontWeight: 600, padding: "3px 10px" }}>healthy</span>}
              </div>

              {/* per-agent summary */}
              <div style={{ fontSize: 13.5, lineHeight: 1.5, background: "#f5f7f9", borderRadius: 9, padding: "10px 12px", margin: "9px 0 4px", borderLeft: `3px solid ${needsAttention ? AMBER : GREEN}` }}>{summary(a)}</div>

              {/* the four checks, each with its evidence */}
              {stats.map(({ c, rate, findings, evidence }) => {
                const cellId = `${a.agent}::${c.label}`;
                const isOpen = openCell === cellId;
                const none = rate === 0 && findings === 0;
                return (
                  <div key={c.label} style={{ borderTop: "1px solid #eef2f6", margin: "0 -18px", padding: "0 18px", background: isOpen ? "#fbfcfd" : "transparent" }}>
                    <button onClick={() => !none && setOpenCell(isOpen ? "" : cellId)}
                      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 0", background: "transparent", border: "none", cursor: none ? "default" : "pointer", textAlign: "left", color: INK }}>
                      <span style={{ width: 13, color: isOpen ? GREEN : MUT, flex: "none", fontSize: 11 }}>{none ? "·" : isOpen ? "▾" : "▸"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                        {c.tag && <span style={{ fontSize: 10, fontWeight: 600, color: "#93a1ae", marginLeft: 7 }}>{c.tag}</span>}
                      </span>
                      <span style={{ width: 120, height: 10, borderRadius: 5, background: "#eef2f6", overflow: "hidden", flex: "none" }}>
                        <span style={{ display: "block", height: "100%", width: `${rate}%`, background: rateColor(rate) }} />
                      </span>
                      <span style={{ width: 96, textAlign: "right", flex: "none", lineHeight: 1.2 }}>
                        {none ? <span style={{ fontSize: 12, color: MUT }}>nothing flagged</span> : <>
                          <b style={{ fontSize: 14, color: rateColor(rate) }}>{rate}%</b><br />
                          <span style={{ fontSize: 10, color: MUT }}>{findings} findings</span>
                        </>}
                      </span>
                    </button>
                    {isOpen && !none && (
                      <div style={{ padding: "0 0 12px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {evidence.length === 0 && <span style={{ fontSize: 12, color: MUT }}>Flagged on {rate}% of calls · open the full list for the calls.</span>}
                        {evidence.map((e: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "7px 10px", fontSize: 12.5 }}>
                            <button onClick={() => play(e.call_id, e.ts)} style={{ width: 23, height: 23, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 8, cursor: "pointer", flex: "none" }}>▶</button>
                            <span className={mono.className} style={{ fontSize: 11, color: MUT, flex: "none" }}>{String(e.call_id).slice(0, 8)} @{e.ts}</span>
                            <span style={{ color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</span>
                          </div>
                        ))}
                        <a href={`/portal/issues?type=${c.route}`} style={{ fontSize: 12, color: GREEN, textDecoration: "none" }}>all calls with evidence →</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ fontSize: 11.5, color: MUT, textAlign: "center", lineHeight: 1.5 }}>
          Every rate and example is human review · the machine judge stays internal. Golden transcripts for these agents are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>.
        </div>
      </div>
    </PortalShell>
  );
}

export default function AgentInsights() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
