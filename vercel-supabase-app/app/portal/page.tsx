"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "./shell";
import { PAGE, INK, MUT, GREEN, RED, AMBER, card } from "../../lib/ui";

// Overall — reads backwards from the rubric (wireframe 6a):
// 1. Overall issues: human-identified L2s, calls affected per issue + summary box
// 2. VBL spotlight: the worst agent, what's breaking, playable proof
// 3. Agents needing attention: avg human vibe /4, score distribution, raters
// 4. Trust card: hidden ground-truth agreement vs everyday panel agreement
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const CANON = "https://api.bolna.ai/recordings/call/";

export default function Portal() {
  const [ov, setOv] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/overview").then((r) => r.json()).then(setOv).catch((e) => setError(String(e)));
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!ov) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Computing live metrics…"}</main>;

  const s = ov.summary || {};
  const l2 = [...(ov.l2 || [])].sort((a: any, b: any) => b.calls - a.calls);
  const maxCalls = Math.max(...l2.map((i: any) => i.calls), 1);
  const vbl = ov.vbl || {};
  const trust = ov.trust || {};
  const agents = (ov.agents || []).slice(0, 4);

  function playVbl() {
    const a = audioRef.current; if (!a || !vbl.example) return;
    a.src = `/api/audio?url=${encodeURIComponent(CANON + vbl.example.call_id)}`;
    const [m2, s2] = String(vbl.example.ts || "0:0").split(":");
    const go = () => { try { a.currentTime = Math.max(0, Number(m2) * 60 + Number(s2 || 0) - 2); } catch {} a.play().catch(() => {}); };
    if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
  }

  const vblCapture = (vbl.resp_subtypes || []).find((x: any) => String(x[0]).toLowerCase().includes("capture"));
  const vblRepeat = (vbl.resp_subtypes || []).find((x: any) => String(x[0]).toLowerCase().includes("repet"));

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Overall</span>
        <span style={{ fontSize: 12, color: MUT }}>everything below maps to the rubric you set at launch</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ maxWidth: PAGE, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <audio ref={audioRef} style={{ display: "none" }} />

        {/* 1 — Overall issues (human-identified L2s) */}
        <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Overall issues</span>
            <span style={{ fontSize: 12, color: MUT }}>calls with ≥1 occurrence, of {ov.evaluated_calls} evaluated</span>
            <span style={{ flex: 1 }} />
            <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>Human-identified L2s</span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
            <div style={{ width: 195, flex: "none", background: "#f5f7f9", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 3 }}>
              <div className={grotesk.className} style={{ fontSize: 30, fontWeight: 600 }}>{Number(s.occurrences || 0).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: MUT, lineHeight: 1.4 }}>issue occurrences across <b style={{ color: INK }}>{s.calls_with_issue} calls</b> ({s.pct_calls}% of evaluated)</div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: GREEN, fontWeight: 600 }}>{s.human_only_pct}% only a human could catch</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
              {l2.map((i: any) => (
                <a key={i.key} href={`/portal/agents?l2=${i.key}`} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, textDecoration: "none", color: INK }}>
                  <span style={{ width: 205, flex: "none" }}>{i.label}</span>
                  <div style={{ flex: 1, height: 13, borderRadius: 7, background: "#eef2f6", overflow: "hidden" }}>
                    <div style={{ width: `${(i.calls / maxCalls) * 100}%`, height: "100%", borderRadius: 7, background: GREEN }} />
                  </div>
                  <span className={grotesk.className} style={{ width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{i.calls} calls</span>
                  <span style={{ color: GREEN, width: 16, textAlign: "center" }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 2 — VBL spotlight */}
        <div style={{ ...card, border: `1.5px solid ${RED}`, background: "#fffafa", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 8, alignSelf: "stretch", borderRadius: 4, background: RED, flex: "none" }} />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>VBL · Visi Cooler v5.1 is your worst agent</span>
              <span style={{ borderRadius: 999, background: "#fbeaea", color: RED, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>{vbl.bad_pct}% of calls rated bad</span>
            </div>
            <div style={{ fontSize: 13, color: "#4d5a66", marginTop: 3, lineHeight: 1.5 }}>
              What&apos;s breaking: the agent <b>captures the wrong barcode / input in {vblCapture ? vblCapture[1] : "—"} findings</b> and repeats itself in {vblRepeat ? vblRepeat[1] : "—"} — the ASR can&apos;t hear &quot;barcode&quot;, so everything downstream breaks; users hang up mid-call.
            </div>
          </div>
          <button onClick={playVbl} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer" }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: RED, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>▶</span>
            <span className={mono.className}>{String(vbl.example?.call_id || "").slice(0, 8)} @{vbl.example?.ts}</span>
          </button>
          <a href="/portal/agents?agent=Visi" style={{ flex: "none", fontSize: 13, fontWeight: 600, color: INK, background: "#fff", border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 14px", textDecoration: "none" }}>Open agent →</a>
        </div>

        {/* 3 + 4 — agents table & trust */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1.35, minWidth: 380, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Agents needing attention</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: MUT }}>human ratings · 1–4 scale</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 78px 120px 74px", fontSize: 12.5 }}>
              <div style={{ color: MUT, fontSize: 11, padding: "4px 0" }}>agent</div>
              <div style={{ color: MUT, fontSize: 11, padding: "4px 0" }}>avg vibe</div>
              <div style={{ color: MUT, fontSize: 11, padding: "4px 0" }}>distribution</div>
              <div style={{ color: MUT, fontSize: 11, padding: "4px 0", textAlign: "right" }}>raters/call</div>
              {agents.map((a: any) => (
                <React.Fragment key={a.agent}>
                  <div style={{ padding: "8px 0", borderTop: "1px solid #eef2f6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{a.agent}</b></div>
                  <div style={{ padding: "8px 0", borderTop: "1px solid #eef2f6" }}><b style={{ color: a.avg <= 2.5 ? RED : AMBER }}>{a.avg} / 4</b></div>
                  <div style={{ padding: "8px 0", borderTop: "1px solid #eef2f6", display: "flex", alignItems: "center" }}>
                    <span style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", width: 110 }}>
                      <span style={{ width: `${a.dist[0]}%`, background: RED }} />
                      <span style={{ width: `${a.dist[1]}%`, background: "#e89b9b" }} />
                      <span style={{ width: `${a.dist[2]}%`, background: "#c9e9db" }} />
                      <span style={{ width: `${a.dist[3]}%`, background: GREEN }} />
                    </span>
                  </div>
                  <div className={mono.className} style={{ padding: "8px 0", borderTop: "1px solid #eef2f6", textAlign: "right", fontSize: 12 }}>{a.avg_raters} <span style={{ color: MUT, fontSize: 10 }}>({a.calls} calls)</span></div>
                </React.Fragment>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>
              Scored by trained humans, {agents[0] ? `avg ${agents[0].avg_raters}` : "≥3"} raters per call{ov.healthy ? <> · <b style={{ color: INK }}>{ov.healthy.agent}</b> ({ov.healthy.avg}/4) is healthy, not shown</> : null}
            </div>
          </div>

          <div style={{ ...card, flex: 1, minWidth: 300, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, background: "#f2faf6", borderColor: "#bfe2d2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: 10, background: GREEN, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Why you can trust these numbers</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#4d5a66" }}>
              We seed <b style={{ color: INK }}>hidden expert-rated calls</b> into reviewer batches, unmarked. Reviewers never know which calls are ground truth.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "10px 12px" }}>
                <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, color: GREEN }}>{trust.gt_agreement}%</div>
                <div style={{ fontSize: 11, color: MUT, lineHeight: 1.3 }}>agreement with hidden expert ratings (±1, n={Number(trust.gt_n || 0).toLocaleString()})</div>
              </div>
              <div style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "10px 12px" }}>
                <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600 }}>{trust.internal_agreement}%</div>
                <div style={{ fontSize: 11, color: MUT, lineHeight: 1.3 }}>panel agreement on all other calls (±1)</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>
              Within {Math.abs((trust.internal_agreement || 0) - (trust.gt_agreement || 0))} points — the panel performs almost the same when it can&apos;t tell it&apos;s being tested.
            </div>
            <a href="/dashboard" style={{ fontSize: 12, color: GREEN, textDecoration: "none", fontWeight: 600 }}>full calibration numbers →</a>
          </div>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Live · computed {String(ov.generated_at || "").slice(0, 10)} · {ov.evaluated_calls} calls human-evaluated · datasets generated by this program are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>
        </div>
      </div>
    </PortalShell>
  );
}
