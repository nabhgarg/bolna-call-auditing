"use client";

import React, { useEffect, useState } from "react";

// Client-facing analytics dashboard (experts only for now).
// Story order mirrors the pitch: trust -> output analytics -> golden
// transcript -> issues & way forward.

type Dash = any;

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8e5", borderRadius: 12, padding: 18, marginBottom: 16 };
const h2: React.CSSProperties = { fontSize: 15, margin: "0 0 12px", color: "#1f2d28", textTransform: "uppercase", letterSpacing: 0.5 };
const big: React.CSSProperties = { fontSize: 34, fontWeight: 700, color: "#1f7a5c", lineHeight: 1 };
const sub: React.CSSProperties = { fontSize: 12, color: "#5b6b64", marginTop: 4 };

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={big}>{value}</div>
      <div style={sub}>{label}</div>
    </div>
  );
}

function Bar({ pct, color = "#1f7a5c" }: { pct: number; color?: string }) {
  return (
    <div style={{ background: "#eef2f0", borderRadius: 4, height: 8, width: "100%" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, height: 8, borderRadius: 4 }} />
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const role = window.localStorage.getItem("auditReviewerRole") || "";
    setAllowed(role === "expert");
  }, []);

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, [allowed]);

  if (allowed === null) return null;
  if (!allowed) {
    return (
      <main style={{ maxWidth: 640, margin: "80px auto", fontFamily: "system-ui", textAlign: "center", color: "#5b6b64" }}>
        <h1 style={{ color: "#1f2d28" }}>Realloop Analytics</h1>
        <p>This dashboard is available to experts only. Log in on the <a href="/">review app</a> with an expert account first.</p>
      </main>
    );
  }
  if (error) return <main style={{ maxWidth: 640, margin: "80px auto", fontFamily: "system-ui" }}><p>Error: {error}</p></main>;
  if (!data) return <main style={{ maxWidth: 640, margin: "80px auto", fontFamily: "system-ui", color: "#5b6b64" }}><p>Computing live metrics…</p></main>;

  const t = data.trust;
  const th = data.throughput;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px 60px", fontFamily: "system-ui", background: "#f6f8f7" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, color: "#1f2d28", margin: 0 }}>Realloop — Call Quality Report</h1>
        <span style={{ fontSize: 12, color: "#8a988f" }}>live · computed {new Date(data.generated_at).toLocaleString()}</span>
      </div>
      <p style={{ color: "#5b6b64", fontSize: 13, marginTop: 6 }}>
        Human panel + expert calibration over {th.calls_in_batch} production calls. Every number on this page is computed from live review data.
      </p>

      {/* 1. Trust — the headline */}
      <section style={card}>
        <h2 style={h2}>Panel trust — calibrated against expert ground truth</h2>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          <Stat value={`${t.within1}%`} label={`panel agreement within ±1 (n=${t.pairs} scored pairs)`} />
          <Stat value={`${t.exact}%`} label="exact score match" />
          <Stat value={`${t.binary_individual}%`} label="good/bad verdict agreement" />
          <Stat value={t.alpha ?? "—"} label="Krippendorff's alpha (panel)" />
        </div>
        <p style={{ ...sub, marginTop: 14 }}>
          Bad-call detection: panel majority caught {t.detection.caught}/{t.detection.expert_bad} expert-confirmed bad calls with {t.detection.false_alarms} false alarms
          across {t.panel_majority.n} multi-rated calls. Every reviewer is scored against expert ground truth below — drift is visible, coached, and re-measured.
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#5b6b64" }}>
              <th style={{ padding: "6px 4px" }}>Reviewer</th><th>n</th><th>±1 agreement</th><th>exact</th><th>bias</th><th>batch 1 → 2 (±1)</th>
            </tr>
          </thead>
          <tbody>
            {t.per_reviewer.map((r: any) => (
              <tr key={r.name} style={{ borderTop: "1px solid #eef2f0" }}>
                <td style={{ padding: "7px 4px", textTransform: "capitalize" }}>{r.name}</td>
                <td>{r.n}</td>
                <td style={{ width: 180 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar pct={r.within1} /><span>{r.within1}%</span></div></td>
                <td>{r.exact}%</td>
                <td style={{ color: Math.abs(r.mean_delta) > 0.5 ? "#b7791f" : "#5b6b64" }}>{r.mean_delta > 0 ? "+" : ""}{r.mean_delta}</td>
                <td>{r.b1_within1 !== null && r.b2_within1 !== null ? `${r.b1_within1}% → ${r.b2_within1}%` : r.b1_within1 !== null ? `${r.b1_within1}% → …` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 2. Output analytics */}
      <section style={card}>
        <h2 style={h2}>Output analytics — where your agents fail</h2>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap", marginBottom: 14 }}>
          <Stat value={th.expert_scored} label="calls expert-scored" />
          <Stat value={th.issues_logged} label="issues logged (timestamped)" />
          <Stat value={Object.keys(data.errors.issue_counts).length} label="issue categories tracked" />
        </div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", color: "#5b6b64" }}><th style={{ padding: "6px 4px" }}>Agent</th><th>calls scored</th><th>avg score (1–4)</th><th>% bad (1–2)</th></tr></thead>
          <tbody>
            {data.errors.agents.map((a: any) => (
              <tr key={a.agent} style={{ borderTop: "1px solid #eef2f0" }}>
                <td style={{ padding: "7px 4px" }}>{a.agent || "—"}</td>
                <td>{a.calls}</td>
                <td>{a.avg_score}</td>
                <td style={{ width: 180 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar pct={a.pct_bad} color="#c05621" /><span>{a.pct_bad}%</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, fontSize: 13, color: "#5b6b64" }}>
          Issue mix: {Object.entries(data.errors.issue_counts).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}
        </div>
      </section>

      {/* 3. Evidence: worst calls */}
      <section style={card}>
        <h2 style={h2}>Confirmed bad calls — with timestamped evidence</h2>
        {data.errors.worst_calls.map((c: any) => (
          <div key={c.execution_id} style={{ borderTop: "1px solid #eef2f0", padding: "10px 0", fontSize: 13 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <strong style={{ color: c.expert_score === 1 ? "#c53030" : "#c05621" }}>{c.expert_score}★</strong>
              <span>{c.agent}</span>
              <code style={{ color: "#8a988f", fontSize: 11 }}>{c.execution_id.slice(0, 8)}</code>
              <span style={{ color: "#8a988f" }}>{c.issue_count} issues logged</span>
            </div>
            {c.issues.length > 0 && (
              <ul style={{ margin: "6px 0 0 18px", color: "#5b6b64" }}>
                {c.issues.map((i: any, idx: number) => (
                  <li key={idx}>[{i.timestamp || "—"}] {i.type.replace(/_/g, " ")}: {String(i.detail).slice(0, 110)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* 4. Golden transcript */}
      {data.golden && (
        <section style={card}>
          <h2 style={h2}>Golden transcript — human-corrected ASR ground truth</h2>
          <p style={sub}>Call {data.golden.execution_id.slice(0, 8)} · {data.golden.agent} — what the transcript said vs what was actually spoken:</p>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 8 }}>
            <thead><tr style={{ textAlign: "left", color: "#5b6b64" }}><th style={{ padding: "6px 4px" }}>at</th><th>transcript said</th><th>actually spoken</th></tr></thead>
            <tbody>
              {data.golden.corrections.map((c: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #eef2f0" }}>
                  <td style={{ padding: "7px 4px", whiteSpace: "nowrap" }}>{c.timestamp || "—"}</td>
                  <td style={{ color: "#c53030" }}>{String(c.original).slice(0, 90)}</td>
                  <td style={{ color: "#1f7a5c" }}>{String(c.corrected).slice(0, 90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Ops strip */}
      <section style={{ ...card, background: "#1f2d28" }}>
        <h2 style={{ ...h2, color: "#cfe3da" }}>Review operations — live</h2>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          {[
            [th.reviewers_active, "reviewers on panel"],
            [th.reviews_total, "reviews completed"],
            [th.reviews_today, "reviews today"],
            [th.calls_in_batch, "calls in batch"]
          ].map(([v, l]) => (
            <div key={String(l)}>
              <div style={{ ...big, color: "#7bd4ae" }}>{v}</div>
              <div style={{ ...sub, color: "#9fb3a9" }}>{l}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
