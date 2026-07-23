"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";

// By agent (wireframe 7a) — one agent at a time, same L2 vocabulary as the
// Overall page. Stat row → expandable L2 rows (human/LLM split, subtype
// chips, playable evidence) → daily vibe chart + what-to-fix-first.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf", RED = "#d6484f", AMBER = "#b07a15";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };
const CANON = "https://api.bolna.ai/recordings/call/";

function Inner() {
  const params = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<string>(params.get("l2") || "response");
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/byagent").then((r) => r.json()).then((d) => {
      setData(d);
      const want = params.get("agent");
      if (want && d?.agents) {
        const i = d.agents.findIndex((x: any) => String(x.agent).toLowerCase().includes(want.toLowerCase()));
        if (i >= 0) setSel(i);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!data) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading agent detail…</main>;

  const agents = data.agents || [];
  const a = agents[Math.min(sel, agents.length - 1)] || {};
  const needsAttention = a.avg <= 2.9;
  const maxL2 = Math.max(...(a.l2 || []).map((r: any) => r.human_calls + r.llm_calls), 1);
  const maxDaily = 4;

  function play(callId: string, ts: string) {
    const el = audioRef.current; if (!el) return;
    el.src = `/api/audio?url=${encodeURIComponent(CANON + callId)}`;
    const [m2, s2] = String(ts || "0:0").split(":");
    const go = () => { try { el.currentTime = Math.max(0, Number(m2) * 60 + Number(s2 || 0) - 2); } catch {} el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
  }

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: MUT }}>By agent /</span>
        <div style={{ position: "relative" }}>
          <button onClick={() => setPicker(!picker)} className={grotesk.className}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: INK, border: "1px solid #d6dee6", borderRadius: 8, padding: "7px 12px", background: "#fff", cursor: "pointer" }}>
            {a.agent} <span style={{ color: MUT, fontSize: 11 }}>▾</span>
          </button>
          {picker && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 30, width: 340, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 8px 24px rgba(16,24,31,.12)", padding: 8 }}>
              <div style={{ fontSize: 11, color: MUT, padding: "4px 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>Your agents · {agents.length}</div>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…"
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12.5, padding: "7px 10px", border: "1px solid #e2e8ee", borderRadius: 8, margin: "2px 0 6px", fontFamily: "inherit" }} />
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {agents.map((x: any, i: number) => String(x.agent).toLowerCase().includes(q.toLowerCase()) && (
                  <button key={x.agent} onClick={() => { setSel(i); setPicker(false); setQ(""); setOpen("response"); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: i === sel ? "#eef2f6" : "transparent", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: INK }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: i === sel ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.agent}</span>
                    <span className={grotesk.className} style={{ fontSize: 12, fontWeight: 600, color: x.avg <= 2.5 ? RED : x.avg <= 2.9 ? AMBER : GREEN }}>{x.avg}/4</span>
                    <span style={{ fontSize: 10.5, color: MUT }}>{x.calls} calls</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {needsAttention && <span style={{ borderRadius: 999, background: "#fbeaea", color: RED, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>needs attention</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ maxWidth: 1020, margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
        <audio ref={audioRef} style={{ display: "none" }} />

        {/* stat row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1, minWidth: 170, padding: "14px 16px" }}>
            <div className={grotesk.className} style={{ fontSize: 24, fontWeight: 600, color: a.avg <= 2.5 ? RED : a.avg <= 2.9 ? AMBER : GREEN }}>{a.avg} / 4</div>
            <div style={{ fontSize: 11.5, color: MUT }}>avg human vibe · {a.calls} calls, avg {a.avg_raters} raters</div>
          </div>
          <div style={{ ...card, flex: 1, minWidth: 170, padding: "14px 16px" }}>
            <div style={{ display: "flex", height: 11, borderRadius: 6, overflow: "hidden", margin: "7px 0 5px" }}>
              <span style={{ width: `${a.dist?.[0] ?? 0}%`, background: RED }} />
              <span style={{ width: `${a.dist?.[1] ?? 0}%`, background: "#e89b9b" }} />
              <span style={{ width: `${a.dist?.[2] ?? 0}%`, background: "#c9e9db" }} />
              <span style={{ width: `${a.dist?.[3] ?? 0}%`, background: GREEN }} />
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>score distribution · {a.dist?.[0] ?? 0}% rated 1</div>
          </div>
          <div style={{ ...card, flex: 1, minWidth: 150, padding: "14px 16px" }}>
            <div className={grotesk.className} style={{ fontSize: 24, fontWeight: 600 }}>{a.calls_with_issue} <span style={{ fontSize: 14, color: MUT, fontWeight: 400 }}>of {a.reviewed}</span></div>
            <div style={{ fontSize: 11.5, color: MUT }}>calls with ≥1 issue · panel-verified</div>
          </div>
          <div style={{ ...card, flex: 1, minWidth: 170, padding: "14px 16px" }}>
            <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>
              {a.trend?.first} → {a.trend?.last}
              <span style={{ fontSize: 13, color: (a.trend?.last ?? 0) >= (a.trend?.first ?? 0) ? GREEN : RED }}> {(a.trend?.last ?? 0) >= (a.trend?.first ?? 0) ? "↗" : "↘"}</span>
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>avg vibe, first half → latest · {(a.trend?.last ?? 0) >= (a.trend?.first ?? 0) ? "improving" : "declining"}</div>
          </div>
        </div>

        {/* L2 rows */}
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 10, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Issues on this agent</span>
            <span style={{ fontSize: 12, color: MUT }}>how many of this agent&apos;s <b style={{ color: INK }}>{a.calls} calls</b> have each issue · click a row to expand</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: GREEN }}>● found by human reviewers</span>
            <span style={{ fontSize: 11, color: PURPLE }}>● found by LLM judge</span>
          </div>
          {(a.l2 || []).map((r: any) => {
            const isOpen = open === r.key;
            const total = r.human_calls + r.llm_calls;
            return (
              <div key={r.key} style={{ borderTop: "1px solid #eef2f6", background: isOpen ? "#fbfcfd" : "transparent", margin: "0 -18px", padding: "0 18px" }}>
                <button onClick={() => setOpen(isOpen ? "" : r.key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "10px 0", width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: INK }}>
                  <span style={{ width: 14, color: isOpen ? GREEN : MUT }}>{isOpen ? "▾" : "▸"}</span>
                  <span style={{ width: 225, fontWeight: 600, flex: "none" }}>{r.label}</span>
                  <div style={{ flex: 1, display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#eef2f6" }}>
                    <div style={{ width: `${(r.human_calls / Math.max(a.calls, maxL2)) * 100}%`, background: GREEN }} />
                    <div style={{ width: `${(r.llm_calls / Math.max(a.calls, maxL2)) * 100}%`, background: PURPLE }} />
                  </div>
                  <span style={{ width: 150, textAlign: "right", lineHeight: 1.25, fontSize: 12.5, flex: "none" }}>
                    <b>{total} of {a.reviewed} calls</b><br />
                    <span style={{ fontSize: 11 }}>
                      <span style={{ color: GREEN }}>{r.human_calls} by humans ({r.occ} findings)</span>{r.llm_calls ? <> · <span style={{ color: PURPLE }}>{r.llm_calls} by LLM</span></> : null}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "2px 0 12px 24px", display: "flex", flexDirection: "column", gap: 7 }}>
                    {r.subtypes?.length > 0 && (
                      <div style={{ display: "flex", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
                        {r.subtypes.map(([st, n]: [string, number], i: number) => (
                          <span key={st} style={{ borderRadius: 999, padding: "4px 11px", fontSize: 11.5, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? "#fbeaea" : "#eef2f6", color: i === 0 ? RED : "#4d5a66" }}>
                            {st} · {n}
                          </span>
                        ))}
                      </div>
                    )}
                    {(r.evidence || []).map((e: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
                        <button onClick={() => play(e.call_id, e.ts)} style={{ width: 24, height: 24, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 9, cursor: "pointer", flex: "none" }}>▶</button>
                        <span className={mono.className} style={{ fontSize: 11.5, flex: "none" }}>{String(e.call_id).slice(0, 8)} @{e.ts}</span>
                        <span style={{ borderRadius: 999, fontSize: 10, background: "#e7f4ee", color: GREEN, padding: "2px 8px", flex: "none" }}>human</span>
                        <span style={{ color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</span>
                      </div>
                    ))}
                    <a href={`/portal/issues?type=${r.key === "transcription" ? "asr" : r.key === "response" ? "response" : r.key === "naturalness" ? "tone" : "pronunciation"}`}
                      style={{ fontSize: 12, color: GREEN, textDecoration: "none" }}>all {r.human_calls} calls with evidence →</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* daily chart + fix first */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1, minWidth: 320, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>
              Agent performance, daily <span style={{ color: MUT, fontWeight: 400, fontSize: 11.5 }}>avg human vibe, out of 4</span>
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 84, padding: "0 2px" }}>
              {(a.daily || []).map((d: any, i: number) => {
                const last = i === (a.daily || []).length - 1;
                return (
                  <div key={d.d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                    {last && <span className={mono.className} style={{ fontSize: 10, color: INK, fontWeight: 600 }}>{d.avg}</span>}
                    <div title={`${d.avg}/4 · ${d.n} scores`} style={{ width: "100%", height: `${(d.avg / maxDaily) * 100}%`, background: d.avg <= 2 ? RED : d.avg <= 2.9 ? "#e89b9b" : "#8fd0b4", borderRadius: "3px 3px 0 0" }} />
                    <span className={mono.className} style={{ fontSize: 9, color: MUT }}>{d.d.slice(3)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>
              scored same-day by the panel · {a.trend?.first} → {a.trend?.last}{(a.trend?.last ?? 0) < 4 ? ", still far from a clean call (4)" : ""}
            </div>
          </div>
          <div style={{ ...card, flex: 1.4, minWidth: 340, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>What to fix first</span>
            {(a.fixes || []).length === 0 && <span style={{ fontSize: 12.5, color: MUT }}>No response-appropriateness subtypes logged for this agent yet.</span>}
            {(a.fixes || []).map((f: any, i: number) => (
              <div key={f.title} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
                <span style={{ borderRadius: 999, fontSize: 11, padding: "3px 9px", background: i === 0 ? INK : "#eef2f6", color: i === 0 ? "#fff" : "#4d5a66", fontWeight: 600 }}>{i + 1}</span>
                <span><b>{f.title}</b> — {f.count} findings by the human panel</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: MUT }}>Ranked by findings · severity weighting comes from the human ratings on those calls.</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Same L2 vocabulary as <a href="/portal" style={{ color: GREEN }}>Overall</a> · golden transcripts for this agent are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>
        </div>
      </div>
    </PortalShell>
  );
}

export default function ByAgent() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
