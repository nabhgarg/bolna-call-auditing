"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED } from "../../lib/ui";
import { isExpert } from "../../lib/role";
import type { OpsPayload, OpsClientDetail, OpsReviewer } from "../../lib/ops-shape";
import { bodyFor, subjectFor } from "../../lib/weekly-report";

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
  const [level, setLevel] = useState<{ view: "home" | "client" | "weekly" | "assign"; client?: string; tab?: string }>({ view: "home" });
  // Daily assignment
  const [asPool, setAsPool] = useState<any>(null);
  const [asErr, setAsErr] = useState("");
  const [asWork, setAsWork] = useState<"transcription" | "quality_review">("transcription");
  const [asClient, setAsClient] = useState("bolna");
  const [asSheet, setAsSheet] = useState("");
  const [asPick, setAsPick] = useState<Record<string, boolean>>({});
  const [asPerDay, setAsPerDay] = useState(100);
  const [asSplit, setAsSplit] = useState({ distinct: 70, all: 15, pair: 15 });
  const [asBatch, setAsBatch] = useState("");
  const [asPlan, setAsPlan] = useState<any>(null);
  const [asBusy, setAsBusy] = useState(false);
  const [asDone, setAsDone] = useState<any>(null);
  // Panel roster
  const [rosterOpen, setRosterOpen] = useState(false);
  const [roster, setRoster] = useState<any>(null);
  const [rosterMsg, setRosterMsg] = useState<any>(null);
  const [rosterBusy, setRosterBusy] = useState("");
  const [newP, setNewP] = useState({ email: "", name: "", role: "reviewer" });
  const [confirmOff, setConfirmOff] = useState("");
  const [wk, setWk] = useState<any>(null);
  const [wkErr, setWkErr] = useState("");
  const [wkOpen, setWkOpen] = useState<string>("");   // which reviewer's email body is expanded
  const [wkPick, setWkPick] = useState<Record<string, boolean>>({});
  const [wkEdit, setWkEdit] = useState<Record<string, { subject: string; body: string }>>({});
  const [wkSending, setWkSending] = useState(false);
  const [wkResult, setWkResult] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weekly, setWeekly] = useState(false);
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [trPeriod, setTrPeriod] = useState<"daily" | "weekly">("daily");
  const [trRev, setTrRev] = useState<"day" | "week" | "all">("all");

  const [merlin, setMerlin] = useState<any>(null);

  useEffect(() => { setAllowed(isExpert()); }, []);
  useEffect(() => {
    if (allowed !== true) return;
    fetch("/api/ops")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
    fetch("/api/ops/merlin")
      .then((r) => r.json())
      .then(setMerlin)
      .catch(() => setMerlin({ error: "unreachable" }));
  }, [allowed]);

  // Weekly report · fetched only when the tab is opened, and re-fetched when
  // the week changes. Nothing here sends anything.
  function loadWeek(week?: string) {
    setWk(null); setWkErr(""); setWkResult(null); setWkEdit({}); setWkOpen("");
    fetch(`/api/ops/weekly${week ? `?week=${week}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setWkErr(d.error); return; }
        setWk(d);
        const pick: Record<string, boolean> = {};
        (d.rows || []).forEach((r: any) => { pick[r.email] = r.active !== false && r.total > 0; });
        setWkPick(pick);
      })
      .catch((e) => setWkErr(String(e)));
  }
  useEffect(() => { if (allowed === true && level.view === "weekly" && !wk && !wkErr) loadWeek(); }, [allowed, level.view, wk, wkErr]);

  // Assignment · the pool depends on the work type and client, so it is
  // re-read whenever either changes. Nothing here writes.
  useEffect(() => {
    if (allowed !== true || level.view !== "assign") return;
    setAsPool(null); setAsErr(""); setAsPlan(null); setAsDone(null);
    fetch(`/api/ops/assign?work=${asWork}&client=${asClient}${asSheet ? `&sheet=${encodeURIComponent(asSheet)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setAsErr(d.error); return; }
        setAsPool(d);
        setAsSheet(d.sheet || "");
        setAsPick((prev) => Object.keys(prev).length ? prev
          : Object.fromEntries(d.reviewers.map((r: any) => [r.email, true])));
        // Suggest the next tag in the existing series · b10t -> b11t
        const suffix = asWork === "transcription" ? "t" : "v";
        const nums = (d.batches || []).map((b: string) => Number(/^b(\d+)/.exec(b)?.[1] || 0));
        setAsBatch(`b${Math.max(0, ...nums) + 1}${suffix}`);
      })
      .catch((e) => setAsErr(String(e)));
  }, [allowed, level.view, asWork, asClient, asSheet]);

  function loadRoster() {
    setRoster(null);
    fetch("/api/ops/reviewers").then((r) => r.json()).then(setRoster).catch((e) => setRoster({ error: String(e) }));
  }
  useEffect(() => { if (rosterOpen && !roster) loadRoster(); }, [rosterOpen, roster]);

  /** Adding or removing changes who can be assigned, so the pool view is
   *  re-read too · otherwise the picker keeps showing a stale panel. */
  function refreshAfterRoster() {
    loadRoster();
    fetch(`/api/ops/assign?work=${asWork}&client=${asClient}${asSheet ? `&sheet=${encodeURIComponent(asSheet)}` : ""}`)
      .then((r) => r.json()).then((d) => { if (!d.error) { setAsPool(d); setAsPlan(null); } })
      .catch(() => {});
  }

  async function addPerson() {
    setRosterBusy("add"); setRosterMsg(null);
    try {
      const res = await fetch("/api/ops/reviewers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newP)
      });
      const d = await res.json();
      setRosterMsg(d);
      if (!d.error) { setNewP({ email: "", name: "", role: "reviewer" }); refreshAfterRoster(); }
    } catch (e) { setRosterMsg({ error: String(e) }); }
    setRosterBusy("");
  }

  async function setActive(email: string, active: boolean) {
    setRosterBusy(email); setRosterMsg(null); setConfirmOff("");
    try {
      const res = await fetch("/api/ops/reviewers", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, active })
      });
      const d = await res.json();
      setRosterMsg(d);
      if (!d.error) {
        setAsPick((prev) => { const n = { ...prev }; if (!active) delete n[email]; return n; });
        refreshAfterRoster();
      }
    } catch (e) { setRosterMsg({ error: String(e) }); }
    setRosterBusy("");
  }

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
        {level.view === "weekly" && (
          <>
            <span style={{ fontSize: 12, color: SLATE }}>/</span>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Weekly report</span>
          </>
        )}
        {level.view === "assign" && (
          <>
            <span style={{ fontSize: 12, color: SLATE }}>/</span>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Assign today</span>
          </>
        )}
        {level.view === "home" || level.view === "client" ? (
          <>
            <span onClick={() => setLevel({ view: "assign" })} style={{ fontSize: 12.5, fontWeight: 600, color: GREEN, cursor: "pointer" }}>Assign today</span>
            <span onClick={() => setLevel({ view: "weekly" })} style={{ fontSize: 12.5, fontWeight: 600, color: GREEN, cursor: "pointer" }}>Weekly report</span>
          </>
        ) : (
          <span onClick={() => setLevel({ view: "home" })} style={{ fontSize: 12.5, fontWeight: 600, color: GREEN, cursor: "pointer" }}>← back to ops</span>
        )}
        <span style={{ fontSize: 12, color: MUT }}>{new Date(d.today).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        <span className={mono.className} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: MUT }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN }} />live · as of {asOf}
        </span>
        <span style={{ flex: 1 }} />
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

        {/* ---------------- WEEKLY REPORT ---------------- */}
        {level.view === "weekly" && (() => {
          if (wkErr) return <div style={{ ...card, padding: 18, color: RED }}>Could not load the weekly report · {wkErr}</div>;
          if (!wk) return <div style={{ ...card, padding: 18, color: MUT }}>Building last week&apos;s numbers…</div>;
          const chosen = (wk.rows as any[]).filter((r) => wkPick[r.email]);
          const prevWeek = () => { const dd = new Date(wk.weekStart + "T00:00:00Z"); dd.setUTCDate(dd.getUTCDate() - 7); loadWeek(dd.toISOString().slice(0, 10)); };
          const nextWeek = () => { const dd = new Date(wk.weekStart + "T00:00:00Z"); dd.setUTCDate(dd.getUTCDate() + 7); loadWeek(dd.toISOString().slice(0, 10)); };
          const fmtDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
          async function send(dry: boolean) {
            setWkSending(true); setWkResult(null);
            try {
              const r = await fetch("/api/ops/weekly/send", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weekStart: wk.weekStart, weekEnd: wk.weekEnd, rows: chosen, edits: wkEdit, dryRun: dry })
              }).then((x) => x.json());
              setWkResult(r);
            } catch (e) { setWkResult({ error: String(e) }); }
            finally { setWkSending(false); }
          }
          return (
            <>
              <div style={{ ...card, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>
                    {fmtDate(wk.weekStart)} – {fmtDate(wk.weekEnd)}
                  </span>
                  <span style={{ fontSize: 12, color: MUT }}>Monday to Friday · {wk.panel.reviewers} reviewers · {wk.panel.total.toLocaleString()} calls</span>
                </div>
                <span style={{ display: "flex", gap: 4 }}>
                  <button onClick={prevWeek} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>← earlier</button>
                  <button onClick={nextWeek} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>later →</button>
                </span>
                <span style={{ flex: 1 }} />
                <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>
                  {wk.panel.vibe} vibe · {wk.panel.issue} issue · {wk.panel.transcription} transcription
                </span>
              </div>

              <div style={{ ...card, overflow: "hidden" }}>
                <div style={{ padding: "13px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Who gets an email</span>
                  <span style={{ fontSize: 12, color: MUT }}>{chosen.length} selected · click a name to read the exact email</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => send(true)} disabled={wkSending || !chosen.length}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 13px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", color: INK, cursor: chosen.length ? "pointer" : "not-allowed" }}>
                    {wkSending ? "…" : "Dry run"}
                  </button>
                  <button onClick={() => { if (window.confirm(`Send the weekly email to ${chosen.length} reviewer${chosen.length === 1 ? "" : "s"}? This goes to their real inboxes.`)) send(false); }}
                    disabled={wkSending || !chosen.length}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 15px", borderRadius: 8, border: "none", background: chosen.length ? GREEN : SLATE, color: "#fff", cursor: chosen.length ? "pointer" : "not-allowed" }}>
                    Send to {chosen.length}
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
                  <span style={{ width: 26, flex: "none" }} />
                  <span style={{ width: 150, flex: "none" }}>Reviewer</span>
                  <span style={{ width: 60, flex: "none", textAlign: "right" }}>Calls</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Mon–Fri</span>
                  <span style={{ width: 120, flex: "none", textAlign: "right" }}>Agreement</span>
                  <span style={{ width: 90, flex: "none", textAlign: "right" }}>Deviation</span>
                  <span style={{ width: 80, flex: "none", textAlign: "right" }}>Pace</span>
                </div>

                {(wk.rows as any[]).map((r) => {
                  const open = wkOpen === r.email;
                  const max = Math.max(1, ...r.byDay);
                  return (
                    <div key={r.email} style={{ borderBottom: `1px solid #f2f5f8`, background: open ? "#fbfcfd" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px" }}>
                        <input type="checkbox" checked={!!wkPick[r.email]} onChange={(e) => setWkPick({ ...wkPick, [r.email]: e.target.checked })}
                          style={{ width: 26, flex: "none" }} />
                        <span onClick={() => setWkOpen(open ? "" : r.email)}
                          style={{ width: 150, flex: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.name}
                        </span>
                        <span className={mono.className} style={{ width: 60, flex: "none", textAlign: "right", fontSize: 13 }}>{r.total}</span>
                        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 3, height: 24 }}>
                          {r.byDay.map((v: number, i: number) => (
                            <span key={i} title={`${["Mon", "Tue", "Wed", "Thu", "Fri"][i]}: ${v}`}
                              style={{ flex: 1, borderRadius: 2, height: Math.max(2, Math.round(22 * (v / max))), background: v ? GREEN : LINE }} />
                          ))}
                        </span>
                        {/* transcriptionists never score a vibe, so falling back
                            to their word-agreement is the difference between a
                            real number and a blank row for half the panel */}
                        {(() => {
                          const vibeSide = r.agreementPct !== null;
                          const pct = vibeSide ? r.agreementPct : r.transcriptionPct;
                          const n = vibeSide ? r.agreementN : r.transcriptionN;
                          const kind = vibeSide ? "score" : "word";
                          return (
                            <span className={mono.className} title={pct === null ? "Not enough shared work to report" : `${kind}-level agreement across ${n.toLocaleString()} shared ${vibeSide ? "ratings" : "segments"}`}
                              style={{ width: 120, flex: "none", textAlign: "right", fontSize: 11.5, color: pct === null ? FAINT : pct >= 75 ? INK : AMBER }}>
                              {pct === null ? "—" : `${pct}% ${kind}`}
                            </span>
                          );
                        })()}
                        <span className={mono.className} style={{ width: 90, flex: "none", textAlign: "right", fontSize: 11.5, color: r.deviation === null ? FAINT : Math.abs(r.deviation) > 0.5 ? RED_BAR : MUT }}>
                          {r.deviation === null ? "—" : `${r.deviation > 0 ? "+" : ""}${r.deviation.toFixed(2)}`}
                        </span>
                        <span className={mono.className} style={{ width: 80, flex: "none", textAlign: "right", fontSize: 11.5, color: MUT }}>
                          {r.perHour ? `${r.perHour}/hr` : "—"}
                        </span>
                      </div>
                      {open && (() => {
                        const key = String(r.email).toLowerCase();
                        const genSub = subjectFor(r, wk.weekStart, wk.weekEnd);
                        const genBody = bodyFor(r, wk.weekStart, wk.weekEnd);
                        const sub = wkEdit[key]?.subject ?? genSub;
                        const bod = wkEdit[key]?.body ?? genBody;
                        const dirty = sub !== genSub || bod !== genBody;
                        const setEdit = (patch: { subject?: string; body?: string }) =>
                          setWkEdit({ ...wkEdit, [key]: { subject: sub, body: bod, ...patch } });
                        return (
                          <div style={{ padding: "0 18px 16px 56px", display: "flex", flexDirection: "column", gap: 7 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={head}>The email {r.name.split(" ")[0]} receives · editable</span>
                              {dirty && <span className={mono.className} style={{ fontSize: 10, color: AMBER, background: "#fdf4e3", border: "1px solid #f0e2c4", borderRadius: 999, padding: "1px 7px" }}>edited</span>}
                              <span style={{ flex: 1 }} />
                              {dirty && (
                                <button onClick={() => { const n = { ...wkEdit }; delete n[key]; setWkEdit(n); }}
                                  style={{ fontSize: 11.5, color: MUT, background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                  reset to generated
                                </button>
                              )}
                            </div>
                            <div className={mono.className} style={{ fontSize: 11, color: MUT }}>To: {r.email}</div>
                            <input value={sub} onChange={(e) => setEdit({ subject: e.target.value })}
                              className={mono.className}
                              style={{ width: "100%", fontSize: 11.5, padding: "8px 10px", border: `1px solid ${dirty ? "#f0e2c4" : BORDER}`, borderRadius: 8, color: INK, fontFamily: "inherit" }} />
                            <textarea value={bod} onChange={(e) => setEdit({ body: e.target.value })}
                              rows={18} spellCheck
                              className={mono.className}
                              style={{ width: "100%", fontSize: 11.5, lineHeight: 1.65, padding: "12px 14px", border: `1px solid ${dirty ? "#f0e2c4" : BORDER}`, borderRadius: 8, color: INK, resize: "vertical", fontFamily: "inherit" }} />
                            <span style={{ fontSize: 11, color: FAINT }}>
                              Edits are kept until you reload, and are sent verbatim · the numbers are not recomputed at send time.
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                {!wk.rows.length && <div style={{ padding: 18, fontSize: 12.5, color: MUT }}>Nobody submitted anything that week.</div>}
              </div>

              {wkResult && (
                <div style={{ ...card, padding: "14px 18px", borderColor: wkResult.error || wkResult.failed?.length ? "#f0cfd1" : BORDER, background: wkResult.error || wkResult.failed?.length ? "#fdf5f5" : "#fff" }}>
                  {wkResult.error ? (
                    <span style={{ fontSize: 12.5, color: RED_BAR }}>{wkResult.error}</span>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        {wkResult.dryRun
                          ? `Dry run · ${wkResult.attempted} email${wkResult.attempted === 1 ? "" : "s"} rendered, nothing sent`
                          : `Sent ${wkResult.sent} of ${wkResult.attempted}`
                            + (wkResult.skipped ? ` · ${wkResult.skipped} already had this week's report, skipped` : "")}
                      </div>
                      {(wkResult.failed || []).length > 0 && (
                        <div style={{ fontSize: 12, color: RED_BAR, lineHeight: 1.6 }}>
                          {wkResult.failed.map((f: any) => <div key={f.email}>{f.email} · {f.error}</div>)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div style={{ ...card, padding: "14px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.65 }}>
                Agreement and deviation compare only the calls more than one person reviewed, and are shown as &quot;—&quot; below 20 shared ratings rather than computed from too little. Deviation is that reviewer&apos;s average score minus the panel&apos;s on the same calls, leaving them out of the panel figure. The email is plain text and identical to the preview above.
              </div>
            </>
          );
        })()}

        {/* ---------------- ASSIGN TODAY ---------------- */}
        {level.view === "assign" && (() => {
          if (asErr) return <div style={{ ...card, padding: 18, color: RED }}>Could not load the pool · {asErr}</div>;
          if (!asPool) return <div style={{ ...card, padding: 18, color: MUT }}>Reading the free pool…</div>;

          const chosen = (asPool.reviewers as any[]).filter((r) => asPick[r.email]);
          const n = chosen.length;
          const sum = asSplit.distinct + asSplit.all + asSplit.pair;
          const anchorN = Math.round((asPerDay * asSplit.all) / 100);
          const pairQ = Math.round((asPerDay * asSplit.pair) / 100);
          const uniqN = Math.max(0, asPerDay - anchorN - pairQ);
          const pairCalls = n >= 2 ? Math.round((n * pairQ) / 2) : 0;
          const needed = n < 2 ? asPerDay * n : anchorN + pairCalls + uniqN * n;
          const short = needed > asPool.pool.free;
          const ready = n >= 1 && sum === 100 && !!asBatch && !short;

          async function plan(commit: boolean) {
            setAsBusy(true); setAsDone(null);
            if (!commit) setAsPlan(null);
            try {
              const res = await fetch("/api/ops/assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  work: asWork, client: asClient, sheet: asSheet, perDay: asPerDay, split: asSplit,
                  batch: asBatch, reviewers: chosen.map((r) => r.email),
                  commit, assignments: commit ? asPlan?.assignments : undefined
                })
              });
              const d = await res.json();
              if (commit) setAsDone(d); else setAsPlan(d.error ? null : d);
              if (d.error && !commit) setAsDone(d);
            } catch (e) {
              setAsDone({ error: String(e) });
            }
            setAsBusy(false);
          }

          const num: React.CSSProperties = {
            width: 62, fontSize: 12.5, padding: "6px 8px", border: `1px solid ${BORDER}`,
            borderRadius: 7, color: INK, textAlign: "right"
          };
          const chip = (on: boolean): React.CSSProperties => ({
            fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
            background: on ? INK : "#fff", color: on ? "#fff" : MUT, border: `1px solid ${on ? INK : BORDER}`
          });

          return (
            <>
              {/* what we are assigning */}
              <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={head}>Work</span>
                  <span onClick={() => setAsWork("transcription")} style={chip(asWork === "transcription")}>Transcription</span>
                  <span onClick={() => setAsWork("quality_review")} style={chip(asWork === "quality_review")}>Quality review</span>
                  <span style={{ width: 14 }} />
                  <span style={head}>Client</span>
                  {["bolna", "oolka", "all"].map((c) => (
                    <span key={c} onClick={() => setAsClient(c)} style={chip(asClient === c)}>{c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}</span>
                  ))}
                  <span style={{ flex: 1 }} />
                  <span className={mono.className} style={{ fontSize: 11.5, color: short ? RED_BAR : MUT }}>
                    {asPool.pool.free.toLocaleString()} assignable
                    {asPool.pool.released > 0 && ` · ${asPool.pool.released} released back`}
                  </span>
                </div>

                <div style={{ height: 1, background: LINE }} />

                {/* Which import to draw from. Defaults to the newest · assigning
                    across every historical sheet at once is almost never right. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={head}>Source batch</span>
                  <select value={asSheet} onChange={(e) => { setAsSheet(e.target.value); setAsPlan(null); }}
                    style={{ fontSize: 12.5, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, color: INK, background: "#fff", maxWidth: 420 }}>
                    {(asPool.sheets as any[] || []).map((sh) => (
                      <option key={sh.key} value={sh.key}>{sh.key} · {sh.count.toLocaleString()} assignable</option>
                    ))}
                    <option value="__all">Every batch · {(asPool.sheets as any[] || []).reduce((n: number, sh: any) => n + sh.count, 0).toLocaleString()} assignable</option>
                  </select>
                  {(() => {
                    const rj = asPool.pool.rejected || {};
                    const bits = [
                      rj.claimed && `${rj.claimed.toLocaleString()} already assigned`,
                      rj.alreadyDone && `${rj.alreadyDone.toLocaleString()} already done`,
                      rj.noAudio && `${rj.noAudio.toLocaleString()} no audio`,
                      rj.tooShort && `${rj.tooShort.toLocaleString()} under 20s`
                    ].filter(Boolean);
                    return bits.length ? (
                      <span style={{ fontSize: 11.5, color: FAINT }}>Held back: {bits.join(" · ")}</span>
                    ) : null;
                  })()}
                </div>

                <div style={{ height: 1, background: LINE }} />

                <div style={{ display: "flex", alignItems: "flex-end", gap: 26, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={head}>Calls per person</span>
                    <input type="number" min={1} max={500} value={asPerDay} className={mono.className}
                      onChange={(e) => { setAsPerDay(Number(e.target.value) || 0); setAsPlan(null); }} style={num} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={head}>Batch tag</span>
                    <input value={asBatch} className={mono.className}
                      onChange={(e) => { setAsBatch(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")); setAsPlan(null); }}
                      style={{ ...num, width: 88, textAlign: "left" }} />
                  </label>
                  {([["distinct", "Only them"], ["all", "Everyone"], ["pair", "In pairs"]] as const).map(([k, label]) => (
                    <label key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={head}>{label} %</span>
                      <input type="number" min={0} max={100} value={(asSplit as any)[k]} className={mono.className}
                        onChange={(e) => { setAsSplit({ ...asSplit, [k]: Number(e.target.value) || 0 }); setAsPlan(null); }} style={num} />
                    </label>
                  ))}
                  <span className={mono.className} style={{ fontSize: 11.5, color: sum === 100 ? MUT : RED_BAR, paddingBottom: 8 }}>
                    {sum === 100 ? `${uniqN} + ${anchorN} + ${pairQ} = ${asPerDay} each` : `shares add to ${sum}%, not 100%`}
                  </span>
                </div>

                <div style={{ fontSize: 11.5, color: FAINT, lineHeight: 1.65 }}>
                  <b style={{ color: MUT }}>Only them</b> is coverage — nobody else sees the call.
                  <b style={{ color: MUT }}> Everyone</b> is the anchor set, the same {anchorN} calls for all {n || "—"} reviewers; group agreement and alpha are computed on these.
                  <b style={{ color: MUT }}> In pairs</b> gives each person {pairQ} calls shared with exactly two partners in a ring, which is what shows whose reading is drifting rather than just that the group disagrees.
                </div>
              </div>

              {/* who */}
              <div style={{ ...card, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={head}>Reviewers · {n} selected</span>
                  <span style={{ flex: 1 }} />
                  <span onClick={() => { setAsPick(Object.fromEntries(asPool.reviewers.map((r: any) => [r.email, true]))); setAsPlan(null); }}
                    style={{ fontSize: 11.5, color: GREEN, cursor: "pointer", fontWeight: 600 }}>select all</span>
                  <span onClick={() => { setAsPick({}); setAsPlan(null); }}
                    style={{ fontSize: 11.5, color: MUT, cursor: "pointer" }}>none</span>
                  <span onClick={() => setRosterOpen(!rosterOpen)}
                    style={{ fontSize: 11.5, color: rosterOpen ? INK : GREEN, cursor: "pointer", fontWeight: 600 }}>
                    {rosterOpen ? "done editing" : "add / remove people"}
                  </span>
                </div>
                {(asPool.reviewers as any[]).map((r) => (
                  <div key={r.email} onClick={() => { setAsPick({ ...asPick, [r.email]: !asPick[r.email] }); setAsPlan(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderTop: `1px solid ${LINE}`, cursor: "pointer", background: asPick[r.email] ? "#fff" : "#fbfcfd" }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: 4, flex: "none",
                      border: `1.5px solid ${asPick[r.email] ? GREEN : SLATE}`, background: asPick[r.email] ? GREEN : "#fff",
                      color: "#fff", fontSize: 10, lineHeight: "13px", textAlign: "center"
                    }}>{asPick[r.email] ? "✓" : ""}</span>
                    <span style={{ fontSize: 12.5, fontWeight: asPick[r.email] ? 600 : 400, color: asPick[r.email] ? INK : MUT, width: 190 }}>{r.name}</span>
                    <span className={mono.className} style={{ fontSize: 11, color: FAINT, flex: 1 }}>{r.email}</span>
                    <span className={mono.className} title="calls already open in their queue"
                      style={{ fontSize: 11.5, color: r.open > 40 ? AMBER : r.open ? MUT : FAINT }}>
                      {r.open ? `${r.open} still open` : "queue clear"}
                    </span>
                  </div>
                ))}
              </div>

              {/* roster · add and remove people on the panel */}
              {rosterOpen && (
                <div style={{ ...card, overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={head}>The panel</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: FAINT }}>Removing someone never deletes their reviews.</span>
                  </div>

                  {/* add */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${LINE}`, background: "#fbfcfd", flexWrap: "wrap" }}>
                    <input placeholder="Full name" value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })}
                      style={{ fontSize: 12.5, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, width: 180, color: INK }} />
                    <input placeholder="name@realloop.in" value={newP.email} onChange={(e) => setNewP({ ...newP, email: e.target.value })}
                      className={mono.className}
                      style={{ fontSize: 12, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, width: 240, color: INK, fontFamily: "inherit" }} />
                    <select value={newP.role} onChange={(e) => setNewP({ ...newP, role: e.target.value })}
                      style={{ fontSize: 12.5, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, color: INK, background: "#fff" }}>
                      <option value="reviewer">Reviewer</option>
                      <option value="expert">Expert · internal</option>
                      <option value="client">Client · portal only</option>
                      <option value="viewer">Viewer · no call audio</option>
                    </select>
                    <button onClick={addPerson} disabled={rosterBusy === "add" || !newP.email || !newP.name}
                      style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 15px", borderRadius: 8, border: "none", cursor: newP.email && newP.name ? "pointer" : "not-allowed", background: newP.email && newP.name ? GREEN : "#eef1f4", color: newP.email && newP.name ? "#fff" : FAINT }}>
                      {rosterBusy === "add" ? "Adding…" : "Add to panel"}
                    </button>
                  </div>

                  {rosterMsg && (
                    <div style={{ padding: "10px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 12, lineHeight: 1.6, color: rosterMsg.error ? RED_BAR : MUT, background: rosterMsg.error ? "#fdf5f5" : "#fff" }}>
                      {rosterMsg.error || rosterMsg.note || "Done."}
                    </div>
                  )}

                  {!roster && <div style={{ padding: 16, fontSize: 12.5, color: MUT }}>Reading the panel…</div>}
                  {roster?.error && <div style={{ padding: 16, fontSize: 12.5, color: RED }}>{roster.error}</div>}
                  {(roster?.people as any[] || []).map((p) => (
                    <div key={p.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderTop: `1px solid ${LINE}`, opacity: p.active ? 1 : 0.62 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, width: 190, color: p.active ? INK : MUT }}>{p.name}</span>
                      <span className={mono.className} style={{ fontSize: 11, color: FAINT, flex: 1 }}>{p.email}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: MUT, background: "#f2f5f8", borderRadius: 999, padding: "2px 9px" }}>{p.role}</span>
                      <span className={mono.className} title="reviews they have already submitted · kept forever"
                        style={{ width: 110, textAlign: "right", fontSize: 11, color: p.reviews ? MUT : FAINT }}>
                        {p.reviews ? `${p.reviews.toLocaleString()} reviews` : "no reviews"}
                      </span>
                      <span className={mono.className} style={{ width: 74, textAlign: "right", fontSize: 11, color: p.open ? AMBER : FAINT }}>
                        {p.open ? `${p.open} open` : "—"}
                      </span>
                      {p.active ? (
                        confirmOff === p.email ? (
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={() => setActive(p.email, false)} disabled={rosterBusy === p.email}
                              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: 7, border: "none", background: RED_BAR, color: "#fff", cursor: "pointer" }}>
                              {rosterBusy === p.email ? "Removing…" : p.open ? `Remove · free ${p.open}` : "Remove"}
                            </button>
                            <span onClick={() => setConfirmOff("")} style={{ fontSize: 11.5, color: MUT, cursor: "pointer" }}>cancel</span>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmOff(p.email)}
                            style={{ fontSize: 11.5, padding: "5px 11px", borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", color: MUT, cursor: "pointer" }}>
                            Remove
                          </button>
                        )
                      ) : (
                        <button onClick={() => setActive(p.email, true)} disabled={rosterBusy === p.email}
                          style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", color: GREEN, cursor: "pointer" }}>
                          {rosterBusy === p.email ? "…" : "Restore"}
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ padding: "12px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.65, borderTop: `1px solid ${LINE}` }}>
                    Removing blocks the sign-in and puts their unfinished calls back in the pool, so those calls get picked up by the next batch instead of sitting in a queue nobody opens. Everything they already submitted stays in the data and keeps counting towards agreement and the golden set. Restoring switches the sign-in back on · it does not pull the released calls back.
                  </div>
                </div>
              )}

              {/* cost + actions */}
              <div style={{ ...card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <span className={mono.className} style={{ fontSize: 12.5, color: short ? RED_BAR : INK }}>
                  {n} × {asPerDay} = {(n * asPerDay).toLocaleString()} assignments · needs {needed.toLocaleString()} distinct calls of {asPool.pool.free.toLocaleString()} free
                </span>
                {short && <span style={{ fontSize: 12, color: RED_BAR }}>Not enough free calls · lower the per-person count or pick fewer reviewers.</span>}
                <span style={{ flex: 1 }} />
                <button disabled={!ready || asBusy} onClick={() => plan(false)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 8, cursor: ready && !asBusy ? "pointer" : "not-allowed", background: "#fff", color: ready ? INK : FAINT, border: `1px solid ${BORDER}` }}>
                  {asBusy && !asPlan ? "Planning…" : "Preview plan"}
                </button>
                <button disabled={!asPlan || asBusy || !!asDone?.written} onClick={() => plan(true)}
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 8, cursor: asPlan && !asBusy && !asDone?.written ? "pointer" : "not-allowed", background: asPlan && !asDone?.written ? GREEN : "#eef1f4", color: asPlan && !asDone?.written ? "#fff" : FAINT, border: "none" }}>
                  {asBusy && asPlan ? "Assigning…" : `Assign ${asPlan ? asPlan.willWrite.toLocaleString() : ""} calls`}
                </button>
              </div>

              {/* the plan */}
              {asPlan && (
                <div style={{ ...card, overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: `1px solid ${LINE}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={head}>Plan · batch {asPlan.batch} · nothing written yet</span>
                    <span style={{ flex: 1 }} />
                    <span className={mono.className} style={{ fontSize: 11, color: FAINT }}>{asPlan.willWrite.toLocaleString()} queue rows</span>
                  </div>
                  {(asPlan.plan.warnings || []).map((w: string, i: number) => (
                    <div key={i} style={{ padding: "10px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 12, color: AMBER, background: "#fdf9f0" }}>{w}</div>
                  ))}
                  <div style={{ display: "flex", gap: 12, padding: "8px 18px", borderBottom: `1px solid ${LINE}`, ...head }}>
                    <span style={{ flex: 1 }}>Reviewer</span>
                    <span style={{ width: 70, textAlign: "right" }}>Only them</span>
                    <span style={{ width: 70, textAlign: "right" }}>Everyone</span>
                    <span style={{ width: 70, textAlign: "right" }}>Pairs</span>
                    <span style={{ width: 50, textAlign: "right" }}>Total</span>
                    <span style={{ width: 210 }}>Shares with</span>
                  </div>
                  {(asPlan.plan.rows as any[]).map((r) => (
                    <div key={r.email} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 18px", borderBottom: `1px solid ${LINE}` }}>
                      <span style={{ flex: 1, fontSize: 12.5 }}>{r.name}</span>
                      {[r.distinct, r.anchor, r.pair].map((v: number, i: number) => (
                        <span key={i} className={mono.className} style={{ width: 70, textAlign: "right", fontSize: 11.5, color: MUT }}>{v}</span>
                      ))}
                      <span className={mono.className} style={{ width: 50, textAlign: "right", fontSize: 11.5, fontWeight: 600 }}>{r.total}</span>
                      <span style={{ width: 210, fontSize: 11, color: FAINT }}>{(asPlan.plan.pairsWith[r.email] || []).join(", ") || "—"}</span>
                    </div>
                  ))}
                  <div style={{ padding: "12px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.65 }}>
                    Each reviewer&apos;s queue is tagged <span className={mono.className}>{asPlan.plan.rows[0]?.auditMode}</span>. Assigning writes exactly these rows and nothing else · it does not touch anyone&apos;s existing open work.
                  </div>
                </div>
              )}

              {asDone && (
                <div style={{ ...card, padding: "14px 18px", borderColor: asDone.error ? "#f0cfd1" : BORDER, background: asDone.error ? "#fdf5f5" : "#fff" }}>
                  {asDone.error
                    ? <span style={{ fontSize: 12.5, color: RED_BAR }}>{asDone.error}</span>
                    : <span style={{ fontSize: 13, fontWeight: 600 }}>
                        Assigned {asDone.written?.toLocaleString()} calls across {asDone.plan?.rows?.length} reviewers as batch {asDone.batch}. They will see them on their next refresh.
                      </span>}
                </div>
              )}
            </>
          );
        })()}

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

              {/* Merlin router audit · text pairs, not calls. Unblinded here
                  (ops is internal); the public panel at /merlin stays blind. */}
              <div style={{ ...card, flex: "1 1 260px", minWidth: 0, padding: "15px 17px", display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Merlin audit</span>
                  <span className={mono.className} style={{ fontSize: 10.5, background: "#eef6f1", color: GREEN, padding: "2px 7px", borderRadius: 20 }}>pilot</span>
                  <span style={{ flex: 1 }} />
                  <a href="/merlin" target="_blank" style={{ fontSize: 12, fontWeight: 600, color: GREEN, textDecoration: "none" }}>open panel →</a>
                </div>
                {!merlin ? (
                  <div style={{ fontSize: 12.5, color: MUT }}>Loading…</div>
                ) : merlin.error ? (
                  <div style={{ fontSize: 12.5, color: RED_BAR }}>Merlin feed · {merlin.error}</div>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ flex: 1 }}>Blind pairs live</span>
                        <span className={mono.className} style={{ fontSize: 11.5 }}>{merlin.itemsLive}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ flex: 1 }}>Judgments in</span>
                        <span className={mono.className} style={{ fontSize: 11.5 }}>{merlin.judgments}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ flex: 1 }}>Reviewers</span>
                        <span className={mono.className} style={{ fontSize: 11.5 }}>{merlin.reviewers.length}</span>
                      </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 11.5, color: MUT }}>
                        Magic vs premium · <b style={{ color: INK }}>{merlin.merlin.magicWin}W {merlin.merlin.tie}T {merlin.merlin.magicLoss}L</b>
                      </div>
                      <div style={{ fontSize: 11.5, color: MUT }}>
                        Haiku 4.5 vs Sonnet 5 · <b style={{ color: INK }}>{merlin.models.haikuWin}W {merlin.models.tie}T {merlin.models.sonnetWin}L</b>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Coverage</span>
              <span style={{ fontSize: 12, color: MUT }}>per unique call · a review from any past batch counts it done</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px", background: "#fbfcfd", borderBottom: `1px solid ${LINE}`, ...head }}>
              <span style={{ flex: 1, minWidth: 0 }}>Calls</span>
              <span style={{ width: 80, flex: "none", textAlign: "right" }}>Total</span>
              <span style={{ width: 130, flex: "none", textAlign: "right" }}>Vibe scored</span>
              <span style={{ width: 90, flex: "none", textAlign: "right" }}>Rated 1–2</span>
              <span style={{ width: 130, flex: "none", textAlign: "right" }}>Issue logged</span>
              <span style={{ width: 130, flex: "none", textAlign: "right" }}>Transcribed</span>
              <span style={{ width: 110, flex: "none", textAlign: "right" }}>Never reviewed</span>
            </div>
            {detail.deliveries.map((dl) => {
              const cell = (n: number, of: number) => {
                const pct = of ? Math.round((n / of) * 100) : 0;
                return (
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span className={mono.className} style={{ fontSize: 13 }}>{n.toLocaleString()}</span>
                    <span className={mono.className} style={{ fontSize: 10.5, color: pct >= 90 ? GREEN : pct >= 50 ? MUT : AMBER }}>{pct}% of {of.toLocaleString()}</span>
                  </span>
                );
              };
              const [title, sub] = dl.name.split(" · ");
              return (
                <div key={dl.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: `1px solid #f2f5f8` }}>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className={mono.className} style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</span>
                    <span style={{ fontSize: 11, color: FAINT }}>{sub}</span>
                  </span>
                  <span className={mono.className} style={{ width: 80, flex: "none", textAlign: "right", fontSize: 13 }}>{dl.calls.toLocaleString()}</span>
                  <span style={{ width: 130, flex: "none", display: "flex", justifyContent: "flex-end" }}>{cell(dl.vibeScored, dl.calls)}</span>
                  <span className={mono.className} style={{ width: 90, flex: "none", textAlign: "right", fontSize: 13, color: MUT }}>{dl.low.toLocaleString()}</span>
                  <span style={{ width: 130, flex: "none", display: "flex", justifyContent: "flex-end" }}>{cell(dl.issueLogged, dl.low)}</span>
                  <span style={{ width: 130, flex: "none", display: "flex", justifyContent: "flex-end" }}>{cell(dl.transcribed, dl.calls)}</span>
                  <span className={mono.className} style={{ width: 110, flex: "none", textAlign: "right", fontSize: 13, color: dl.neverReviewed ? AMBER : MUT }}>{dl.neverReviewed.toLocaleString()}</span>
                </div>
              );
            })}
            <div style={{ padding: "12px 18px", fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
              Every column is a count of distinct calls. <b>Vibe scored</b> and <b>Transcribed</b> are shares of that group&apos;s total; they overlap, since a call can have both. <b>Issue logged</b> is a share of the calls <b>rated 1–2</b>, not of all calls — those are the ones issue logging is meant to cover. <b>Never reviewed</b> means neither vibe-scored nor transcribed by anyone.
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Panel reliability · against each other</span>
                  <span style={{ fontSize: 12, color: MUT }}>script-insensitive word agreement · same timestamp, same call</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ display: "flex", background: "#f2f5f8", borderRadius: 7, padding: 3 }}>
                    {(["daily", "weekly"] as const).map((p) => (
                      <span key={p} onClick={() => setTrPeriod(p)}
                        style={{ fontSize: 11.5, fontWeight: 600, background: trPeriod === p ? "#fff" : "transparent", color: trPeriod === p ? INK : MUT, borderRadius: 5, padding: "5px 10px", cursor: "pointer", textTransform: "capitalize", boxShadow: trPeriod === p ? "0 1px 2px rgba(16,24,31,.06)" : "none" }}>{p}</span>
                    ))}
                  </span>
                </div>
                {/* the base the headline stands on · a percentage without its
                    denominator is exactly how this tab used to mislead */}
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span className={mono.className} style={{ fontSize: 12.5, color: INK }}>
                    all time {detail.transcription.base.pct === null ? "—" : `${detail.transcription.base.pct}%`}
                    <span style={{ color: FAINT }}> · {detail.transcription.base.segs.toLocaleString()} shared segments on {detail.transcription.base.calls.toLocaleString()} calls</span>
                  </span>
                  <span className={mono.className} style={{ fontSize: 12.5, color: detail.transcription.base.weekPct === null ? FAINT : INK }}>
                    this week {detail.transcription.base.weekPct === null ? "—" : `${detail.transcription.base.weekPct}%`}
                    <span style={{ color: FAINT }}> · {detail.transcription.base.weekSegs.toLocaleString()} segments on {detail.transcription.base.weekCalls.toLocaleString()} calls</span>
                  </span>
                </div>
                {(() => {
                  const daily = trPeriod === "daily";
                  const series = daily ? detail.transcription.panel : detail.transcription.weekly;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${daily ? 7 : 8}, 1fr)`, gap: 8 }}>
                      {series.map((p) => (
                        <div key={p.label} title={p.segs ? `${p.segs} shared segments · ${p.calls} calls` : "no shared segments"} style={{
                          border: `1px solid ${p.value ? BORDER : LINE}`, borderRadius: 8,
                          background: p.value ? "#fbfcfd" : "#fff",
                          padding: "8px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                        }}>
                          <span className={mono.className} style={{ fontSize: daily ? 16 : 14.5, color: p.value ? (p.value >= 75 ? INK : AMBER) : FAINT }}>{p.value ? `${p.value}%` : "·"}</span>
                          <span className={mono.className} style={{ fontSize: 9.5, color: FAINT }}>{daily ? p.label : `wk ${p.label}`}</span>
                          <span className={mono.className} style={{ fontSize: 9, color: p.segs ? MUT : "transparent", textAlign: "center", lineHeight: 1.5 }}>{p.segs ? `${p.segs} seg · ${p.calls} calls` : "·"}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 11, fontSize: 11.5, color: MUT, lineHeight: 1.6 }}>
                  {trPeriod === "daily"
                    ? "Last 14 days · each number is averaged over every segment two or more reviewers both transcribed that day, base printed under it. A dot means no shared segments, not zero. Days only pair same-day work — flip to weekly to also pair reviewers who did the same call on different days. Under 75% shows amber."
                    : "Last 8 weeks · each number pairs every segment two or more reviewers both transcribed inside that week, including on different days — which the daily view structurally cannot see. Base printed under each week. Under 75% shows amber."}
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

            {/* who agrees with the room, and who agrees with the experts ·
                the two questions the tab exists to answer, per person */}
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Reviewer reliability</span>
                <span style={{ fontSize: 12, color: MUT }}>same word agreement, split per person · sorted weakest first</span>
                <span style={{ flex: 1 }} />
                <span style={{ display: "flex", background: "#f2f5f8", borderRadius: 7, padding: 3 }}>
                  {([["day", "Daily"], ["week", "Weekly"], ["all", "All time"]] as const).map(([k, label]) => (
                    <span key={k} onClick={() => setTrRev(k)}
                      style={{ fontSize: 11.5, fontWeight: 600, background: trRev === k ? "#fff" : "transparent", color: trRev === k ? INK : MUT, borderRadius: 5, padding: "5px 10px", cursor: "pointer", boxShadow: trRev === k ? "0 1px 2px rgba(16,24,31,.06)" : "none" }}>{label}</span>
                  ))}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, padding: "8px 20px", borderBottom: `1px solid ${LINE}`, ...head }}>
                <span style={{ flex: 1 }}>Reviewer</span>
                <span style={{ width: 170, textAlign: "right" }}>vs panel · {trRev === "day" ? "today" : trRev === "week" ? "last 7 days" : "all time"}</span>
                <span style={{ width: 170, textAlign: "right" }}>vs ground truth · {trRev === "day" ? "today" : trRev === "week" ? "last 7 days" : "all time"}</span>
              </div>
              {[...detail.transcription.reviewers]
                .sort((a, b) => (a.panel[trRev].pct ?? 101) - (b.panel[trRev].pct ?? 101))
                .map((r) => {
                const cell = (v: { pct: number | null; n: number }, floor: number) => (
                  <span className={mono.className} title={v.n ? `${v.n.toLocaleString()} segment comparisons` : "no shared segments in this window"}
                    style={{ textAlign: "right", fontSize: 12, color: v.pct === null ? FAINT : v.pct >= floor ? INK : AMBER }}>
                    {v.pct === null ? "—" : `${v.pct}%`}<span style={{ color: FAINT, fontSize: 10.5 }}> · {v.n ? v.n.toLocaleString() : "0"}</span>
                  </span>
                );
                return (
                  <div key={r.name} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 20px", borderTop: `1px solid ${LINE}` }}>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{r.name}</span>
                    <span style={{ width: 170, display: "flex", justifyContent: "flex-end" }}>{cell(r.panel[trRev], 75)}</span>
                    <span style={{ width: 170, display: "flex", justifyContent: "flex-end" }}>{cell(r.gt[trRev], 75)}</span>
                  </div>
                );
              })}
              {!detail.transcription.reviewers.length && (
                <div style={{ padding: 18, fontSize: 12.5, color: MUT }}>No reviewer has shared segments yet.</div>
              )}
              <div style={{ padding: "12px 20px", borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: MUT, lineHeight: 1.65 }}>
                vs panel is that reviewer&apos;s word agreement with every co-rater on segments both transcribed, in the window picked above. vs ground truth is the same measure against expert transcriptions only · it says who is right, not just who agrees. The small number is how many segment comparisons the percentage stands on — read a low base as &quot;not enough data&quot;, never as a score.
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

    </div>
  );
}
