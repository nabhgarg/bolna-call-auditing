"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, PURPLE, RED } from "../../lib/ui";
import { isExpert } from "../../lib/role";
import type { OpsPayload, OpsClientDetail, OpsReviewer } from "../../lib/ops-shape";

// The ops console · expert-only.
//
// Calm is the default state: colour appears only where a person is needed.
// Every panel states its freshness, every count states its denominator, and
// anything the feed could not honestly compute renders as "—" with a note
// rather than as a confident number.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const AMBER = "#b07a15";
const AMBER_BAR = "#e0a52a";
const RED_BAR = "#c0393f";
const SLATE = "#c9d4de";
const LINE = "#eef2f6";
const BORDER = "#e2e8ee";
const FAINT = "#96a1ad";

const card: React.CSSProperties = {
  background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
  boxShadow: "0 1px 2px rgba(16,24,31,.04)"
};
const head: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em",
  textTransform: "uppercase", color: "#8b96a2"
};

function Bars({ vals, h = 24, color }: { vals: number[]; h?: number; color?: (v: number, i: number, n: number) => string }) {
  const max = Math.max(1, ...vals);
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: h }}>
      {vals.map((v, i) => (
        <span key={i} style={{
          flex: 1, minWidth: 3, borderRadius: 1.5,
          height: Math.round(3 + (h - 3) * (v / max)),
          background: color ? color(v, i, vals.length) : (i === vals.length - 1 ? MUT : SLATE)
        }} />
      ))}
    </span>
  );
}

