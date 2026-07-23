"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";

// Agent dashboard — one-screen master-detail. Agents on the left; clicking one
// shows its full picture: outcomes, issue graph split by who caught it
// (purple = LLM judge, green = human reviewers), evidence quotes, and the
// golden-transcript dataset block. All real data from the judge sweep +
// human reviews (lib/portal-judge.json).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf", AMBER = "#b07a15", RED = "#c0392b";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

const ISSUE_LABEL: Record<string, string> = {
  language_error: "Language errors", context_not_carried: "Ignored context", irrelevant_response: "Irrelevant replies",
  loop_repetition: "Loops / repetition", rule_violation: "Rule violations", input_capture_error: "Input capture", hallucination: "Hallucination", other: "Other"
};

function OutcomeBar({ o }: { o: Record<string, number> }) {
  const total = Object.values(o).reduce((s, v) => s + v, 0) || 1;
  const seg = (k: string, color: string) => (o[k] ? <div key={k} title={`${k}: ${o[k]}`} style={{ width: `${(o[k] / total) * 100}%`, background: color }} /> : null);
  return (
    <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#eef2f6" }}>
      {seg("completed", GREEN)}{seg("partial", AMBER)}{seg("failed", RED)}{seg("unclear", "#93a1ae")}
    </div>
  );
}

function IssueRow({ label, n, max, color, who }: { label: string; n: number; max: number; color: string; who: string }) {
  if (!n) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
      <span style={{ width: 150, flex: "none" }}>{label}</span>
      <div style={{ flex: 1, height: 13, borderRadius: 7, background: "#eef2f6", overflow: "hidden" }}>
        <div style={{ width: `${(n / max) * 100}%`, height: "100%", background: color, borderRadius: 7 }} />
      </div>
      <span className={grotesk.className} style={{ width: 34, textAlign: "right", fontWeight: 600, fontSize: 13 }}>{n}</span>
      <span style={{ width: 52, fontSize: 10, color: MUT }}>{who}</span>
    </div>
  );
}

export default function Agents() {
  const [judge, setJudge] = useState<any>(null);
  const [sel, setSel] = useState(0);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/judge").then((r) => r.json()).then(setJudge).catch((e) => setError(String(e)));
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!judge) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Loading agent dashboard…"}</main>;

  const orgs = (judge.orgs || []).filter((o: any) => o.calls >= 3);
  const o = orgs[Math.min(sel, orgs.length - 1)] || {};
  const total = Object.values((o.outcomes || {}) as Record<string, number>).reduce((s: number, v: number) => s + v, 0) || 1;
  const completedPct = Math.round(((o.outcomes?.completed || 0) / total) * 100);
  const h = o.human || {};
  const llmIssues: Array<{ type: string; count: number }> = o.top_issues || [];
  const maxBar = Math.max(...llmIssues.map((i) => i.count), h.asr_corrections || 0, h.pronunciation || 0, h.tone_low || 0, 1);
  const gd = judge.golden_dataset || {};

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#eef2f6", padding: "4px 11px", fontSize: 12, color: "#4d5a66" }}>Agent dashboard</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}><a href="/portal" style={{ color: MUT }}>Portal</a> · Agents · <a href="/dashboard" style={{ color: MUT }}>Calibration</a></span>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Sidebar: agent list */}
        <div style={{ ...card, width: 230, flex: "none", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, color: MUT, padding: "6px 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Agents · {orgs.length}</div>
          {orgs.map((org: any, i: number) => {
            const t = Object.values((org.outcomes || {}) as Record<string, number>).reduce((s: number, v: number) => s + v, 0) || 1;
            const pct = Math.round(((org.outcomes?.completed || 0) / t) * 100);
            const active = i === Math.min(sel, orgs.length - 1);
            return (
              <button key={org.org} onClick={() => setSel(i)}
                style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", border: "none", cursor: "pointer", borderRadius: 8, padding: "9px 10px", background: active ? "#e7f4ee" : "transparent", color: INK }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.label || org.org}</span>
                <span className={grotesk.className} style={{ fontSize: 12, fontWeight: 600, color: pct >= 40 ? GREEN : AMBER }}>{pct}%</span>
              </button>
            );
          })}
        </div>

        {/* Detail: one screen */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{o.label || o.org}</span>
              <span style={{ fontSize: 12, color: MUT }}>{o.calls} production calls · avg {o.avg_duration_sec ?? "—"}s</span>
              <span style={{ flex: 1 }} />
              <span className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, color: completedPct >= 40 ? GREEN : AMBER }}>{completedPct}%</span>
              <span style={{ fontSize: 11.5, color: MUT }}>completed the task</span>
            </div>
            <OutcomeBar o={o.outcomes || {}} />
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: MUT }}>
              <span><span style={{ color: GREEN }}>■</span> completed {o.outcomes?.completed || 0}</span>
              <span><span style={{ color: AMBER }}>■</span> partial {o.outcomes?.partial || 0}</span>
              <span><span style={{ color: RED }}>■</span> failed {o.outcomes?.failed || 0}</span>
              <span style={{ flex: 1 }} />
              <span>{o.flagged_calls} calls flagged · {o.frustration_signals} frustration signals</span>
            </div>
          </div>

          <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issues on this agent — and who caught them</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: PURPLE }}>● LLM judge</span>
              <span style={{ fontSize: 10.5, color: GREEN }}>● human reviewers</span>
            </div>
            {llmIssues.map((i) => <IssueRow key={i.type} label={ISSUE_LABEL[i.type] || i.type} n={i.count} max={maxBar} color={PURPLE} who="LLM" />)}
            <IssueRow label="ASR corrections" n={h.asr_corrections || 0} max={maxBar} color={GREEN} who="human" />
            <IssueRow label="Pronunciation" n={h.pronunciation || 0} max={maxBar} color={GREEN} who="human" />
            <IssueRow label="Low tone rating" n={h.tone_low || 0} max={maxBar} color={GREEN} who="human" />
            <div style={{ fontSize: 11.5, color: MUT }}>ASR, pronunciation and tone never appear in the transcript the LLM reads — they only surface through trained human ears.</div>
          </div>

          {(o.examples || []).length > 0 && (
            <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Evidence — real moments from real calls</span>
              {(o.examples || []).map((e: any, i: number) => (
                <div key={i} style={{ background: "#f5f7f9", borderRadius: 8, padding: "9px 12px", fontSize: 12.5 }}>
                  <span style={{ color: PURPLE, fontWeight: 600 }}>{ISSUE_LABEL[e.type] || e.type}: </span>
                  <span style={{ color: MUT }}>“{e.quote}” — {e.description}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...card, padding: 16, borderLeft: `3px solid ${GREEN}`, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Golden transcript dataset</div>
              <div style={{ fontSize: 12, color: MUT, marginTop: 3 }}>
                {h.golden_calls || 0} calls from this agent transcribed to expert golden standard — part of a {gd.calls}-call dataset ({gd.segments_verified?.toLocaleString()} segments verified, {gd.asr_corrections?.toLocaleString()} ASR corrections, {gd.dual_transcribed} dual-transcribed) delivered for ASR fine-tuning.
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div className={grotesk.className} style={{ fontSize: 24, fontWeight: 600, color: GREEN }}>{h.golden_calls || 0}</div>
              <div style={{ fontSize: 10.5, color: MUT }}>golden calls</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: MUT }}>
            LLM layer: {judge.judged} calls judged ({judge.model}) · human layer: calibrated panel, agreement published on the <a href="/portal" style={{ color: GREEN }}>portal</a> · judge findings verified against the panel on a sampled basis.
          </div>
        </div>
      </div>
    </div>
  );
}
