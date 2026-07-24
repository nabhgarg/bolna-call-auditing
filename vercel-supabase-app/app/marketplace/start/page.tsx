"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, PURPLE, AMBER, RED, card } from "../../../lib/ui";

// Client onboarding wizard · rubric-first (design review D4): the buyer's
// first step is the intelligence (which failures need which detector), not a
// file-upload chore. Every option shown maps to something the service really
// does; the wizard is the "this is a real product" proof for the demo.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });


const STEPS = ["Rubric", "Calls", "Panel", "Launch"];
const RUBRIC: Array<{ failure: string; layer: "telemetry" | "llm" | "human" }> = [
  { failure: "Latency / slow responses", layer: "telemetry" },
  { failure: "Barge-ins / interruptions", layer: "telemetry" },
  { failure: "Loops & repetition", layer: "llm" },
  { failure: "Ignored context", layer: "llm" },
  { failure: "Rule violations", layer: "llm" },
  { failure: "ASR / transcription accuracy", layer: "human" },
  { failure: "Pronunciation", layer: "human" },
  { failure: "Naturalness / tone", layer: "human" },
  { failure: "Response appropriateness", layer: "human" }
];
const LAYER_META = {
  telemetry: { label: "Telemetry", color: PURPLE, note: "deterministic, 100% of calls" },
  llm: { label: "LLM judge", color: PURPLE, note: "reads every transcript" },
  human: { label: "Human ear", color: GREEN, note: "calibrated panel" }
} as const;

