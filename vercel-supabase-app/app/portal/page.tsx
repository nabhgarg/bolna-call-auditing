"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import PortalShell from "./shell";

// Overview — answers one question: "how is my AI doing, and what should I
// worry about?" One health headline, top-5 issues with evidence, worst
// agents, one trust line. Detail lives in Agents / Issues / Calibration.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", PURPLE = "#7c5cbf", AMBER = "#b07a15", RED = "#c0392b";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

function Chip({ kind }: { kind: "LLM judge" | "human" | "telemetry" }) {
  const purple = kind !== "human";
  return (
    <span style={{ flex: "none", borderRadius: 999, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: purple ? "#f1ecfa" : "#e7f4ee", color: purple ? PURPLE : GREEN }}>
      {kind}
    </span>
  );
}

export default function Portal() {
  const [dash, setDash] = useState<any>(null);
  const [portal, setPortal] = useState<any>(null);
  const [judge, setJudge] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/portal").then((r) => r.json()),
      fetch("/api/portal/judge").then((r) => r.json()).catch(() => null)
    ]).then(([d, p, j]) => { setDash(d); setPortal(p); setJudge(j); }).catch((e) => setError(String(e)));
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;
  if (!dash || !portal) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>{error || "Computing live metrics…"}</main>;

  const t = dash.trust || {};
  const m = portal.machine || {}; const h = portal.human || {}; const c = portal.corpus || {};
  const out = (judge && judge.outcomes) || {};
  const judged = (judge && judge.judged) || 0;
  const outTotal = Object.values(out as Record<string, number>).reduce((s: number, v: number) => s + v, 0) || 1;
  const donePct = Math.round(((out.completed || 0) / outTotal) * 100);
  const ji = (judge && judge.issue_types) || {};

  // top issues, ranked by calls affected — one vocabulary, five rows
  const issues = [
    { name: "Slow responses (>3s)", calls: m.latency_calls, detail: `${m.latency_turns} slow turns across ${m.latency_calls} calls`, chip: "telemetry" as const, href: "/portal/issues?type=latency" },
    { name: "Barge-ins", calls: m.bargein_calls, detail: `${m.bargein_events} interruptions across ${m.bargein_calls} calls`, chip: "telemetry" as const, href: "/portal/issues?type=bargein" },
    { name: "Language errors", calls: ji.language_error?.calls, detail: sample(ji.language_error), chip: "LLM judge" as const, href: "/portal/agents" },
    { name: "Ignored context", calls: ji.context_not_carried?.calls, detail: sample(ji.context_not_carried), chip: "LLM judge" as const, href: "/portal/agents" },
    { name: "Wrong / missing transcription", calls: null, detail: `${(h.asr_transcription || 0).toLocaleString()} ASR errors found by golden transcription — invisible to any transcript-reading judge`, chip: "human" as const, href: "/portal/issues?type=asr" }
  ].filter((i) => i.calls === null || i.calls > 0).sort((a, b) => (b.calls || 999) - (a.calls || 999)).slice(0, 5);

  function sample(d: any) {
    const e = d && d.examples && d.examples[0];
    return e ? `“${String(e.quote).slice(0, 80)}…”` : "";
  }

  const worst = ((judge && judge.orgs) || [])
    .filter((o: any) => o.calls >= 20)
    .map((o: any) => {
      const tot = Object.values(o.outcomes as Record<string, number>).reduce((s: number, v: number) => s + v, 0) || 1;
      return { ...o, pct: Math.round(((o.outcomes.completed || 0) / tot) * 100) };
    })
    .sort((a: any, b: any) => a.pct - b.pct).slice(0, 3);

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Overview</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div className={instrument.className} style={{ maxWidth: 960, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* 1 — the health headline */}
        <div style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flex: "none" }}>
            <div className={grotesk.className} style={{ fontSize: 40, fontWeight: 600, lineHeight: 1, color: donePct >= 50 ? GREEN : AMBER }}>{donePct}%</div>
            <div style={{ fontSize: 12, color: MUT, marginTop: 4 }}>of calls completed their task</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#eef2f6" }}>
              {out.completed ? <div style={{ width: `${(out.completed / outTotal) * 100}%`, background: GREEN }} /> : null}
              {out.partial ? <div style={{ width: `${(out.partial / outTotal) * 100}%`, background: AMBER }} /> : null}
              {out.failed ? <div style={{ width: `${(out.failed / outTotal) * 100}%`, background: RED }} /> : null}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: MUT, flexWrap: "wrap" }}>
              <span><span style={{ color: GREEN }}>■</span> completed {out.completed || 0}</span>
              <span><span style={{ color: AMBER }}>■</span> partial {out.partial || 0} <span style={{ fontSize: 11 }}>(reached the user, didn&apos;t finish the job)</span></span>
              <span><span style={{ color: RED }}>■</span> failed {out.failed || 0}</span>
              <span style={{ flex: 1 }} />
              <span>{judged.toLocaleString()} calls judged end-to-end · {c.total_calls?.toLocaleString()} in corpus</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* 2 — top issues */}
          <div style={{ ...card, flex: 1.5, minWidth: 0, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <span className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600 }}>What&apos;s going wrong most</span>
              <span style={{ flex: 1 }} />
              <a href="/portal/issues?type=asr" style={{ fontSize: 12, color: GREEN, textDecoration: "none", fontWeight: 600 }}>all evidence →</a>
            </div>
            {issues.map((i, idx) => (
              <a key={i.name} href={i.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid #f0f3f6", textDecoration: "none", color: INK }}>
                <span className={grotesk.className} style={{ width: 18, fontSize: 13, color: MUT, flex: "none" }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{i.name}</span>
                    <Chip kind={i.chip} />
                    {i.calls ? <span style={{ fontSize: 11.5, color: MUT }}>{i.calls} calls affected</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.detail}</div>
                </div>
                <span style={{ color: MUT, fontSize: 12 }}>→</span>
              </a>
            ))}
          </div>

          {/* 3 — agents needing attention */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
                <span className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600 }}>Agents needing attention</span>
                <span style={{ flex: 1 }} />
                <a href="/portal/agents" style={{ fontSize: 12, color: GREEN, textDecoration: "none", fontWeight: 600 }}>all agents →</a>
              </div>
              {worst.map((o: any) => (
                <a key={o.org} href="/portal/agents" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f0f3f6", textDecoration: "none", color: INK }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label || o.org}</div>
                    <div style={{ fontSize: 11, color: MUT }}>{o.calls} calls · {o.frustration_signals} frustration signals</div>
                  </div>
                  <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600, color: o.pct >= 40 ? GREEN : AMBER }}>{o.pct}%</span>
                </a>
              ))}
              <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>% = calls that completed their task</div>
            </div>

            {/* 4 — coverage + trust, one card, plain words */}
            <div style={{ ...card, padding: 16, borderLeft: `3px solid ${GREEN}` }}>
              <div className={grotesk.className} style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Why you can trust this</div>
              <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.65 }}>
                Every call gets telemetry + LLM-judge analysis. What machines can&apos;t hear — transcription truth, pronunciation, tone — goes to a calibrated human panel that agrees with itself <b style={{ color: INK }}>{t.within1 ?? 78}%</b> of the time (±1) and is checked against hidden expert ground truth on every batch.
              </div>
              <a href="/dashboard" style={{ fontSize: 12, color: GREEN, textDecoration: "none", fontWeight: 600 }}>see the calibration numbers →</a>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Live · computed {new Date(portal.generated_at).toLocaleString()} · datasets generated by this program are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>
        </div>
      </div>
    </PortalShell>
  );
}
