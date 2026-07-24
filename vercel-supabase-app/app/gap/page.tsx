"use client";

import React from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import { INK, MUT, GREEN, PURPLE, AMBER } from "../../lib/ui";

// N4 · the gap-map slide for the demo video (beat 2). 16:9, silent read in 5s:
// where production voice calls fail, and which remedy each failure needs.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });


const FAILS: Array<{ label: string; to: string[] }> = [
  { label: "Latency", to: ["judge"] },
  { label: "Barge-in", to: ["judge"] },
  { label: "ASR / transcription", to: ["judge", "data"] },
  { label: "Naturalness", to: ["human"] },
  { label: "Tone", to: ["human"] },
  { label: "Response appropriateness", to: ["human", "judge"] },
  { label: "Pronunciation", to: ["human"] }
];
const BUCKETS: Record<string, { name: string; sub: string; color: string; bg: string }> = {
  human: { name: "Human evals", sub: "naturalness, tone, pronunciation, nuanced issue logging", color: GREEN, bg: "#e7f4ee" },
  judge: { name: "AI as judge", sub: "latency + barge-in from telemetry · repetition, language errors", color: PURPLE, bg: "#f4effd" },
  data: { name: "Data generation", sub: "golden transcripts for ASR fine-tuning", color: AMBER, bg: "#faf3e3" }
};

export default function Gap() {
  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(1180px, 96vw)", aspectRatio: "16/9", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,31,.04)", padding: "clamp(20px,4vw,56px)", display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <div className={grotesk.className} style={{ fontSize: "clamp(20px,2.6vw,34px)", fontWeight: 600, lineHeight: 1.15 }}>
            Where production voice calls fail · and what each failure needs
          </div>
          <div style={{ fontSize: "clamp(11px,1.2vw,14px)", color: MUT, marginTop: 6 }}>
            realloop · evals + data generation for voice AI, delivered by a calibrated reviewer marketplace
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: "clamp(16px,3vw,44px)", alignItems: "stretch" }}>
          <div style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
            {FAILS.map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #e2e8ee", borderRadius: 10, padding: "9px 14px", fontSize: "clamp(12px,1.35vw,16px)" }}>
                <span style={{ flex: 1 }}>{f.label}</span>
                {f.to.map((t) => <span key={t} style={{ width: 10, height: 10, borderRadius: 999, background: BUCKETS[t].color, flex: "none" }} />)}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
            {Object.entries(BUCKETS).map(([k, b]) => (
              <div key={k} style={{ background: b.bg, borderRadius: 12, padding: "clamp(12px,1.6vw,20px)", borderLeft: `5px solid ${b.color}` }}>
                <div className={grotesk.className} style={{ fontSize: "clamp(14px,1.7vw,20px)", fontWeight: 600, color: b.color, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color }} />{b.name}
                </div>
                <div style={{ fontSize: "clamp(11px,1.2vw,14px)", color: MUT, marginTop: 4 }}>{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
