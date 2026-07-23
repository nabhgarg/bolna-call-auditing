"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";

// Agent scorecards (per client org/workspace) — the "we understand how YOUR
// agents break" view. All numbers come from the LLM-judge sweep over the
// telemetry corpus (/api/portal/judge); evidence quotes are verbatim.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf", AMBER = "#b07a15";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

const ISSUE_LABEL: Record<string, string> = {
  language_error: "language errors", context_not_carried: "ignored context", irrelevant_response: "irrelevant replies",
  loop_repetition: "loops / repetition", rule_violation: "rule violations", input_capture_error: "input capture", hallucination: "hallucination", other: "other"
};

function OutcomeBar({ o }: { o: Record<string, number> }) {
  const total = Object.values(o).reduce((s, v) => s + v, 0) || 1;
  const seg = (k: string, color: string) => (o[k] ? <div key={k} title={`${k}: ${o[k]}`} style={{ width: `${(o[k] / total) * 100}%`, background: color }} /> : null);
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#eef2f6" }}>
      {seg("completed", GREEN)}{seg("partial", AMBER)}{seg("failed", "#c0392b")}{seg("unclear", "#93a1ae")}
    </div>
  );
}

export default function Agents() {
  const [judge, setJudge] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/judge").then((r) => r.json()).then(setJudge).catch((e) => setError(String(e)));
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!judge) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Loading agent scorecards…"}</main>;

  const orgs = judge.orgs || [];

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Agent scorecards</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}><a href="/portal" style={{ color: MUT }}>Portal</a> · Agents</span>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: MUT }}>
          {judge.judged} production calls judged end-to-end (LLM layer, {judge.model}) · {judge.flagged_calls} flagged high-severity for human review ·
          outcome legend: <span style={{ color: GREEN }}>■ completed</span> <span style={{ color: AMBER }}>■ partial</span> <span style={{ color: "#c0392b" }}>■ failed</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 14 }}>
          {orgs.map((o: any) => {
            const total = Object.values(o.outcomes as Record<string, number>).reduce((s: number, v: number) => s + v, 0) || 1;
            const completedPct = Math.round(((o.outcomes.completed || 0) / total) * 100);
            return (
              <div key={o.org} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>{o.org}</span>
                  <span style={{ fontSize: 11.5, color: MUT }}>{o.calls} calls · avg {o.avg_duration_sec ?? "—"}s</span>
                  <span style={{ flex: 1 }} />
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600, color: completedPct >= 50 ? GREEN : AMBER }}>{completedPct}%</span>
                  <span style={{ fontSize: 11, color: MUT }}>completed</span>
                </div>
                <OutcomeBar o={o.outcomes} />
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: MUT }}>
                  <span>flagged: <b style={{ color: INK }}>{o.flagged_calls}</b> calls</span>
                  <span>frustration signals: <b style={{ color: INK }}>{o.frustration_signals}</b></span>
                  {o.avg_scores?.relevance && <span>relevance <b style={{ color: INK }}>{o.avg_scores.relevance}</b>/5</span>}
                  {o.avg_scores?.flow && <span>flow <b style={{ color: INK }}>{o.avg_scores.flow}</b>/5</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(o.top_issues || []).map((i: any) => (
                    <span key={i.type} style={{ borderRadius: 999, background: "#f1ecfa", color: PURPLE, fontSize: 11.5, padding: "3px 10px" }}>
                      {ISSUE_LABEL[i.type] || i.type} · {i.count}
                    </span>
                  ))}
                </div>
                {o.example && (
                  <div style={{ background: "#f5f7f9", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
                    <span style={{ color: PURPLE, fontWeight: 600 }}>{ISSUE_LABEL[o.example.type] || o.example.type}: </span>
                    <span style={{ color: MUT }}>“{o.example.quote}” — {o.example.description}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          LLM-judge layer computed {String(judge.generated_at || "").slice(0, 10)} · behavioural issues only — ASR accuracy, pronunciation and tone are human-review layers · judge findings are verified against the calibrated human panel on a sampled basis.
        </div>
      </div>
    </div>
  );
}
