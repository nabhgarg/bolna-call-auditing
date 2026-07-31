"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED } from "../../lib/ui";
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

// Paired bars · assigned as the light full bar, done overlaid in colour, so a
// gap between the two is visible per day rather than only in totals.
function PairBars({ stats, h = 26, wide = false }: { stats: { label: string; assigned: number; done: number }[]; h?: number; wide?: boolean }) {
  const max = Math.max(1, ...stats.map((s) => Math.max(s.assigned, s.done)));
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: wide ? 6 : 3, height: h, width: "100%" }}>
      {stats.map((s, i) => {
        const aH = Math.round((h - 2) * (s.assigned / max));
        const dH = Math.round((h - 2) * (s.done / max));
        const over = s.done > 0 && s.assigned === 0;
        return (
          <span key={i} style={{ flex: 1, minWidth: wide ? 10 : 4, position: "relative", height: h, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <span style={{ width: "100%", height: Math.max(s.assigned ? 3 : 0, aH), background: LINE, borderRadius: 2 }} />
            <span style={{ position: "absolute", bottom: 0, width: "62%", height: Math.max(s.done ? 3 : 0, dH), background: over ? SLATE : s.done >= s.assigned ? GREEN : AMBER_BAR, borderRadius: 2 }} />
          </span>
        );
      })}
    </span>
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
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");

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
          {["Vibe", "Issues", "Transcription", "Coverage", "Agents"].map((t) => (
            <span key={t} onClick={() => setLevel({ ...level, tab: t })}
              style={{
                fontSize: 12.5, fontWeight: (level.tab || "Vibe") === t ? 600 : 400,
                color: (level.tab || "Vibe") === t ? INK : MUT, padding: "10px 0",
                borderBottom: `2px solid ${(level.tab || "Vibe") === t ? INK : "transparent"}`, cursor: "pointer"
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
                <div key={c.key} onClick={() => setLevel({ view: "client", client: c.key, tab: "Vibe" })}
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
                {(() => {
                  const cur = (r: OpsReviewer) => {
                    const s = period === "daily" ? r.daily : r.weekly;
                    return s[s.length - 1] || { label: "", assigned: 0, done: 0 };
                  };
                  const totA = d.reviewers.reduce((s, r) => s + cur(r).assigned, 0);
                  const totD = d.reviewers.reduce((s, r) => s + cur(r).done, 0);
                  const bucketLabel = period === "daily" ? "today" : "this week";
                  return (
                    <>
                      <div style={{ padding: "15px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
                        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Assigned vs done</span>
                        <span style={{ fontSize: 12, color: MUT }}>per {period === "daily" ? "day · assigned when the batch landed, done when submitted" : "week · same counts, summed"}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ display: "flex", background: "#f2f5f8", borderRadius: 7, padding: 3 }}>
                          {(["daily", "weekly"] as const).map((p) => (
                            <span key={p} onClick={() => setPeriod(p)}
                              style={{ fontSize: 11.5, fontWeight: 600, background: period === p ? "#fff" : "transparent", color: period === p ? INK : MUT, borderRadius: 5, padding: "5px 10px", cursor: "pointer", textTransform: "capitalize", boxShadow: period === p ? "0 1px 2px rgba(16,24,31,.06)" : "none" }}>{p}</span>
                          ))}
                        </span>
                        <span className={mono.className} style={{ fontSize: 12 }}>{totD} done / {totA} assigned {bucketLabel}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
                        <span style={{ width: 130, flex: "none" }}>Reviewer</span>
                        <span style={{ flex: 1, minWidth: 0 }}>Work</span>
                        <span style={{ width: 74, flex: "none", textAlign: "right" }}>Assigned {period === "daily" ? "today" : "this wk"}</span>
                        <span style={{ width: 62, flex: "none", textAlign: "right" }}>Done</span>
                        <span style={{ width: 52, flex: "none", textAlign: "right" }}>Open</span>
                        <span style={{ width: 150, flex: "none" }}>{period === "daily" ? "14 days" : "8 weeks"} · assigned vs done</span>
                        <span style={{ width: 74, flex: "none", textAlign: "right" }}>Last</span>
                      </div>
                      {d.reviewers.map((r) => {
                        const b = cur(r);
                        const series = period === "daily" ? r.daily : r.weekly;
                        return (
                          <div key={r.email} style={{ borderBottom: `1px solid #f2f5f8`, background: expanded === r.email ? "#fbfcfd" : "#fff" }}>
                            <div onClick={() => setExpanded(expanded === r.email ? null : r.email)}
                              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", cursor: "pointer" }}>
                              <span style={{ width: 130, flex: "none", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#4b5762", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.useCase}</span>
                              <span className={mono.className} style={{ width: 74, flex: "none", textAlign: "right", fontSize: 12, color: MUT }}>{b.assigned}</span>
                              <span className={mono.className} style={{ width: 62, flex: "none", textAlign: "right", fontSize: 12, color: b.done === 0 && b.assigned > 0 ? AMBER : INK }}>{b.done}</span>
                              <span className={mono.className} style={{ width: 52, flex: "none", textAlign: "right", fontSize: 12, color: r.pendingTotal ? paceColor(r) : MUT }}>{r.pendingTotal}</span>
                              <span style={{ width: 150, flex: "none" }}><PairBars stats={series} /></span>
                              <span className={mono.className} style={{ width: 74, flex: "none", textAlign: "right", fontSize: 11, color: r.idleDays >= 3 ? RED_BAR : MUT }}>{r.last}</span>
                            </div>
                            {expanded === r.email && (
                              <div style={{ padding: "2px 18px 16px 160px", display: "flex", flexDirection: "column", gap: 9 }}>
                                <div style={head}>{period === "daily" ? "Last 14 days" : "Last 8 weeks"} · light bar assigned, colour bar done</div>
                                <PairBars stats={series} h={56} wide />
                                <div style={{ display: "flex", gap: 6 }}>
                                  {series.map((s) => (
                                    <span key={s.label} className={mono.className} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: FAINT }}>{s.label}</span>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {series.map((s, i) => (
                                    <span key={i} className={mono.className} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: s.done < s.assigned ? AMBER : MUT }}>{s.done}/{s.assigned}</span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 12, color: MUT }}>
                                  {r.pendingTotal} open across all batches · lifetime {r.done} done of {r.assigned} assigned · last submission {r.lastIso ? new Date(r.lastIso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
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
        {level.view === "client" && detail && (level.tab || "Vibe") === "Vibe" && (
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

            {/* agreement three ways */}
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
            </div>

            {/* ±1 vs GT and vs peers, per reviewer */}
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              {[
                { title: "Within ±1 of ground truth", sub: `expert-scored calls · ${detail.vibeVsGT.gtCalls} GT calls · overall ${detail.vibeVsGT.overall ?? "—"}%`, rows: detail.vibeVsGT.rows },
                { title: "Within ±1 of co-raters", sub: "per reviewer, against every other score on shared calls", rows: detail.vibeVsPeers }
              ].map((blk) => (
                <div key={blk.title} style={{ ...card, flex: "1 1 380px", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap" }}>
                    <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>{blk.title}</span>
                    <span style={{ fontSize: 12, color: MUT }}>{blk.sub}</span>
                  </div>
                  {blk.rows.length === 0 && <div style={{ padding: 18, fontSize: 12, color: MUT }}>No shared calls yet.</div>}
                  {blk.rows.map((r) => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: `1px solid #f2f5f8` }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ width: 150, flex: "none", height: 6, borderRadius: 3, background: LINE, overflow: "hidden", display: "flex" }}>
                        <span style={{ width: `${r.pct ?? 0}%`, background: (r.pct ?? 0) >= 80 ? GREEN : (r.pct ?? 0) >= 60 ? AMBER_BAR : RED_BAR }} />
                      </span>
                      <span className={mono.className} style={{ width: 46, flex: "none", textAlign: "right", fontSize: 12, color: (r.pct ?? 0) >= 80 ? INK : AMBER }}>{r.pct === null ? "—" : `${r.pct}%`}</span>
                      <span className={mono.className} style={{ width: 74, flex: "none", textAlign: "right", fontSize: 10.5, color: FAINT }}>{r.n} scores</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* batch × reviewer done matrix */}
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}` }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Calls done · batch × reviewer</span>
                <span style={{ fontSize: 12, color: MUT }}>done / assigned per person · newest batch first</span>
              </div>
              {detail.vibeMatrix.map((row) => {
                // first names alone collide (two Muskans) · add a surname
                // initial only where needed, so chips stay short but unambiguous
                const firsts = row.per.map((p) => p.name.split(" ")[0]);
                const chip = (p: { name: string }) => {
                  const [first, ...rest] = p.name.split(" ");
                  return firsts.filter((f) => f === first).length > 1 && rest.length
                    ? `${first} ${rest[0][0]}` : first;
                };
                return (
                  <div key={row.batch} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderBottom: `1px solid #f2f5f8`, flexWrap: "wrap" }}>
                    <span style={{ width: 150, flex: "none", display: "flex", flexDirection: "column", gap: 1 }}>
                      <span className={mono.className} style={{ fontSize: 12, fontWeight: 500 }}>{row.batch}</span>
                      <span className={mono.className} style={{ fontSize: 10, color: FAINT }}>assigned {row.assignedOn}</span>
                    </span>
                    <span className={mono.className} style={{ width: 88, flex: "none", fontSize: 11.5, color: row.done >= row.assigned ? GREEN : MUT }}>{row.done}/{row.assigned}</span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {row.per.map((p) => (
                        <span key={p.name} style={{
                          display: "flex", alignItems: "center", gap: 6, borderRadius: 7,
                          border: `1px solid ${p.done >= p.assigned ? "#cfe6db" : "#f0e2c4"}`,
                          background: p.done >= p.assigned ? "#f2faf6" : "#fdfaf3", padding: "3px 9px"
                        }}>
                          <span style={{ fontSize: 11.5 }}>{chip(p)}</span>
                          <span className={mono.className} style={{ fontSize: 10.5, color: p.done >= p.assigned ? GREEN : AMBER }}>{p.done}/{p.assigned}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* per-person calibration */}
            <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Per-person calibration</span>
                <span style={{ fontSize: 12, color: MUT }}>deviation from panel consensus, 7 days · grey band is ±0.5</span>
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

        {level.view === "client" && detail && level.tab === "Issues" && (
          <>
            {/* funnel + pending */}
            <div style={{ ...card, padding: "17px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Low-rated funnel</span>
                <span style={{ fontSize: 12, color: MUT }}>calls reviewed → rated 1–2 → issue logged, per day</span>
                <span style={{ flex: 1 }} />
                <a href="/api/ops/remarks" download style={{ fontSize: 12, fontWeight: 600, color: GREEN, border: `1px solid #cfe6db`, background: "#f2faf6", borderRadius: 7, padding: "6px 12px", textDecoration: "none" }}>
                  ↓ Written remarks (CSV)
                </a>
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
                  <span style={{ color: AMBER, fontWeight: 600 }}>{detail.funnelBacklog.count} calls pending issue logging · oldest {detail.funnelBacklog.oldestDays} days</span>
                )}
              </div>
            </div>

            {/* issues captured trend + mix */}
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 480px", minWidth: 0, padding: "17px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issues captured</span>
                  <span style={{ fontSize: 12, color: MUT }}>findings logged · transcription excluded</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ display: "flex", background: "#f2f5f8", borderRadius: 7, padding: 3 }}>
                    {[["Daily", false], ["Weekly", true]].map(([l, w]) => (
                      <span key={String(l)} onClick={() => setWeekly(w as boolean)}
                        style={{ fontSize: 11.5, fontWeight: 600, background: weekly === w ? "#fff" : "transparent", color: weekly === w ? INK : MUT, borderRadius: 5, padding: "5px 10px", cursor: "pointer" }}>{l}</span>
                    ))}
                  </span>
                </div>
                {(() => {
                  const series = weekly ? detail.issueTrend.weekly : detail.issueTrend.daily;
                  const max = Math.max(1, ...series.map((s) => s.value));
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: weekly ? 14 : 8, height: 110 }}>
                        {series.map((s, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                            <span className={mono.className} style={{ fontSize: 10, color: s.value ? MUT : FAINT }}>{s.value || ""}</span>
                            <span style={{ width: "100%", borderRadius: "3px 3px 0 0", height: Math.max(s.value ? 3 : 1, Math.round(78 * (s.value / max))), background: s.value ? "#9dc4b3" : LINE }} />
                            <span className={mono.className} style={{ fontSize: 9.5, color: FAINT }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ ...card, width: 520, flex: "none", overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", display: "flex", alignItems: "baseline", gap: 10, borderBottom: `1px solid ${LINE}` }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issue mix by day</span>
                  <span style={{ fontSize: 12, color: MUT }}>findings per category · transcription excluded</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
                  <span style={{ width: 44, flex: "none" }}>Day</span>
                  {detail.issueMix.slice(0, 4).map((m) => (
                    <span key={m.name} style={{ flex: 1, minWidth: 0, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name.split(" ")[0]}</span>
                  ))}
                  <span style={{ width: 48, flex: "none", textAlign: "right" }}>Total</span>
                </div>
                {detail.issueTrend.daily.slice().reverse().map((d0, ri) => {
                  const di = detail.issueTrend.daily.length - 1 - ri;
                  const rowTotal = detail.issueMix.reduce((s, m) => s + (m.bars[di] || 0), 0);
                  if (!rowTotal) return null;
                  return (
                    <div key={d0.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 18px", borderBottom: `1px solid #f2f5f8` }}>
                      <span className={mono.className} style={{ width: 44, flex: "none", fontSize: 11.5 }}>{d0.label}</span>
                      {detail.issueMix.slice(0, 4).map((m) => (
                        <span key={m.name} className={mono.className} style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 11.5, color: m.bars[di] ? INK : FAINT }}>{m.bars[di] || "·"}</span>
                      ))}
                      <span className={mono.className} style={{ width: 48, flex: "none", textAlign: "right", fontSize: 11.5, fontWeight: 500 }}>{rowTotal}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#fbfcfd" }}>
                  <span className={mono.className} style={{ width: 44, flex: "none", fontSize: 11, color: MUT }}>14d</span>
                  {detail.issueMix.slice(0, 4).map((m) => (
                    <span key={m.name} className={mono.className} style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 11.5, fontWeight: 500 }}>{m.total.toLocaleString()}</span>
                  ))}
                  <span className={mono.className} style={{ width: 48, flex: "none", textAlign: "right", fontSize: 11.5, fontWeight: 500 }}>{detail.issueMix.reduce((s, m) => s + m.total, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* issue-logging agreement */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { name: "Issue agreement · against the panel", v: detail.issueAgreement.vsPeers, cap: "Same categories flagged on the same call, two panel reviewers · category-set overlap." },
                { name: "Issue agreement · against ground truth", v: detail.issueAgreement.vsGT, cap: "Panel's categories against the expert's on shared calls · pairs where neither logged anything are excluded." }
              ].map((c) => (
                <div key={c.name} style={{ ...card, flex: "1 1 300px", minWidth: 0, padding: "17px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 14.5, fontWeight: 600 }}>{c.name}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className={mono.className} style={{ fontSize: 30, color: c.v.pct === null ? FAINT : c.v.pct >= 60 ? INK : AMBER }}>{c.v.pct === null ? "—" : `${c.v.pct}%`}</span>
                    <span className={mono.className} style={{ fontSize: 11, color: FAINT }}>{c.v.n.toLocaleString()} call-pairs</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: MUT, lineHeight: 1.55 }}>{c.cap}</span>
                </div>
              ))}
            </div>

          </>
        )}

        {level.view === "client" && detail && level.tab === "Transcription" && (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ ...card, flex: "1 1 560px", minWidth: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Panel reliability · against each other</span>
                  <span style={{ fontSize: 12, color: MUT }}>script-insensitive word agreement · same timestamp, same call</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {detail.transcription.panel.map((p) => (
                    <div key={p.label} style={{
                      border: `1px solid ${p.value ? BORDER : LINE}`, borderRadius: 8,
                      background: p.value ? "#fbfcfd" : "#fff",
                      padding: "9px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3
                    }}>
                      <span className={mono.className} style={{ fontSize: 16, color: p.value ? (p.value >= 75 ? INK : AMBER) : FAINT }}>{p.value ? `${p.value}%` : "·"}</span>
                      <span className={mono.className} style={{ fontSize: 9.5, color: FAINT }}>{p.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
                  One number per day, over every segment two or more reviewers both transcribed · a dot means no shared segments that day, not zero. Under 75% shows amber.
                </div>
              </div>

              <div style={{ ...card, width: 380, flex: "none", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Against ground truth</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className={mono.className} style={{ fontSize: 34, color: detail.transcription.gtAgreement === null ? FAINT : INK }}>
                    {detail.transcription.gtAgreement === null ? "—" : `${detail.transcription.gtAgreement}%`}
                  </span>
                  <span style={{ fontSize: 12, color: MUT }}>word agreement with expert transcription</span>
                </div>
                <div style={{ fontSize: 12, color: MUT, lineHeight: 1.6 }}>
                  {detail.transcription.gtAgreement === null
                    ? "No expert transcriptions overlap the panel's yet."
                    : `Measured on ${detail.transcription.gtSegments.toLocaleString()} segment comparisons across ${detail.transcription.gtCalls} calls the experts also transcribed.`}
                </div>
                <div className={mono.className} style={{ fontSize: 11, color: FAINT }}>last expert transcription · {detail.transcription.lastCalibrated}</div>
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12, fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
                  Panel-vs-panel says whether reviewers agree; this says whether they are right. A standing weekly expert batch (~20 calls) keeps it fresh.
                </div>
              </div>
            </div>

            <div style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Golden transcription dataset</div>
                <div style={{ fontSize: 12, color: MUT, marginTop: 4, lineHeight: 1.6 }}>
                  One row per call in the format Abhijit&apos;s file used · call, word counts, ASR original and golden human transcript as timestamped lines, recording link. Expert transcription wins where one exists; otherwise the latest panel pass.
                </div>
              </div>
              <a href="/api/ops/golden" download style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: GREEN, borderRadius: 8, padding: "10px 16px", textDecoration: "none", flex: "none" }}>
                ↓ Download golden dataset (CSV)
              </a>
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
