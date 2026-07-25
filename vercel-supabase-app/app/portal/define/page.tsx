"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, card } from "../../../lib/ui";
import { LANE_LABEL, type EngineDesign, type Lane } from "../../../lib/engine";

// Client Input · the front door of the Engine.
// The client writes their task in plain language; the Engine (POST /api/engine)
// breaks it into sub-tasks a screened human can do accurately, says what the
// screening must prove, and designs the process that turns that work into fast
// accurate output. Nothing here is a rubric builder: the client never picks a
// metric, they describe the job.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const EXAMPLE = "Our voice agent calls customers in Hindi and English to confirm orders. It has to capture the order amount and the delivery address correctly, and it should only quote prices from our catalog.";
const VOLUMES: [string, number][] = [["under 500", 300], ["500-2,000", 1200], ["2,000+", 5000]];
const laneStyle = (l: Lane) => l === "judge_owned"
  ? { bg: "#f3eefc", fg: PURPLE }
  : l === "judge_assist" ? { bg: "#f5f2fb", fg: PURPLE } : { bg: "#e7f4ee", fg: GREEN };

export default function Define() {
  const [desc, setDesc] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Voice agent");
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [vol, setVol] = useState(1200);
  const [design, setDesign] = useState<EngineDesign | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastRef = useRef("");

  useEffect(() => { setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert"); }, []);

  // run the engine as they type (debounced) · this is the "it already knows" moment
  useEffect(() => {
    const task = desc.trim();
    clearTimeout(debounceRef.current);
    if (task.length < 20) { setDesign(null); return; }
    setBusy(true);
    debounceRef.current = setTimeout(async () => {
      const stamp = task + "|" + vol;
      lastRef.current = stamp;
      try {
        const d = await fetch("/api/engine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, callsPerWeek: vol }) }).then((r) => r.json());
        if (lastRef.current === stamp) setDesign(d);
      } catch { /* keep the last good design */ }
      if (lastRef.current === stamp) setBusy(false);
    }, 700);
    return () => clearTimeout(debounceRef.current);
  }, [desc, vol]);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;

  const subs = design?.subtasks || [];
  const p = design?.process;
  const ready = subs.length > 0;

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>New use case</span>
        <span style={{ fontSize: 12.5, color: MUT }}>describe the job · we design the human pipeline that does it</span>
      </div>
    }>
      <div className={instrument.className} style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 16, padding: "16px 22px 30px", alignItems: "start", color: INK }}>

        {/* LEFT · the task */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>What should the AI get right?</span>
              <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>Write it the way you would explain it to a new teammate. No rubric, no schema.</div>
            </div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={7} placeholder={EXAMPLE}
              style={{ width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.6, padding: "12px 14px", border: "1px solid #d6dee6", borderRadius: 10, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setDesc(EXAMPLE)} style={{ fontSize: 12, padding: "6px 11px", borderRadius: 7, border: "1px solid #d6dee6", background: "#fff", color: "#4d5a66", cursor: "pointer" }}>Use an example</button>
              <span style={{ fontSize: 11.5, color: busy ? GREEN : MUT }}>
                {busy ? "Designing the pipeline…" : ready ? `${subs.length} sub-tasks · ready to run` : "Describe the job · the pipeline appears as you type."}
              </span>
            </div>
          </div>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Key info</span>
            <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 5 }}>Use case name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order confirmation · Hindi"
                style={{ padding: "9px 11px", border: "1px solid #d6dee6", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </label>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Channel</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Voice agent", "Chat / text agent"].map((k) => (
                  <span key={k} onClick={() => setKind(k)} style={{ borderRadius: 999, background: kind === k ? GREEN : "#eef2f6", color: kind === k ? "#fff" : "#4d5a66", fontWeight: kind === k ? 600 : 400, fontSize: 12, padding: "6px 13px", cursor: "pointer" }}>{k}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Languages on the line</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((l) => {
                  const on = langs.includes(l);
                  return <span key={l} onClick={() => setLangs((s) => on ? s.filter((x) => x !== l) : [...s, l])}
                    style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "5px 11px", fontSize: 11.5, cursor: "pointer" }}>{l}</span>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Calls per week</div>
              <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                {VOLUMES.map(([label, v]) => (
                  <div key={label} onClick={() => setVol(v)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "7px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: v === vol ? "#fff" : "transparent", color: v === vol ? INK : MUT, boxShadow: v === vol ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{label}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT · the pipeline the engine designed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>The pipeline we will run</span>
              <span style={{ fontSize: 12, color: MUT }}>your job, broken into work a screened human does accurately</span>
            </div>

            {!ready && (
              <div style={{ border: "1px dashed #dbe3ea", borderRadius: 12, padding: "26px 18px", textAlign: "center", color: MUT, fontSize: 12.5 }}>
                {busy ? "Reading your description…" : "Nothing yet. Describe the job on the left and the sub-tasks appear here."}
              </div>
            )}

            {subs.map((s) => {
              const ls = laneStyle(s.lane);
              return (
                <div key={s.key + s.label} style={{ border: `1px solid ${s.novel ? "#e2d9f5" : "#e6ebf0"}`, background: s.novel ? "#fbf9ff" : "#fff", borderRadius: 12, padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</span>
                    {s.novel && <span style={{ borderRadius: 999, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: "#f3eefc", color: PURPLE }}>new capability</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ borderRadius: 999, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: ls.bg, color: ls.fg }}>{LANE_LABEL[s.lane]}</span>
                    {!s.novel && <span className={mono.className} style={{ fontSize: 11, color: MUT }}>₹{s.rateInr} / {s.unit}</span>}
                  </div>
                  {s.why && <div style={{ fontSize: 12.5, color: "#4d5a66", marginTop: 6, lineHeight: 1.5 }}>{s.why}</div>}
                  <div style={{ fontSize: 11.5, color: MUT, marginTop: 6, lineHeight: 1.5 }}>
                    <b style={{ color: INK }}>Reviewer sees:</b> {s.unitOfWork}. <b style={{ color: INK }}>Decides:</b> {s.decision}
                  </div>
                  <div style={{ fontSize: 11, color: MUT, marginTop: 6, lineHeight: 1.5, borderTop: "1px solid #f0f3f6", paddingTop: 6 }}>
                    {s.laneReason}
                    {!s.novel && s.humanScore > 0 && (
                      <> <span className={mono.className} style={{ color: GREEN }}>human {s.humanScore}</span>
                        {s.judgeScore !== null && <> <span className={mono.className} style={{ color: PURPLE }}>· judge {s.judgeScore}</span></>}</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {ready && p && (
            <>
              <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Who we route it to</span>
                <div style={{ fontSize: 12, color: MUT, marginTop: -4 }}>only reviewers who prove they can do the sub-task get the work</div>
                {(design?.screening || []).map((s) => (
                  <div key={s.capability} style={{ fontSize: 12, color: "#4d5a66", lineHeight: 1.5, display: "flex", gap: 8 }}>
                    <span style={{ color: GREEN, flex: "none" }}>✓</span>
                    <span><b style={{ color: INK }}>{s.capability}:</b> {s.proves}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11, borderLeft: `4px solid ${GREEN}` }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>The process that keeps it accurate</span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    [p.sampledPerWeek.toLocaleString(), "calls sampled / week"],
                    [`${p.redundancy}+`, "reviewers per call"],
                    [p.hiddenGtPerWeek.toLocaleString(), "hidden expert-rated calls seeded"],
                    [p.panelSize.toLocaleString(), "reviewers on the panel"],
                  ].map(([n, l]) => (
                    <div key={l} style={{ flex: 1, minWidth: 132, background: "#f5f7f9", borderRadius: 10, padding: "11px 13px" }}>
                      <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
                      <div style={{ fontSize: 11, color: MUT, lineHeight: 1.35 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: MUT, lineHeight: 1.55 }}>
                  Every unit is done by <b style={{ color: INK }}>{p.redundancy} independent reviewers</b> and we seed expert-rated calls they cannot spot, so you see the panel&apos;s reliability, not our word for it. Target <b style={{ color: INK }}>{p.reliabilityTarget.interPanel}% agreement between reviewers</b> and <b style={{ color: INK }}>{p.reliabilityTarget.vsGroundTruth}% against ground truth</b>.
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", borderTop: "1px solid #eef2f6", paddingTop: 10, fontSize: 12, color: MUT }}>
                  <span><b className={mono.className} style={{ color: INK }}>{p.reviewerHoursPerWeek.toLocaleString()}</b> reviewer hours / week</span>
                  <span><b className={mono.className} style={{ color: INK }}>₹{p.weeklyCostInr.toLocaleString()}</b> / week</span>
                  <span><b className={mono.className} style={{ color: INK }}>{p.daysToLive} days</b> to first output</span>
                </div>
                <a href="/portal/agents" style={{ height: 44, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginTop: 2 }}>
                  Start this pipeline →
                </a>
                <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>Prefer to wire it from code? <a href="/portal/connect" style={{ color: GREEN }}>Connect via MCP</a></div>
              </div>
            </>
          )}
        </div>

      </div>
    </PortalShell>
  );
}
