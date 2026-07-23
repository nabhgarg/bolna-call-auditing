"use client";

import React, { useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

// Reviewer-side onboarding + training program (added in design review D5):
// apply → calibration track (rate expert-graded demo calls, live agreement
// meter) → tier gate. "We hire on measured agreement, not interviews."
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", AMBER = "#b07a15";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

const CALIB = [
  { id: 1, len: "1:47", done: true, match: true },
  { id: 2, len: "0:58", done: true, match: true },
  { id: 3, len: "2:12", done: true, match: false },
  { id: 4, len: "1:21", done: true, match: true },
  { id: 5, len: "1:55", done: true, match: true },
  { id: 6, len: "1:03", done: true, match: true },
  { id: 7, len: "2:31", done: true, match: false },
  { id: 8, len: "1:18", done: false, match: false },
  { id: 9, len: "1:44", done: false, match: false },
  { id: 10, len: "2:05", done: false, match: false }
];

export default function Join() {
  const [step, setStep] = useState(1);
  const done = CALIB.filter((c) => c.done);
  const agree = Math.round((done.filter((c) => c.match).length / done.length) * 100);

  const StepDot = ({ n, label }: { n: number; label: string }) => (
    <button onClick={() => setStep(n)} style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
      <span className={grotesk.className} style={{ width: 22, height: 22, borderRadius: 11, background: step >= n ? GREEN : "#e2e8ee", color: step >= n ? "#fff" : MUT, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <span style={{ fontSize: 12.5, fontWeight: step === n ? 600 : 400, color: step === n ? INK : MUT }}>{label}</span>
    </button>
  );

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Become a reviewer</span>
        <span style={{ flex: 1 }} />
        <a href="/marketplace" style={{ fontSize: 12.5, color: MUT, textDecoration: "none" }}>← Marketplace</a>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <h1 className={grotesk.className} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>We hire on measured agreement, not interviews.</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: MUT }}>Three steps from application to your first paid review — most people finish the calibration track in one afternoon, on a phone.</p>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <StepDot n={1} label="Apply" /><StepDot n={2} label="Calibration track" /><StepDot n={3} label="Tier & first work" />
        </div>

        {step === 1 && (
          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600 }}>Apply — 2 minutes, no CV</div>
            {[["Languages you're fluent in", "Hindi, English"], ["Hours per week", "10–15"], ["Do you have headphones + a quiet hour a day?", "Yes"]].map(([q, a]) => (
              <div key={q} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: MUT }}>{q}</span>
                <span style={{ border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, background: "#fafbfc" }}>{a}</span>
              </div>
            ))}
            <button onClick={() => setStep(2)} style={{ marginTop: 4, fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "11px 0", cursor: "pointer" }}>
              Start the calibration track →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600 }}>Calibration track</div>
              <span style={{ fontSize: 11.5, color: MUT }}>listen to real calls our experts already graded — rate them yourself</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: MUT, marginBottom: 4 }}>
                  <span>{done.length}/10 calibration calls</span>
                  <span style={{ color: agree >= 75 ? GREEN : AMBER, fontWeight: 600 }}>{agree}% agreement vs expert ground truth</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#eef2f6", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${(done.length / 10) * 100 * (agree / 100)}%`, background: GREEN }} />
                  <div style={{ width: `${(done.length / 10) * 100 * (1 - agree / 100)}%`, background: AMBER }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CALIB.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, borderTop: "1px solid #f0f3f6", paddingTop: 6 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 13, background: c.done ? (c.match ? "#e7f4ee" : "#fdf3e3") : "#eef2f6", color: c.done ? (c.match ? GREEN : AMBER) : MUT, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                    {c.done ? (c.match ? "✓" : "≈") : "▶"}
                  </span>
                  <span className={mono.className} style={{ fontSize: 12 }}>call {String(c.id).padStart(2, "0")}</span>
                  <span style={{ color: MUT }}>{c.len}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: MUT, fontSize: 11 }}>{c.done ? (c.match ? "matched expert rating" : "off by 1 — explanation shown") : "up next"}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>Miss a rating? You see the expert&apos;s reasoning immediately — the track teaches while it tests.</div>
            <button onClick={() => setStep(3)} style={{ fontWeight: 600, fontSize: 13.5, color: "#fff", background: INK, border: "none", borderRadius: 8, padding: "11px 0", cursor: "pointer" }}>
              Finish track →
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12, borderLeft: `3px solid ${GREEN}` }}>
            <div className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600 }}>Your result</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div className={grotesk.className} style={{ fontSize: 30, fontWeight: 600, color: GREEN }}>{agree}%</div>
                <div style={{ fontSize: 10.5, color: MUT }}>agreement vs GT</div>
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>
                <b>Tier 2 · supervised</b> — you start on panels of 3+ where your ratings are cross-checked. Hold 75%+ agreement across two batches (hidden ground-truth calls included) and you move to <b style={{ color: GREEN }}>Tier 1 · calibrated</b> with solo assignments and higher rates.
              </div>
            </div>
            <div style={{ background: "#f5f7f9", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: MUT }}>
              Your public profile shows only a code (like <span className={mono.className}>RL-26</span>), your languages, review count and measured agreement — never your name.
            </div>
            <a href="/marketplace" style={{ alignSelf: "flex-start", fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, borderRadius: 8, padding: "10px 18px", textDecoration: "none" }}>
              See yourself in the marketplace →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