export default function StartProgram() {
  const [step, setStep] = useState(0);
  const [layers, setLayers] = useState<Record<string, string>>(Object.fromEntries(RUBRIC.map((r) => [r.failure, r.layer])));
  const [panelSize, setPanelSize] = useState(3);
  const [dual, setDual] = useState(true);
  const [gtPct, setGtPct] = useState(10);
  const [picked, setPicked] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("panel");
    if (p) setPicked(p.split(",").filter(Boolean));
  }, []);

  const Layer = ({ f }: { f: string }) => (
    <div style={{ display: "flex", gap: 6 }}>
      {(Object.keys(LAYER_META) as Array<keyof typeof LAYER_META>).map((k) => {
        const on = layers[f] === k;
        return (
          <button key={k} onClick={() => setLayers((s) => ({ ...s, [f]: k }))}
            style={{ borderRadius: 999, padding: "4px 11px", fontSize: 11.5, fontWeight: on ? 600 : 400, cursor: "pointer", border: `1px solid ${on ? LAYER_META[k].color : "#e2e8ee"}`, background: on ? (k === "human" ? "#e7f4ee" : "#f1ecfa") : "#fff", color: on ? LAYER_META[k].color : MUT }}>
            {LAYER_META[k].label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN, flex: "none" }} />
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 700 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Start a program</span>
        <span style={{ flex: 1 }} />
        <a href="/portal/add" style={{ fontSize: 12.5, color: MUT, textDecoration: "none" }}>← Back to portal</a>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px", display: "flex", gap: 18, alignItems: "flex-start" }}>
        {/* progress rail */}
        <div style={{ width: 170, flex: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)}
              style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: i === step ? "#e7f4ee" : "transparent", borderRadius: 8, padding: "10px 12px", cursor: i < step ? "pointer" : "default", textAlign: "left" }}>
              <span className={grotesk.className} style={{ width: 22, height: 22, borderRadius: 11, background: i < step ? GREEN : i === step ? INK : "#e2e8ee", color: i <= step ? "#fff" : MUT, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {i < step ? "✓" : i + 1}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: i === step ? 600 : 400, color: i === step ? INK : MUT }}>{s}</span>
            </button>
          ))}
        </div>

        {/* step body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {step === 0 && (
            <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>Your rubric · who catches what</div>
              <div style={{ fontSize: 12.5, color: MUT }}>Voice-AI template, prefilled from 2,400+ audited production calls. Every failure type routes to the cheapest detector that can actually catch it. Change any routing.</div>
              {RUBRIC.map((r) => (
                <div key={r.failure} style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid #eef2f6", paddingTop: 9 }}>
                  <span style={{ flex: 1, fontSize: 13.5 }}>{r.failure}</span>
                  <Layer f={r.failure} />
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: MUT }}>
                {Object.values(layers).filter((l) => l === "human").length} failure types routed to the human panel. The rest run on 100% of traffic automatically.
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>Connect your calls</div>
              {!uploaded ? (
                <>
                  <div onClick={() => setUploaded(true)} style={{ border: "1.5px dashed #cfd8e0", borderRadius: 10, padding: "34px 20px", textAlign: "center", color: MUT, fontSize: 13, cursor: "pointer" }}>
                    Drop a CSV of call recordings + transcripts<br />
                    <span style={{ fontSize: 11.5 }}>execution_id · recording_url · transcript · telemetry (optional, unlocks latency &amp; barge-in)</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: MUT }}>Or skip CSV: POST to <span className={mono.className} style={{ fontSize: 11 }}>api.realloop.in/v1/calls</span> with your token.</div>
                </>
              ) : (
                <>
                  <div style={{ border: `1.5px dashed ${GREEN}`, background: "#f2faf6", borderRadius: 10, padding: 12, textAlign: "center", fontSize: 12.5 }}><b>bolna_batch6.csv</b> · 212 rows parsed</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.7fr", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}>
                    {["execution_id", "recording_url", "transcript"].map((h) => <div key={h} style={{ color: MUT, padding: "4px 6px", borderBottom: "1px solid #eef2f6" }}>{h}</div>)}
                    {[["00c9d821", "✓ https://…", "✓", true], ["00d0361c", "✓ https://…", "✓", true], ["01659444", "✗ missing", "✓", false]].map((r, i) => (
                      <React.Fragment key={i}>
                        <div className={mono.className} style={{ padding: "4px 6px", fontSize: 11 }}>{r[0]}</div>
                        <div className={mono.className} style={{ padding: "4px 6px", fontSize: 11, color: r[3] ? GREEN : RED }}>{r[1]}</div>
                        <div className={mono.className} style={{ padding: "4px 6px", fontSize: 11, color: GREEN }}>{r[2]}</div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ background: "#fbeaea", border: `1px solid ${RED}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: RED }}>
                    <b>12 rows missing recording_url</b> · <span style={{ textDecoration: "underline", cursor: "pointer" }}>download error report</span> · they&apos;ll be skipped
                  </div>
                  <button onClick={() => setStep(2)} style={{ alignSelf: "flex-start", fontWeight: 600, fontSize: 13.5, color: "#fff", background: INK, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}>Continue with 200 valid rows →</button>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>Pick your panel</div>
              {picked.length > 0 && (
                <div style={{ background: "#e7f4ee", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: GREEN, fontWeight: 600 }}>From the marketplace:</span>
                  {picked.map((c) => <span key={c} style={{ borderRadius: 999, background: "#fff", border: `1px solid ${GREEN}`, color: GREEN, fontSize: 11.5, fontWeight: 600, padding: "2px 9px" }}>{c}</span>)}
                  <span style={{ fontSize: 11.5, color: MUT }}>· the rest are auto-assigned from calibrated supply</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
                <span style={{ width: 200 }}>Reviewers per call</span>
                {[1, 3, 5].map((n) => (
                  <button key={n} onClick={() => setPanelSize(n)} style={{ borderRadius: 8, border: `1px solid ${panelSize === n ? GREEN : "#e2e8ee"}`, background: panelSize === n ? "#e7f4ee" : "#fff", color: panelSize === n ? GREEN : MUT, padding: "7px 16px", fontWeight: 600, cursor: "pointer" }}>{n}</button>
                ))}
                <span style={{ fontSize: 11.5, color: MUT }}>3+ unlocks panel-median scoring & agreement stats</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
                <span style={{ width: 200 }}>Dual review on transcription</span>
                <button onClick={() => setDual(!dual)} style={{ borderRadius: 999, border: "none", width: 44, height: 24, background: dual ? GREEN : "#cfd8e0", cursor: "pointer", position: "relative" }}>
                  <span style={{ position: "absolute", top: 3, left: dual ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .15s" }} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
                <span style={{ width: 200 }}>Hidden ground-truth insertion</span>
                {[5, 10, 20].map((n) => (
                  <button key={n} onClick={() => setGtPct(n)} style={{ borderRadius: 8, border: `1px solid ${gtPct === n ? GREEN : "#e2e8ee"}`, background: gtPct === n ? "#e7f4ee" : "#fff", color: gtPct === n ? GREEN : MUT, padding: "7px 16px", fontWeight: 600, cursor: "pointer" }}>{n}%</button>
                ))}
                <span style={{ fontSize: 11.5, color: MUT }}>expert-graded calls, invisible to reviewers · keeps agreement honest</span>
              </div>
              <div style={{ fontSize: 11.5, color: MUT, background: "#f5f7f9", borderRadius: 8, padding: "8px 10px" }}>n≥3 per call is what makes the agreement math (and your trust box) possible. 1 reviewer = numbers without error bars.</div>
            </div>
          )}

          {step === 3 && (
            <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>Ready to launch</div>
              {[
                ["Rubric", `${Object.values(layers).filter((l) => l === "human").length} human-routed failure types · rest automated`],
                ["Calls", "connected via CSV / API"],
                ["Panel", `${panelSize} reviewers per call · dual transcription ${dual ? "on" : "off"} · ${gtPct}% hidden ground truth${picked.length ? ` · ${picked.length} hand-picked (${picked.join(", ")})` : ""}`],
                ["Reporting", "live portal · agent scorecards · reliability published every batch"]
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, fontSize: 13, borderTop: "1px solid #eef2f6", paddingTop: 8 }}>
                  <span style={{ width: 110, color: MUT }}>{k}</span><span>{v}</span>
                </div>
              ))}
              <a href="/portal" style={{ marginTop: 6, alignSelf: "flex-start", fontWeight: 600, fontSize: 14, color: "#fff", background: GREEN, borderRadius: 8, padding: "11px 22px", textDecoration: "none" }}>
                Launch program → see your portal
              </a>
            </div>
          )}

          {step < 3 && step !== 1 && (
            <button onClick={() => setStep(step + 1)} style={{ alignSelf: "flex-end", fontWeight: 600, fontSize: 13.5, color: "#fff", background: INK, border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>
              Continue → {STEPS[step + 1]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
