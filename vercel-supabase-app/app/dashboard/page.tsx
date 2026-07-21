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
  const [stale, setStale] = useState(false); // showing last-good after a failed refresh
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    const role = window.localStorage.getItem("auditReviewerRole") || "";
    setAllowed(role === "expert");
    const cached = window.localStorage.getItem("dashLastGood");
    if (cached) {
      try { setData(JSON.parse(cached)); setStale(true); } catch {}
    }
  }, []);

  async function load(code?: string) {
    const email = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
    const accessCode = (code || window.localStorage.getItem("dashAccessCode") || "").trim();
    if (!accessCode) { setNeedCode(true); return; }
    try {
      const r = await fetch("/api/dashboard", {
        headers: { "x-reviewer-email": email, "x-reviewer-code": accessCode }
      });
      if (r.status === 401) {
        window.localStorage.removeItem("dashAccessCode");
        setNeedCode(true);
        return;
      }
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      window.localStorage.setItem("dashAccessCode", accessCode);
      window.localStorage.setItem("dashLastGood", JSON.stringify(d));
      setData(d); setStale(false); setError(""); setNeedCode(false);
    } catch (e) {
      // keep last-good numbers on screen; surface a soft banner instead of dying
      if (data) setStale(true);
      else setError(String((e as Error).message || e));
    }
  }

  useEffect(() => {
    if (!allowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  if (needCode && !data) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui", textAlign: "center" }}>
        <h1 style={{ color: "#1f2d28", fontSize: 20 }}>Realloop Analytics</h1>
        <p style={{ color: "#5b6b64", fontSize: 13 }}>Enter your 6-digit access code to load live metrics.</p>
        <form onSubmit={(e) => { e.preventDefault(); load(codeInput); }} style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} style={{ width: 110, textAlign: "center", fontSize: 18, padding: "6px 8px" }} />
          <button className="primary" type="submit">Unlock</button>
        </form>
      </main>
    );
  }
  if (error && !data) return <main style={{ maxWidth: 640, margin: "80px auto", fontFamily: "system-ui" }}><p>Could not load metrics ({error}). <button onClick={() => load()}>Retry</button></p></main>;
  if (!data) return <main style={{ maxWidth: 640, margin: "80px auto", fontFamily: "system-ui", color: "#5b6b64" }}><p>Computing live metrics…</p></main>;

  const t = data.trust;
  const th = data.throughput;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px 60px", fontFamily: "system-ui", background: "#f6f8f7" }}>
      <style>{`@media print {
        .no-print { display: none !important; }
        main { background: #fff !important; padding: 0 !important; max-width: 100% !important; }
        section { break-inside: avoid; border: none !important; box-shadow: none !important; }
      }`}</style>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, color: "#1f2d28", margin: 0 }}>
          RealLoop — Call Quality Report
          <button
            className="primary no-print"
            style={{ marginLeft: 14, fontSize: 13, verticalAlign: "middle" }}
            onClick={() => window.print()}
            title="Print to PDF — the one-pager clients receive"
          >Download report (PDF)</button>
        </h1>
        <span style={{ fontSize: 12, color: "#8a988f" }}>
          {stale ? <span style={{ color: "#b7791f" }}>showing last-good numbers — refresh failed · <button style={{ fontSize: 12 }} onClick={() => load()}>retry</button> · </span> : "live · "}
          computed {new Date(data.generated_at).toLocaleString()}
        </span>
      </div>
      <p style={{ color: "#5b6b64", fontSize: 13, marginTop: 6 }}>
        Human panel + expert calibration over {th.calls_in_batch} production calls. Every number on this page is computed from live review data.
      </p>

      {/* 1. Trust — radical transparency: we publish our own reliability numbers */}
      <section style={card}>
        <h2 style={h2}>Panel reliability — measured, published, improving</h2>
        <p style={{ ...sub, marginTop: 0, marginBottom: 12 }}>
          Every number here is computed live against expert ground truth. Most eval vendors can't tell you their
          inter-rater reliability — we publish ours, and the calibration curve is the product.
        </p>
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          <Stat value={`${t.detection.caught}/${t.detection.expert_bad}`} label={`expert-confirmed bad calls caught by panel majority (${t.detection.false_alarms} false alarms in ${t.panel_majority.n} calls)`} />
          <Stat value={t.alpha ?? "—"} label="inter-rater alpha — tracked openly, target ≥ 0.6" />
          <Stat value={`${t.within1}%`} label={`agreement within ±1 (n=${t.pairs} pairs)`} />
          <Stat value={`${t.binary_individual}%`} label="good/bad verdict agreement" />
        </div>
        {(() => {
          const trend = t.per_reviewer.filter((r: any) => (r.b2_n || 0) >= 10 && (r.b1_n || 0) >= 5);
          if (!trend.length) return null;
          return (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: "#5b6b64", marginBottom: 8 }}>
                Calibration curve — agreement (±1) vs expert, batch 1 → batch 2 (reviewers with ≥10 batch-2 scored pairs):
              </div>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
                {trend.map((r: any) => (
                  <div key={r.name} style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 90, justifyContent: "center" }}>
                      <div title={`batch 1: ${r.b1_within1}% (n=${r.b1_n})`} style={{ width: 26, height: Math.max(6, r.b1_within1 * 0.9), background: "#c8d6d0", borderRadius: "4px 4px 0 0" }} />
                      <div title={`batch 2: ${r.b2_within1}% (n=${r.b2_n})`} style={{ width: 26, height: Math.max(6, r.b2_within1 * 0.9), background: r.b2_within1 >= r.b1_within1 ? "#1f7a5c" : "#b7791f", borderRadius: "4px 4px 0 0" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#2b3a35", marginTop: 4, textTransform: "capitalize" }}>{r.name.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "#5b6b64" }}>{r.b1_within1}%→{r.b2_within1}%</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <p style={{ ...sub, marginTop: 14 }}>
          Every reviewer is scored against expert ground truth below — drift is visible, coached, and re-measured batch over batch.
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
