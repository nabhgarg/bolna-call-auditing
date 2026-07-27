"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, card } from "../../../lib/ui";
import { isPortalUser } from "../../../lib/role";

// New use case (wireframe 23a/23b) · the client describes the job in plain
// language and we say what we would check, who checks it, and what it costs.
// One screen, one transition: a centered composer (23a) that docks top-left
// once answered (23b). No metric, rubric, schema, weight or threshold appears
// anywhere. Nothing is configured until "Start the 2-week pilot".
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

type Routing = "human" | "judge_human_verified" | "judge";
type Cadence = "recurring" | "one_time";
type Check = {
  id: string; name: string; routing: Routing; because: string; quote?: string | null;
  priceLabel: string; volumeLabel: string; weeklyInr: number; selected?: boolean;
};
type Resolved = {
  facts: { callsPerWeek: number; languages: string[]; docs: { name: string; pages?: number }[] };
  checks: Check[];
  suggestions: { id: string; name: string; priceInr: number }[];
  estimate: { weeklyInr: number; lines: { checkId: string; inr: number }[] };
};

const EXAMPLES = [
  "Our agent completes cart orders on the call in Hindi · it mishears names and addresses, tags orders to COD instead of prepaid, and quotes the wrong discount.",
  "We do EMI reminders. If it tells someone the wrong outstanding amount we have a compliance problem.",
];
const DEFAULT_CALLS = 1240;

const routingPills = (r: Routing) =>
  r === "human" ? [{ t: "100% human", bg: "#e7f4ee", fg: GREEN }]
  : r === "judge" ? [{ t: "machine judge", bg: "#f3eefc", fg: PURPLE }]
  : [{ t: "machine judge", bg: "#f3eefc", fg: PURPLE }, { t: "human verified", bg: "#e7f4ee", fg: GREEN }];
const accent = (r: Routing) => (r === "human" ? GREEN : PURPLE);

