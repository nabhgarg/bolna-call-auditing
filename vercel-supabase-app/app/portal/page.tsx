"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";

// Client portal (N1 "money shot") — Console design language from the hi-fi
// wireframes: cool off-white canvas, white 12px-radius cards, Space Grotesk
// numerals, green = human/primary, purple = machine/LLM.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

function Stat({ n, l, green }: { n: React.ReactNode; l: string; green?: boolean }) {
  return (
    <div style={{ ...card, flex: 1, padding: "14px 16px" }}>
      <div className={grotesk.className} style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: green ? GREEN : INK }}>{n}</div>
      <div style={{ fontSize: 11.5, color: MUT, marginTop: 2 }}>{l}</div>
    </div>
  );
}

function BarRow({ label, purple, green, total, note }: { label: string; purple: number; green: number; total: number; note?: string }) {
  const max = Math.max(total, 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ width: 190, flex: "none" }}>{label}{note && <span style={{ color: MUT, fontSize: 10.5 }}> {note}</span>}</span>
      <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#eef2f6" }}>
        <div style={{ width: `${(purple / max) * 100}%`, background: PURPLE }} />
        <div style={{ width: `${(green / max) * 100}%`, background: GREEN }} />
      </div>
      <span className={grotesk.className} style={{ width: 46, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{purple + green}</span>
    </div>
  );
}

export default function Portal() {
  const [dash, setDash] = useState<any>(null);
  const [portal, setPortal] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/portal").then((r) => r.json())
    ]).then(([d, p]) => { setDash(d); setPortal(p); }).catch((e) => setError(String(e)));
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!dash || !portal) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Computing live metrics…"}</main>;

  const t = dash.trust || {}; const th = dash.throughput || {};
  const m = portal.machine || {}; const h = portal.human || {}; const f = portal.funnel || {}; const c = portal.corpus || {};
  const maxRow = Math.max(h.asr_transcription, h.response_appropriateness, h.pronunciation, h.naturalness_tone, m.latency_turns, m.bargein_events, 1);

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Bolna · live</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}>Portal · <a href="/dashboard" style={{ color: MUT }}>Calibration</a></span>
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}>Download report</button>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Stat n={c.total_calls} l="calls in evaluation corpus" />
          <Stat n={`${t.within1 ?? "—"}%`} l={`panel agreement ±1 (n=${t.pairs ?? "—"} pairs)`} />
          <Stat n={<>α {t.alpha ?? "—"} ↗</>} l="panel reliability, rising batch-over-batch" green />
          <Stat n={f.low_rated} l="bad calls flagged for deep review" />
        </div>

        <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Triage — humans only where needed</span>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1.4, background: "#f5f7f9", borderRadius: 8, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>All calls · {c.total_calls}</div>
              <div style={{ fontSize: 11.5, color: MUT }}>telemetry auto-analysis on {c.telemetry_calls}</div>
            </div>
            <div style={{ width: 34, textAlign: "center", color: GREEN }}>→</div>
            <div style={{ flex: 1.1, background: "#e7f4ee", borderRadius: 8, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600, color: GREEN }}>Panel scored · {f.panel_scored}</div>
              <div style={{ fontSize: 11.5, color: MUT }}>vibe 1–4 · n≥3 per call</div>
            </div>
            <div style={{ width: 34, textAlign: "center", color: GREEN }}>→</div>
            <div style={{ flex: 0.9, background: INK, borderRadius: 8, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Rated 1–2★ · {f.low_rated}</div>
              <div style={{ fontSize: 11.5, color: "#93a1ae" }}>→ human issue logging</div>
            </div>
          </div>
        </div>

        <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Who caught what</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: PURPLE }}>● machine (telemetry)</span>
            <span style={{ fontSize: 11, color: GREEN }}>● human reviewers</span>
          </div>
          <BarRow label="ASR / transcription" purple={0} green={h.asr_transcription} total={maxRow} />
          <BarRow label="Response appropriateness" purple={0} green={h.response_appropriateness} total={maxRow} />
          <BarRow label="Pronunciation" purple={0} green={h.pronunciation} total={maxRow} />
          <BarRow label="Naturalness / tone" purple={0} green={h.naturalness_tone} total={maxRow} />
          <BarRow label="Slow responses" note={`>3s (${m.latency_calls} calls)`} purple={m.latency_turns} green={0} total={maxRow} />
          <BarRow label="Barge-ins" note={`(${m.bargein_calls} calls)`} purple={m.bargein_events} green={0} total={maxRow} />
          <div style={{ fontSize: 12.5, color: MUT }}>
            Latency and barge-ins are machine-detectable from telemetry; transcription, appropriateness, pronunciation and naturalness only surface through trained human review — that split is the service.
          </div>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Live · computed {new Date(portal.generated_at).toLocaleString()} · machine metrics from Bolna telemetry ({m.basis_calls} calls, {String(m.computed_at || "").slice(0, 10)}) · human metrics from {th.reviews_total} reviews
        </div>
      </div>
    </div>
  );
}