function Line({ series, lo, hi, threshold, height = 150 }: {
  series: { label: string; value: number }[]; lo: number; hi: number; threshold?: number; height?: number;
}) {
  const pts = series.filter((s) => s.value > 0);
  if (pts.length < 2) return <div style={{ height, display: "flex", alignItems: "center", color: FAINT, fontSize: 12 }}>Not enough days with data yet.</div>;
  const W = 660, H = height;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const step = W / (pts.length - 1);
  const d = pts.map((p, i) => `${(i * step).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
      <line x1={0} x2={W} y1={y((lo + hi) / 2)} y2={y((lo + hi) / 2)} stroke={LINE} strokeWidth={1} />
      {threshold !== undefined && (
        <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="#d6484f" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
      <polyline points={d} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (
        <circle key={i} cx={i * step} cy={y(p.value)} r={2.5} fill={threshold !== undefined && p.value < threshold ? "#d6484f" : INK} />
      ))}
    </svg>
  );
}

function Sparkline({ dev }: { dev: number[] }) {
  const CW = 120, CH = 30, mid = CH / 2, scale = CH / 2;
  const pts = dev.map((v, i) => `${(i * (CW / (dev.length - 1))).toFixed(1)},${(mid - v * scale).toFixed(1)}`).join(" ");
  const flag = dev.slice(-1)[0] !== undefined && Math.abs(dev.slice(-1)[0]) > 0.5;
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{ width: "100%", height: CH, display: "block" }}>
      <rect x={0} y={mid - 0.5 * scale} width={CW} height={scale} fill={LINE} />
      <line x1={0} x2={CW} y1={mid} y2={mid} stroke={SLATE} strokeWidth={1} />
      <polyline points={pts} fill="none" stroke={flag ? RED_BAR : MUT} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Ops() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<OpsPayload | null>(null);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState<{ view: "home" | "client"; client?: string; tab?: string }>({ view: "home" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [pick, setPick] = useState(0);
  const [weekly, setWeekly] = useState(false);

  useEffect(() => { setAllowed(isExpert()); }, []);
  useEffect(() => {
    if (allowed !== true) return;
    fetch("/api/ops")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
  }, [allowed]);

  const asOf = useMemo(() => data ? new Date(data.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "", [data]);

  if (allowed === false) {
    return (
      <main className={instrument.className} style={{ maxWidth: 520, margin: "90px auto", textAlign: "center", color: MUT }}>
        The ops console is internal. <a href="/?next=/ops" style={{ color: GREEN }}>Sign in</a> with an expert account.
      </main>
    );
  }
  if (allowed === null || (!data && !err)) {
    return <main className={instrument.className} style={{ padding: 44, color: MUT }}>Loading the console…</main>;
  }
  if (err) {
    return <main className={instrument.className} style={{ padding: 44, color: RED }}>Could not load ops data · {err}</main>;
  }
  const d = data as OpsPayload;
  const detail: OpsClientDetail | undefined = level.client ? d.details[level.client] : undefined;
  const donePct = d.totals.assigned ? Math.round((d.totals.done / d.totals.assigned) * 100) : 0;

  const paceColor = (r: OpsReviewer) =>
    r.state === "idle" ? RED_BAR : r.state === "behind" ? AMBER : GREEN;

  return (
    <div className={instrument.className} style={{ background: "#f7f8fa", minHeight: "100vh", color: INK }}>

      {/* top bar */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600, cursor: "pointer" }} onClick={() => setLevel({ view: "home" })}>RealLoop ops</span>
        {level.view === "client" && detail && (
          <>
            <span style={{ fontSize: 12, color: SLATE }}>/</span>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>{detail.name}</span>
          </>
        )}
        <span style={{ fontSize: 12, color: MUT }}>{new Date(d.today).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        <span className={mono.className} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUT }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />live · as of {asOf}
        </span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setModal(true)} style={{ background: GREEN, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "9px 15px", borderRadius: 8, cursor: "pointer" }}>
          Create today&apos;s batch
        </span>
      </div>

      {level.view === "client" && detail && (
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "0 28px", display: "flex", gap: 20 }}>
          {["Quality", "Coverage", "Reliability", "Agents"].map((t) => (
            <span key={t} onClick={() => setLevel({ ...level, tab: t })}
              style={{
                fontSize: 12.5, fontWeight: (level.tab || "Quality") === t ? 600 : 400,
                color: (level.tab || "Quality") === t ? INK : MUT, padding: "10px 0",
                borderBottom: `2px solid ${(level.tab || "Quality") === t ? INK : "transparent"}`, cursor: "pointer"
              }}>{t}</span>
          ))}
        </div>
      )}

      <div style={{ padding: "20px 28px 40px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ---------------- LEVEL 1 ---------------- */}
        {level.view === "home" && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {d.clients.map((c) => (
                <div key={c.key} onClick={() => setLevel({ view: "client", client: c.key, tab: "Quality" })}
                  style={{ ...card, flex: "1 1 260px", minWidth: 0, padding: "15px 17px", display: "flex", flexDirection: "column", gap: 11, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>{c.name}</span>
                    <span style={{ flex: 1 }} />
                    {c.alerts > 0 && (
                      <span className={mono.className} style={{
                        fontSize: 10.5, background: c.alerts > 1 ? "#fdeceb" : "#fdf4e3",
                        color: c.alerts > 1 ? RED_BAR : AMBER, padding: "2px 7px", borderRadius: 20
                      }}>{c.alerts} alert{c.alerts === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {c.useCases.map((u) => (
                      <div key={u.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 4, flex: "none", background: u.ok ? GREEN : AMBER }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                        <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>{u.inFlight} pending</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: c.runwayDays < 1 ? RED_BAR : c.runwayDays < 3 ? AMBER : MUT }}>{c.runway}</div>
                    <div style={{ fontSize: 11, color: MUT, marginTop: 2 }}>{c.runwaySub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* reviewer table */}
              <div style={{ ...card, flex: "1 1 640px", minWidth: 0, overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Open assignment vs actuals</span>
                  <span style={{ fontSize: 12, color: MUT }}>{d.reviewers.length} reviewers with work · of slots assigned</span>
                  <span style={{ flex: 1 }} />
                  <span className={mono.className} style={{ fontSize: 12 }}>{d.totals.done} / {d.totals.assigned} done · {donePct}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
                  <span style={{ width: 130, flex: "none" }}>Reviewer</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Work</span>
                  <span style={{ width: 66, flex: "none", textAlign: "right" }}>Assigned</span>
                  <span style={{ width: 52, flex: "none", textAlign: "right" }}>Done</span>
                  <span style={{ width: 172, flex: "none" }}>Pace</span>
                  <span style={{ width: 88, flex: "none" }}>7-day</span>
                  <span style={{ width: 74, flex: "none", textAlign: "right" }}>Last</span>
                </div>
                {d.reviewers.map((r) => (
                  <div key={r.email} style={{ borderBottom: `1px solid #f2f5f8`, background: expanded === r.email ? "#fbfcfd" : "#fff" }}>
                    <div onClick={() => setExpanded(expanded === r.email ? null : r.email)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", cursor: "pointer" }}>
                      <span style={{ width: 130, flex: "none", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#4b5762", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.useCase}</span>
                      <span className={mono.className} style={{ width: 66, flex: "none", textAlign: "right", fontSize: 12, color: MUT }}>{r.assigned}</span>
                      <span className={mono.className} style={{ width: 52, flex: "none", textAlign: "right", fontSize: 12 }}>{r.done}</span>
                      <span style={{ width: 172, flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, height: 7, borderRadius: 4, background: LINE, overflow: "hidden", display: "flex" }}>
                          <span style={{ width: `${r.pacePct}%`, background: paceColor(r) }} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: paceColor(r), width: 52, flex: "none" }}>{r.state}</span>
                      </span>
                      <span style={{ width: 88, flex: "none" }}><Bars vals={r.spark} /></span>
                      <span className={mono.className} style={{ width: 74, flex: "none", textAlign: "right", fontSize: 11, color: r.idleDays >= 3 ? RED_BAR : MUT }}>{r.last}</span>
                    </div>
                    {expanded === r.email && (
                      <div style={{ padding: "2px 18px 16px 160px", display: "flex", flexDirection: "column", gap: 9 }}>
                        <div style={head}>Day over day · reviews submitted, last 14 days</div>
                        <Bars vals={r.history.map((h) => h.value)} h={52} color={(v) => v === 0 ? "#e6ebf0" : SLATE} />
                        <div style={{ display: "flex", gap: 5 }}>
                          {r.history.map((h) => (
                            <span key={h.label} className={mono.className} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: FAINT }}>{h.label}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: MUT }}>
                          {r.pendingTotal} pending · last submission {r.lastIso ? new Date(r.lastIso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* alerts */}
              <div style={{ ...card, width: 320, flex: "none", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 14.5, fontWeight: 600 }}>Alerts</span>
                  {d.alerts.length > 0 && (
                    <span className={mono.className} style={{ fontSize: 10.5, background: "#fdeceb", color: RED_BAR, padding: "2px 7px", borderRadius: 20 }}>{d.alerts.length}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span className={mono.className} style={{ fontSize: 10.5, color: FAINT }}>{asOf}</span>
                </div>
                {d.alerts.length === 0 ? (
                  <div style={{ padding: "34px 20px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 14, border: `2px solid ${GREEN}`, color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Nothing needs you.</span>
                    <span style={{ fontSize: 12, color: MUT }}>Last checked {asOf} · six checks running, none tripped.</span>
                  </div>
                ) : d.alerts.map((a, i) => (
                  <div key={i} style={{ padding: "13px 16px", borderBottom: `1px solid #f2f5f8`, display: "flex", gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, flex: "none", marginTop: 5, background: a.sev === "red" ? RED_BAR : AMBER_BAR }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.55 }}>{a.text}</span>
                      <span className={mono.className} style={{ display: "block", fontSize: 10.5, color: FAINT, marginTop: 6 }}>{a.when}</span>
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid #f2f5f8`, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.checks.map((k) => (
                    <div key={k.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#8b96a2" }}>
                      <span style={{ width: 5, height: 5, borderRadius: 3, background: k.tripped ? AMBER_BAR : SLATE, flex: "none" }} />
                      <span style={{ flex: 1, minWidth: 0 }}>{k.name}</span>
                      <span className={mono.className} style={{ fontSize: 10.5 }}>{k.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {d.problems.length > 0 && (
              <div style={{ ...card, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={head}>What this console cannot yet tell you</span>
                {d.problems.map((p, i) => (
                  <span key={i} style={{ fontSize: 12, color: MUT, lineHeight: 1.55 }}>· {p}</span>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------------- LEVEL 2 / 3 ---------------- */}
        {level.view === "client" && detail && (level.tab || "Quality") === "Quality" && (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 620px", minWidth: 0, padding: "17px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Quality trend</span>
                  <span style={{ fontSize: 12, color: MUT }}>average vibe of reviews submitted that day · 1–4 scale</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ display: "flex", background: "#f2f5f8", borderRadius: 7, padding: 3 }}>
                    {[["Daily", false], ["Weekly", true]].map(([l, w]) => (
                      <span key={String(l)} onClick={() => setWeekly(w as boolean)}
                        style={{ fontSize: 11.5, fontWeight: 600, background: weekly === w ? "#fff" : "transparent", color: weekly === w ? INK : MUT, borderRadius: 5, padding: "5px 10px", cursor: "pointer" }}>{l}</span>
                    ))}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className={mono.className} style={{ width: 26, flex: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10, color: FAINT, height: 150, textAlign: "right" }}>
                    <span>4.0</span><span>3.4</span><span>2.8</span><span>2.2</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Line series={weekly ? detail.trendWeekly : detail.trendDaily} lo={2.2} hi={4.0} threshold={2.9} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5, color: MUT, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: INK }} />avg vibe</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, borderTop: "2px dashed #d6484f" }} />2.9 needs-work threshold</span>
                </div>
              </div>

              <div style={{ ...card, width: 300, flex: "none", padding: "17px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>This client</span>
                {detail.stats.map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className={mono.className} style={{ fontSize: 19, color: s.tone === "warn" ? AMBER : INK }}>{s.value}</span>
                    <span style={{ fontSize: 11.5, color: MUT, lineHeight: 1.45 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 560px", minWidth: 0, padding: "17px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Low-rated funnel</span>
                  <span style={{ fontSize: 12, color: MUT }}>calls reviewed → rated 1–2 → issue logged, per day</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 9, height: 130 }}>
                  {detail.funnel.map((f, i) => {
                    const max = Math.max(1, ...detail.funnel.map((x) => x.reviewed));
                    const scale = 118 / max;
                    return (
                      <div key={i} style={{ flex: 1, minWidth: 0, position: "relative", height: 130, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                        <div style={{ width: "100%", height: Math.round(f.reviewed * scale), background: LINE, borderRadius: "3px 3px 0 0" }} />
                        <div style={{ position: "absolute", bottom: 0, width: "56%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                          <div style={{ height: Math.round((f.low - f.logged) * scale), background: AMBER_BAR, borderRadius: "3px 3px 0 0" }} />
                          <div style={{ height: Math.round(f.logged * scale), background: RED_BAR }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 9 }}>
                  {detail.funnel.map((f, i) => (
                    <span key={i} className={mono.className} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: FAINT }}>{f.label}</span>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5, color: MUT, borderTop: `1px solid ${LINE}`, paddingTop: 11, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: LINE }} />reviewed</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: RED_BAR }} />1–2, issue logged</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: AMBER_BAR }} />1–2, not yet logged</span>
                  <span style={{ flex: 1 }} />
                  {detail.funnelBacklog.count > 0 && (
                    <span style={{ color: AMBER, fontWeight: 600 }}>{detail.funnelBacklog.count} calls waiting on issue logging · oldest {detail.funnelBacklog.oldestDays} days</span>
                  )}
                </div>
              </div>

              <div style={{ ...card, width: 420, flex: "none", padding: "17px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issue mix</span>
                  <span style={{ fontSize: 12, color: MUT }}>by category, six weeks</span>
                </div>
                {detail.issueMix.map((m) => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 118, flex: "none", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><Bars vals={m.bars} h={26} color={(v, i, n) => i === n - 1 ? (m.deltaPct !== null && m.deltaPct > 0 ? "#d99aa0" : "#9dc4b3") : SLATE} /></span>
                    <span className={mono.className} style={{ width: 52, flex: "none", textAlign: "right", fontSize: 11.5 }}>{m.total.toLocaleString()}</span>
                    <span className={mono.className} style={{ width: 44, flex: "none", textAlign: "right", fontSize: 11, color: m.deltaPct === null ? FAINT : m.deltaPct > 0 ? RED_BAR : GREEN }}>
                      {m.deltaPct === null ? "—" : `${m.deltaPct > 0 ? "▲" : "▼"} ${Math.abs(m.deltaPct)}%`}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, fontSize: 11.5, color: MUT, lineHeight: 1.55 }}>
                  Counts are findings, not calls · transcription dominates because every corrected segment counts once.
                </div>
              </div>
            </div>
          </>
        )}

        {level.view === "client" && detail && level.tab === "Coverage" && (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}` }}>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Coverage per delivery</span>
              <span style={{ fontSize: 12, color: MUT }}>one row per call dump · % of calls received</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
              <span style={{ flex: 1, minWidth: 0 }}>Delivery</span>
              <span style={{ width: 74, flex: "none", textAlign: "right" }}>Calls</span>
              <span style={{ width: 300, flex: "none" }}>Quality · transcript</span>
              <span style={{ width: 90, flex: "none", textAlign: "right" }}>Untouched</span>
            </div>
            {detail.deliveries.map((dl) => (
              <div key={dl.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid #f2f5f8` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dl.name}</span>
                <span className={mono.className} style={{ width: 74, flex: "none", textAlign: "right", fontSize: 11.5 }}>{dl.actual.toLocaleString()}</span>
                <span style={{ width: 300, flex: "none", display: "flex", gap: 12 }}>
                  {dl.work.map((w) => (
                    <span key={w.name} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: 11, color: MUT, flex: 1 }}>{w.name}</span>
                        <span className={mono.className} style={{ fontSize: 11, color: w.pct >= 95 ? GREEN : w.pct >= 60 ? AMBER : RED_BAR }}>{w.pct}%</span>
                      </span>
                      <span style={{ height: 5, borderRadius: 3, background: LINE, overflow: "hidden", display: "flex" }}>
                        <span style={{ width: `${w.pct}%`, background: w.pct >= 95 ? GREEN : w.pct >= 60 ? AMBER : RED_BAR }} />
                      </span>
                    </span>
                  ))}
                </span>
                <span className={mono.className} style={{ width: 90, flex: "none", textAlign: "right", fontSize: 11.5, color: dl.remainder ? AMBER : MUT }}>
                  {dl.remainder === 0 ? "none" : `${dl.remainder} calls`}
                </span>
              </div>
            ))}
            <div style={{ padding: "11px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.55 }}>
              Expected counts are not recorded on import yet, so completeness against what the client says they sent cannot be checked.
            </div>
          </div>
        )}

        {level.view === "client" && detail && level.tab === "Reliability" && (
          <>
            <div style={{ ...card, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Vibe agreement</span>
                <span style={{ fontSize: 12, color: MUT }}>every call rated by two or more reviewers · 1–4 scale</span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {detail.agreement.map((a) => (
                  <div key={a.name} style={{
                    flex: "1 1 220px", minWidth: 0, background: a.tone === "warn" ? "#fdfaf3" : "#fbfcfd",
                    border: `1px solid ${a.tone === "warn" ? "#f0e2c4" : BORDER}`, borderRadius: 11, padding: "15px 17px",
                    display: "flex", flexDirection: "column", gap: 7
                  }}>
                    <span className={mono.className} style={{ fontSize: 28, color: a.tone === "warn" ? AMBER : INK }}>{a.value}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ fontSize: 11.5, color: MUT, lineHeight: 1.55 }}>{a.caption}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 12, color: MUT, lineHeight: 1.6 }}>
                ±1 saturates on a four-point scale — two reviewers who disagree at random still land within 1 much of the time. Watch exact match and alpha; report ±1 only alongside them.
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 520px", minWidth: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Transcription reliability</span>
                  <span style={{ fontSize: 12, color: MUT }}>script-insensitive · same timestamp, same call</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className={mono.className} style={{ width: 30, flex: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 10, color: FAINT, height: 140, textAlign: "right" }}>
                    <span>100%</span><span>67%</span><span>33%</span><span>0%</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Line series={detail.transcription.panel} lo={0} hi={100} height={140} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5, color: MUT, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, background: INK }} />panel pairwise, daily</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 5, background: PURPLE }} />vs expert ground truth</span>
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 11.5, color: AMBER, lineHeight: 1.6 }}>
                  No expert ground truth exists yet — no calibration batch has been run, so the purple series is empty. Until then panel agreement is the only reliability figure, and it cannot tell you whether the panel is collectively wrong.
                </div>
              </div>

              <div style={{ ...card, width: 520, flex: "none", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Per-person calibration</span>
                  <span style={{ fontSize: 12, color: MUT }}>deviation from panel consensus, 7 days</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 12 }}>
                  {detail.calib.map((p) => (
                    <div key={p.name} style={{
                      border: `1px solid ${p.flag ? "#f0cfd1" : LINE}`, background: p.flag ? "#fdf5f5" : "#fbfcfd",
                      borderRadius: 9, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 6
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span className={mono.className} style={{ fontSize: 10.5, color: p.flag ? RED_BAR : MUT }}>{p.value > 0 ? "+" : ""}{p.value.toFixed(1)}</span>
                      </div>
                      <Sparkline dev={p.dev} />
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
                  Grey band is ±0.5, the point where a rescore conversation is worth having.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 420px", minWidth: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Flag and uncodeable rate</span>
                  <span style={{ fontSize: 12, color: MUT }}>weekly · of reviews submitted</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 96 }}>
                  {detail.flagRate.map((f, i) => {
                    const max = Math.max(1, ...detail.flagRate.map((x) => x.pct));
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <span className={mono.className} style={{ fontSize: 11, color: f.pct > 5 ? AMBER : MUT }}>{f.pct}%</span>
                        <span style={{ width: "100%", borderRadius: "3px 3px 0 0", height: Math.round(6 + 62 * (f.pct / max)), background: f.pct > 5 ? AMBER_BAR : SLATE }} />
                        <span className={mono.className} style={{ fontSize: 10, color: FAINT }}>{f.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
                  A rising flag rate is a rubric problem, not a reviewer problem.
                </div>
              </div>

              <div style={{ ...card, width: 520, flex: "none", overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}` }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Resubmissions</span>
                  <span style={{ fontSize: 12, color: MUT }}>of that reviewer&apos;s submitted reviews</span>
                </div>
                {detail.resub.length === 0 && <div style={{ padding: "18px", fontSize: 12, color: MUT }}>No resubmissions recorded.</div>}
                {detail.resub.map((r) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: `1px solid #f2f5f8` }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ width: 120, flex: "none", height: 6, borderRadius: 3, background: LINE, overflow: "hidden", display: "flex" }}>
                      <span style={{ width: `${Math.min(100, r.pct / 14 * 100)}%`, background: r.pct > 8 ? AMBER_BAR : MUT }} />
                    </span>
                    <span className={mono.className} style={{ width: 52, flex: "none", textAlign: "right", fontSize: 11.5, color: r.pct > 8 ? AMBER : MUT }}>{r.pct}%</span>
                    <span className={mono.className} style={{ width: 84, flex: "none", textAlign: "right", fontSize: 11, color: FAINT }}>{r.n}</span>
                  </div>
                ))}
                <div style={{ padding: "11px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.55 }}>
                  Above 8% usually means the call list is ambiguous, not that the reviewer is careless.
                </div>
              </div>
            </div>
          </>
        )}

        {level.view === "client" && detail && level.tab === "Agents" && (
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}` }}>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Agents</span>
              <span style={{ fontSize: 12, color: MUT }}>calls · average vibe · most common finding</span>
            </div>
            {detail.agents.map((g) => (
              <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 18px", borderBottom: `1px solid #f2f5f8` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                <span className={mono.className} style={{ width: 60, flex: "none", textAlign: "right", fontSize: 11.5, color: MUT }}>{g.calls}</span>
                <span className={mono.className} style={{ width: 48, flex: "none", textAlign: "right", fontSize: 12, color: g.score !== null && g.score < 2.9 ? RED_BAR : INK }}>{g.score === null ? "—" : g.score.toFixed(2)}</span>
                <span style={{ width: 180, flex: "none", fontSize: 11.5, color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.topIssue}</span>
              </div>
            ))}
            <div style={{ padding: "11px 18px", fontSize: 11.5, color: MUT }}>Scores under 2.9 in red · agents with 3 or fewer calls omitted.</div>
          </div>
        )}
      </div>

      {/* ---------------- create batch modal ---------------- */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,24,31,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: "100%", background: "#fff", borderRadius: 14, boxShadow: "0 18px 50px rgba(16,24,31,.18)", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Create today&apos;s batch</span>
              <span style={{ flex: 1 }} />
              <span onClick={() => setModal(false)} style={{ fontSize: 16, color: FAINT, cursor: "pointer" }}>×</span>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={head}>Use case</span>
                {d.batchOptions.map((o, i) => (
                  <div key={o.key} onClick={() => setPick(i)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    border: `1px solid ${i === pick ? GREEN : BORDER}`, background: i === pick ? "#f2faf6" : "#fff",
                    borderRadius: 9, padding: "11px 13px", cursor: "pointer"
                  }}>
                    <span style={{ width: 14, height: 14, borderRadius: 8, border: `2px solid ${i === pick ? GREEN : SLATE}`, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 4, background: i === pick ? GREEN : "transparent" }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>{o.name}</span>
                    <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>{o.pool.toLocaleString()} uncovered</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fbfcfd", border: `1px solid ${BORDER}`, borderRadius: 11, padding: "15px 17px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>Computed plan</span>
                  <span style={{ fontSize: 11.5, color: MUT }}>nothing written yet</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 18px" }}>
                  {[["500", "review slots"], ["410", "distinct calls"], ["60", "agreement units (shared)"], ["5 × 100", "reviewers × slots each"]].map(([v, l]) => (
                    <div key={l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className={mono.className} style={{ fontSize: 17 }}>{v}</span>
                      <span style={{ fontSize: 11.5, color: MUT }}>{l}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 12, color: MUT, lineHeight: 1.6 }}>
                  10 calls go to all five reviewers and 5 to each pair, so 500 slots cover 410 distinct calls and yield 60 agreement units.
                </div>
              </div>
              <div style={{ background: "#fdf4e3", border: "1px solid #f0e2c4", borderRadius: 9, padding: "11px 13px", fontSize: 12, color: AMBER, lineHeight: 1.55 }}>
                Batch creation is not wired yet — it writes nothing. Assignment still runs through the agreed endpoint, which lands with the new schema.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1, fontSize: 11.5, color: "#8b96a2", lineHeight: 1.5 }}>Will be logged as <span className={mono.className}>batch.create</span>.</span>
                <span onClick={() => setModal(false)} style={{ fontSize: 12.5, fontWeight: 600, color: MUT, padding: "9px 13px", cursor: "pointer" }}>Cancel</span>
                <span style={{ background: SLATE, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "9px 15px", borderRadius: 8, cursor: "not-allowed" }}>Create 500 slots</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