// underline the exact phrases the resolver keyed on, in the lane colour ·
// green = humans check this, purple = a machine judge is involved
function HighlightedDesc({ text, checks }: { text: string; checks: Check[] }) {
  const spans: { start: number; end: number; human: boolean }[] = [];
  for (const c of checks) {
    const q = (c.quote || "").trim();
    if (q.length < 6) continue;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) continue;
    const end = i + q.length;
    if (spans.some((s) => i < s.end && end > s.start)) continue;   // no overlaps
    spans.push({ start: i, end, human: c.routing === "human" });
  }
  spans.sort((a, b) => a.start - b.start);
  if (!spans.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((sp, k) => {
    if (sp.start > pos) out.push(<span key={"t" + k}>{text.slice(pos, sp.start)}</span>);
    const col = sp.human ? GREEN : PURPLE;
    out.push(
      <span key={"h" + k} style={{ borderBottom: `2px solid ${col}`, background: sp.human ? "rgba(14,138,95,.07)" : "rgba(124,92,191,.07)", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(sp.start, sp.end)}
      </span>
    );
    pos = sp.end;
  });
  if (pos < text.length) out.push(<span key="tail">{text.slice(pos)}</span>);
  return <>{out}</>;
}

export default function NewUseCase() {
  const [phase, setPhase] = useState<"blank" | "resolving" | "answered">("blank");
  const [desc, setDesc] = useState("");
  const [cadence, setCadence] = useState<Cadence>("recurring");
  // volume is asked, not assumed · it drives every price on this screen
  const [vol, setVol] = useState("");
  const [volUnit, setVolUnit] = useState<"week" | "day">("week");
  const docs: { name: string; pages?: number }[] = [];
  const [res, setRes] = useState<Resolved | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [est, setEst] = useState<{ weeklyInr: number; lines: { checkId: string; inr: number }[]; hours?: number; perHourInr?: number } | null>(null);
  const [changeText, setChangeText] = useState("");
  const [pending, setPending] = useState<{ from: number; to: number; checks: Check[]; ids: string[] } | null>(null);
  const [busyChange, setBusyChange] = useState(false);
  // The plan is one page, scoping it is the next · approving separates "is
  // this the right work" from "how much of it, and what happens then".
  const [step, setStep] = useState<"plan" | "scope">("plan");
  const [started, setStarted] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setAllowed(isPortalUser()); }, []);

  // Volume is asked on the plan, not in the composer · the client sees what we
  // would check first, then tells us how much of it there is.
  //
  // The unit has to apply to whatever number is in force, not only to a typed
  // one. When the field was left empty this used to fall through to the
  // resolver's figure and skip the conversion entirely, so switching between
  // "a week" and "a day" changed nothing on screen.
  const typedVolume = Math.max(0, Math.round(Number(String(vol).replace(/[^\d]/g, "")) || 0));
  const baseVolume = typedVolume > 0 ? typedVolume : (res?.facts.callsPerWeek || DEFAULT_CALLS);
  const perDay = cadence === "recurring" && volUnit === "day";
  const callsPerWeek = perDay ? baseVolume * 7 : baseVolume;
  const canAnalyse = desc.trim().length >= 40;

  // A rough range, shown only after they commit · wide enough to be honest
  // about what we do not know yet, narrow enough to be useful. The exact
  // number comes back with the plan.
  const roundTo = (n: number, to: number) => Math.max(to, Math.round(n / to) * to);
  const mid = est?.weeklyInr ?? 0;
  const roundStep = mid > 60000 ? 5000 : 1000;
  const roughLow = roundTo(mid * 0.85, roundStep);
  const roughHigh = roundTo(mid * 1.15, roundStep);

  // reprice whenever the client changes the volume on the plan
  useEffect(() => {
    if (!res || started) return;
    reprice(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callsPerWeek]);

  async function reprice(ids: string[]) {
    try {
      const d = await fetch("/api/use-cases/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, callsPerWeek }) }).then((r) => r.json());
      setEst(d.estimate);
      // keep each card's "840 calls / wk at a 40% sample" line honest when the
      // client changes the volume
      if (Array.isArray(d.checks)) {
        setRes((prev) => prev ? { ...prev, checks: prev.checks.map((c) => d.checks.find((n: Check) => n.id === c.id) || c) } : prev);
      }
      return d.checks as Check[];
    } catch { return []; }
  }

  async function analyse() {
    if (!canAnalyse) return;
    setPhase("resolving");
    try {
      const d: Resolved = await fetch("/api/use-cases/resolve", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc.trim(), callsPerWeek: DEFAULT_CALLS, docs, cadence }),
      }).then((r) => r.json());
      if (!d?.checks) { setPhase("blank"); return; }
      // seed the field with a real value rather than leaving a placeholder ·
      // an empty box that still prices something reads as broken, and the
      // unit toggle has nothing to act on
      setVol(String(d.facts.callsPerWeek));
      setVolUnit("week");
      setRes(d); setSel(d.checks.map((c) => c.id)); setEst(d.estimate); setStep("plan"); setPhase("answered");
    } catch { setPhase("blank"); }
  }

  async function toggle(id: string) {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next); await reprice(next);
  }

  async function addSuggestion(id: string) {
    if (!res || sel.includes(id)) return;
    const next = [...sel, id];
    setSel(next);
    const priced = await reprice(next);
    const added = priced.find((c) => c.id === id);
    if (added) {
      setRes({
        ...res,
        checks: [...res.checks, { ...added, because: `You added this. ${added.because}` }],
        suggestions: res.suggestions.filter((s) => s.id !== id),
      });
    }
  }

  async function requestChange() {
    const t = changeText.trim();
    if (!t || !res || busyChange) return;
    setBusyChange(true);
    try {
      const d: Resolved = await fetch("/api/use-cases/resolve", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: `${desc.trim()}\n\nChange requested: ${t}`, callsPerWeek, docs, cadence }),
      }).then((r) => r.json());
      if (d?.checks?.length) {
        setPending({ from: est?.weeklyInr ?? 0, to: d.estimate.weeklyInr, checks: d.checks, ids: d.checks.map((c) => c.id) });
      }
    } catch { /* leave the plan untouched */ }
    setBusyChange(false);
  }
  function applyChange() {
    if (!pending || !res) return;
    setRes({ ...res, checks: pending.checks });
    setSel(pending.ids);
    setEst({ weeklyInr: pending.to, lines: pending.checks.map((c) => ({ checkId: c.id, inr: c.weeklyInr })) });
    setPending(null); setChangeText("");
  }

  async function start() {
    setStarted(true);
    try {
      await fetch("/api/use-cases", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc.trim(), facts: { ...res?.facts, cadence, callsPerWeek }, ids: sel, status: "pilot" }),
      });
    } catch { /* the pilot is confirmed on screen either way */ }
  }

  // No expert gate here on purpose. This is the public front door · the
  // landing page's main CTA points straight at it, so it has to work for
  // someone who has never logged in. It shows no client data: only what the
  // visitor types, the catalog we price against, and their own estimate.
  // Every screen that does read a live client's data stays gated.

  const shown = (res?.checks || []).filter((c) => sel.includes(c.id) || true);
  const initial = "N";

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "13px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>New use case</span>
        {phase === "answered" && <span style={{ fontSize: 12.5, color: MUT }}>you describe it · we work out what to measure</span>}
        <span style={{ flex: 1 }} />
        {phase === "answered" && (
          <button onClick={() => { setPhase("blank"); setRes(null); setEst(null); setSel([]); setStarted(false); setStep("plan"); }}
            style={{ fontSize: 12.5, color: "#4d5a66", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "6px 13px", cursor: "pointer", fontFamily: "inherit" }}>Start over</button>
        )}
        {/* an existing client landing here from the website needs a way into
            their own program · signed-in experts already have the full nav */}
        {allowed === false && (
          <a href="/portal/login?next=/portal/agents" style={{ fontSize: 12.5, fontWeight: 600, color: GREEN, textDecoration: "none", padding: "6px 4px" }}>
            Already a client? Log in →
          </a>
        )}
      </div>
    }>
      <div className={instrument.className} style={{ color: INK, padding: phase === "answered" ? "16px 22px 30px" : 0 }}>

        {/* ---------- 23a · blank ---------- */}
        {phase !== "answered" && (
          <div style={{ minHeight: "calc(100vh - 46px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
            <div style={{ width: "100%", maxWidth: 720, marginTop: -40, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                <h1 className={grotesk.className} style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.5px", margin: 0 }}>Where do you need human help with your AI agent?</h1>
                <div style={{ fontSize: 13.5, color: MUT, marginTop: 7, lineHeight: 1.55 }}>Write it the way you would explain it to someone joining your team on Monday. No metrics, no rubric · that is our job.</div>
              </div>

              <div style={{ background: "#fff", borderRadius: 12, border: `1.5px solid ${GREEN}`, boxShadow: "0 4px 18px rgba(16,24,31,.06)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea ref={taRef} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={phase === "resolving"}
                  placeholder="What do your agents do, and what goes wrong when a call fails? Three or four sentences is plenty."
                  style={{ width: "100%", boxSizing: "border-box", minHeight: 74, border: "none", outline: "none", resize: "vertical", fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", color: INK, background: "transparent" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid #f0f3f6", paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: MUT }}>I need humans</span>
                  <div style={{ display: "inline-flex", background: "#eef2f6", borderRadius: 8, padding: 2, gap: 2 }}>
                    {([["recurring", "on a recurring basis"], ["one_time", "for a one-time problem"]] as [Cadence, string][]).map(([v, l]) => (
                      <button key={v} onClick={() => setCadence(v)} disabled={phase === "resolving"}
                        style={{ fontSize: 12, fontWeight: cadence === v ? 600 : 400, padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: cadence === v ? "#fff" : "transparent", color: cadence === v ? INK : MUT, boxShadow: cadence === v ? "0 1px 2px rgba(16,24,31,.08)" : "none", fontFamily: "inherit" }}>{l}</button>
                    ))}
                  </div>
                  <span style={{ flex: 1 }} />
                  <button onClick={analyse} disabled={!canAnalyse || phase === "resolving"}
                    style={{ fontSize: 13.5, fontWeight: 600, padding: "9px 20px", borderRadius: 8, border: "none", background: GREEN, color: "#fff", cursor: canAnalyse ? "pointer" : "not-allowed", opacity: canAnalyse ? 1 : 0.45 }}>
                    {phase === "resolving" ? "Reading…" : "Analyse"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 12, color: MUT, marginBottom: 7, textAlign: "center" }}>Or start from what another client wrote</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => { setDesc(e); taRef.current?.focus(); }}
                      style={{ flex: "1 1 300px", textAlign: "left", ...card, padding: "11px 13px", fontSize: 12.5, color: "#4d5a66", lineHeight: 1.5, cursor: "pointer", fontFamily: "inherit" }}>
                      &ldquo;{e}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- 23b · answered ---------- */}
        {phase === "answered" && res && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 400px", gap: 16, alignItems: "start", animation: "rlFade .42s ease-out" }}>
            <style>{"@keyframes rlFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* docked message */}
              <div style={{ ...card, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 11 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: INK, color: "#fff", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{initial}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.75 }}><HighlightedDesc text={desc.trim()} checks={res.checks.filter((c) => sel.includes(c.id))} /></div>
                    {res.checks.some((c) => c.quote) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7, fontSize: 10.5, color: "#93a1ae" }}>
                        <span>what we picked up</span>
                        <span><span style={{ color: GREEN }}>●</span> humans check this</span>
                        <span><span style={{ color: PURPLE }}>●</span> machine judge</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                      <span className={mono.className} style={{ fontSize: 11, color: MUT }}>
                        {callsPerWeek.toLocaleString()} calls{cadence === "recurring" ? " / wk" : ""} · {res.facts.languages.join(", ")}{res.facts.docs[0] ? ` · ${res.facts.docs[0].name}` : ""}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => setPhase("blank")} style={{ fontSize: 12, color: MUT, background: "transparent", border: "1px solid #e2e8ee", borderRadius: 7, padding: "4px 11px", cursor: "pointer" }}>Edit</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* recommendations header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 600 }}>Here is what we would check</span>
                <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 11.5, fontWeight: 600, padding: "3px 10px" }}>{sel.length} recommended</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: MUT }}>uncheck anything you do not want</span>
              </div>

              {/* check cards */}
              {shown.map((c) => {
                const on = sel.includes(c.id);
                return (
                  <div key={c.id} style={{ ...card, padding: "14px 16px", borderLeft: `4px solid ${on ? accent(c.routing) : "#dfe5ea"}`, opacity: on ? 1 : 0.55 }}>
                    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <button onClick={() => toggle(c.id)} aria-label={on ? "remove" : "add"}
                        style={{ width: 19, height: 19, borderRadius: 5, flex: "none", marginTop: 2, cursor: "pointer", border: `1.5px solid ${on ? GREEN : "#c8d2db"}`, background: on ? GREEN : "#fff", color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                          {routingPills(c.routing).map((p) => (
                            <span key={p.t} style={{ borderRadius: 999, background: p.bg, color: p.fg, fontSize: 10.5, fontWeight: 600, padding: "3px 9px" }}>{p.t}</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#4d5a66", lineHeight: 1.55, marginTop: 7 }}>{c.because}</div>
                        <div className={mono.className} style={{ fontSize: 11, color: MUT, marginTop: 7 }}>{c.volumeLabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* add more + change in plain language · plan step only */}
              {step === "plan" && (
              <div style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>Add more if you want</span>
                  <span style={{ fontSize: 11.5, color: MUT }}>you did not mention these, so we left them off</span>
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {res.suggestions.length === 0 && <span style={{ fontSize: 12, color: MUT }}>All of them are on the plan.</span>}
                  {res.suggestions.map((s) => (
                    <button key={s.id} onClick={() => addSuggestion(s.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, border: "1px solid #d6dee6", background: "#fff", padding: "6px 12px", fontSize: 12, color: "#4d5a66", cursor: "pointer", fontFamily: "inherit" }}>
                      ＋ {s.name}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>Or change anything in plain language</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={changeText} onChange={(e) => setChangeText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") requestChange(); }}
                      placeholder="Check every call for order numbers, not just a sample"
                      style={{ flex: 1, border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={requestChange} disabled={!changeText.trim() || busyChange}
                      style={{ minWidth: 66, borderRadius: 8, background: INK, color: "#fff", fontWeight: 600, fontSize: 12.5, border: "none", cursor: changeText.trim() ? "pointer" : "not-allowed", opacity: changeText.trim() ? 1 : 0.45 }}>{busyChange ? "…" : "Send"}</button>
                  </div>
                  <span style={{ fontSize: 11, color: MUT }}>We will show what it changes before anything runs.</span>

                  {pending && (
                    <div style={{ background: "#fffdf7", border: "1px solid #ecd9a8", borderRadius: 9, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                        This changes your plan to <b className={mono.className}>{pending.checks.length}</b> checks and the weekly estimate from <b className={mono.className}>₹{pending.from.toLocaleString()}</b> to <b className={mono.className}>₹{pending.to.toLocaleString()}</b>.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={applyChange} style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 7, border: "none", background: GREEN, color: "#fff", cursor: "pointer" }}>Apply the change</button>
                        <button onClick={() => setPending(null)} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 7, border: "1px solid #d6dee6", background: "#fff", color: "#4d5a66", cursor: "pointer" }}>Keep it as it is</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>

            {/* RIGHT RAIL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 16 }}>

              {/* STEP 1 · approve the plan. Volume and timing come after · the
                  client should settle what we check before how much of it. */}
              {step === "plan" && (
                <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Does this look right?</span>
                  <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.6 }}>
                    {sel.length === 0
                      ? "Pick at least one check to carry on."
                      : <>You have {sel.length === 1 ? "one check" : `${sel.length} checks`} selected. Uncheck anything you do not want, add more, or change it in plain language. Volume comes next.</>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid #eef2f6", paddingTop: 10 }}>
                    {res.checks.filter((c) => sel.includes(c.id)).map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: accent(c.routing), flex: "none" }} />
                        <span style={{ color: "#4d5a66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setStep("scope")} disabled={sel.length === 0}
                    style={{ height: 46, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: sel.length ? "pointer" : "default", opacity: sel.length ? 1 : 0.45, fontFamily: "inherit" }}>
                    Approve the plan →
                  </button>
                  <span style={{ fontSize: 11, color: MUT, textAlign: "center" }}>Nothing is configured yet.</span>
                </div>
              )}

              {step === "scope" && (
              <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {!started && (
                  <button onClick={() => setStep("plan")}
                    style={{ alignSelf: "flex-start", fontSize: 12, color: MUT, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>← back to the plan</button>
                )}
                {/* volume lives here · they approve the work first, then say
                    how much of it there is */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: MUT }}>{cadence === "recurring" ? "How many calls do you want checked?" : "How big is this batch?"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input value={vol} onChange={(e) => setVol(e.target.value)} disabled={started} inputMode="numeric"
                    placeholder={String(res.facts.callsPerWeek)}
                    style={{ width: 88, fontSize: 14, fontWeight: 600, fontFamily: "inherit", color: INK, padding: "7px 10px", borderRadius: 8, border: `1px solid ${GREEN}`, outline: "none", textAlign: "right" }} />
                  {cadence === "recurring" ? (
                    <div style={{ display: "inline-flex", background: "#eef2f6", borderRadius: 8, padding: 2, gap: 2 }}>
                      {([["week", "a week"], ["day", "a day"]] as ["week" | "day", string][]).map(([v, l]) => (
                        <button key={v} onClick={() => setVolUnit(v)} disabled={started}
                          style={{ fontSize: 12, fontWeight: volUnit === v ? 600 : 400, padding: "6px 12px", borderRadius: 6, border: "none", cursor: started ? "default" : "pointer", background: volUnit === v ? "#fff" : "transparent", color: volUnit === v ? INK : MUT, boxShadow: volUnit === v ? "0 1px 2px rgba(16,24,31,.08)" : "none", fontFamily: "inherit" }}>{l}</button>
                      ))}
                    </div>
                  ) : <span style={{ fontSize: 12.5, color: MUT }}>calls in this batch</span>}
                </div>
                {/* No price on this screen · the client says what to check and
                    how much of it, and we come back with the plan and the cost
                    within 48 hours. A rough range appears once they start. */}
                <span style={{ fontSize: 12, color: MUT, borderTop: "1px solid #eef2f6", paddingTop: 10, lineHeight: 1.55 }}>
                  {cadence === "recurring"
                    ? `We will scope this at ${callsPerWeek.toLocaleString()} calls a week and come back with the plan and the cost.`
                    : `We will scope this ${callsPerWeek.toLocaleString()}-call batch and come back with the plan and the cost.`}
                </span>
              </div>
              )}

              {/* once they commit, the panel stops selling and starts
                  reporting · this is the only status they need today */}
              {step === "scope" && (started ? (
                <div style={{ ...card, padding: "18px 18px", display: "flex", flexDirection: "column", gap: 12, minHeight: 420, borderLeft: `4px solid ${GREEN}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: GREEN, flex: "none", animation: "rlLive 1.6s ease-in-out infinite" }} />
                    <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Your program is starting</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "#4d5a66", lineHeight: 1.6 }}>
                    <b style={{ color: INK }}>We will get back to you within 48 hours</b> with the plan and the cost · your reviewer panel, the checks it will run, and the reliability number it screened at.
                  </div>
                  {/* a range, not a quote · the exact number arrives with the plan */}
                  <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "13px 14px" }}>
                    <div style={{ fontSize: 11.5, color: MUT, marginBottom: 3 }}>Rough cost estimate</div>
                    <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.4px" }}>
                      ₹{roughLow.toLocaleString()} to ₹{roughHigh.toLocaleString()}
                      <span style={{ fontSize: 13, color: MUT, fontWeight: 500 }}> {cadence === "recurring" ? "/ wk" : "for the batch"}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: MUT, marginTop: 5, lineHeight: 1.5 }}>
                      At {callsPerWeek.toLocaleString()} calls{cadence === "recurring" ? " a week" : ""}. We confirm the exact figure with the plan · you are billed on calls actually reviewed, never on the plan.
                    </div>
                  </div>
                  <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                    {[
                      ["Checks", res.checks.filter((c) => sel.includes(c.id)).map((c) => c.name).join(", ")],
                      [cadence === "recurring" ? "Volume" : "Batch", `${callsPerWeek.toLocaleString()} calls${cadence === "recurring" ? " a week" : ""}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 10, fontSize: 12.5, alignItems: "flex-start" }}>
                        <span style={{ color: MUT, width: 54, flex: "none" }}>{k}</span>
                        <span style={{ color: INK, flex: 1 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: MUT, lineHeight: 1.55 }}>
                    Matching and screening reviewers against your volume now, and building a calibration set from your own recordings.
                  </div>
                  <span style={{ flex: 1 }} />
                  <a href="/portal/agents" style={{ height: 44, borderRadius: 9, background: "#fff", border: "1px solid #d6dee6", color: INK, fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Where findings will land →</a>
                  <span style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>We will email you the moment the panel clears screening.</span>
                  <style>{"@keyframes rlLive{0%,100%{opacity:1}50%{opacity:.35}}"}</style>
                </div>
              ) : (
              <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11, minHeight: 420 }}>
                <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>What happens when you start</span>
                {(cadence === "recurring" ? [
                  ["today", "We match reviewers from the marketplace to your volume and languages, and build a calibration set from your own recordings."],
                  ["48 hours", "You get the plan and the cost, with your reviewer panel and the reliability number it screened at."],
                  ["then", "The panel goes live. Only reviewers who match our experts are on your work."],
                  ["day 4", "First findings land in Agent insights, each with a timestamp you can play."],
                  ["weekly", "Expert-rated calls stay seeded in every batch, unmarked, so reliability keeps being checked."],
                ] : [
                  ["today", "We match reviewers from the marketplace to this batch, and build a calibration set from your own recordings."],
                  ["48 hours", "You get the plan and the cost, with your reviewer panel and the reliability number it screened at."],
                  ["then", "The panel goes live. Only reviewers who match our experts are on your work."],
                  ["day 5", "The full batch is reviewed. Findings land in Agent insights, each with a timestamp you can play."],
                  ["after", "You keep the report and the golden data. Run another batch whenever you want."],
                ]).map(([d, t]) => (
                  <div key={d} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className={mono.className} style={{ fontSize: 10.5, color: GREEN, width: 52, flex: "none", paddingTop: 2 }}>{d}</span>
                    <span style={{ fontSize: 12, color: "#4d5a66", lineHeight: 1.55 }}>{t}</span>
                  </div>
                ))}
                <span style={{ flex: 1 }} />
                <button onClick={start} disabled={sel.length === 0}
                  style={{ height: 48, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14.5, border: "none", cursor: sel.length === 0 ? "default" : "pointer", marginTop: 3, opacity: sel.length === 0 ? 0.45 : 1 }}>
                  Start the program
                </button>
                <span style={{ fontSize: 11, color: MUT, textAlign: "center" }}>Nothing is configured until you click this.</span>
                <span style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>Prefer to wire it from code? <a href="/portal/connect" style={{ color: GREEN }}>Connect via MCP</a></span>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* resolving skeletons · the client should feel it reading */}
        {phase === "resolving" && (
          <div style={{ position: "fixed", left: 222, right: 22, bottom: 26, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...card, height: 74, opacity: 0.5, animation: `rlPulse 1.1s ${i * 0.13}s ease-in-out infinite` }} />
            ))}
            <style>{"@keyframes rlPulse{0%,100%{opacity:.35}50%{opacity:.7}}"}</style>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
