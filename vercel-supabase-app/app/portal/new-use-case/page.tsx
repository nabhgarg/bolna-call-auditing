"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, card } from "../../../lib/ui";

// New use case (wireframe 23a/23b) · the client describes the job in plain
// language and we say what we would check, who checks it, and what it costs.
// One screen, one transition: a centered composer (23a) that docks top-left
// once answered (23b). No metric, rubric, schema, weight or threshold appears
// anywhere. Nothing is configured until "Start the 2-week pilot".
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

type Routing = "human" | "judge_human_verified" | "judge";
type Check = {
  id: string; name: string; routing: Routing; because: string;
  priceLabel: string; volumeLabel: string; weeklyInr: number; selected?: boolean;
};
type Resolved = {
  facts: { callsPerWeek: number; languages: string[]; docs: { name: string; pages?: number }[] };
  checks: Check[];
  suggestions: { id: string; name: string; priceInr: number }[];
  estimate: { weeklyInr: number; lines: { checkId: string; inr: number }[] };
};

const EXAMPLES = [
  "Our bot takes food orders in Hinglish. It keeps getting quantities wrong when people say do teen.",
  "We do EMI reminders. If it tells someone the wrong outstanding amount we have a compliance problem.",
];
const DEFAULT_CALLS = 1240;
const POLICY_DOC = { name: "support-policies-v4.pdf", pages: 18 };

const routingPills = (r: Routing) =>
  r === "human" ? [{ t: "100% human", bg: "#e7f4ee", fg: GREEN }]
  : r === "judge" ? [{ t: "machine judge", bg: "#f3eefc", fg: PURPLE }]
  : [{ t: "machine judge", bg: "#f3eefc", fg: PURPLE }, { t: "human verified", bg: "#e7f4ee", fg: GREEN }];
const accent = (r: Routing) => (r === "human" ? GREEN : PURPLE);

export default function NewUseCase() {
  const [phase, setPhase] = useState<"blank" | "resolving" | "answered">("blank");
  const [desc, setDesc] = useState("");
  const [docs, setDocs] = useState<{ name: string; pages?: number }[]>([]);
  const [recordings, setRecordings] = useState(false);
  const [res, setRes] = useState<Resolved | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [est, setEst] = useState<{ weeklyInr: number; lines: { checkId: string; inr: number }[] } | null>(null);
  const [changeText, setChangeText] = useState("");
  const [pending, setPending] = useState<{ from: number; to: number; checks: Check[]; ids: string[] } | null>(null);
  const [busyChange, setBusyChange] = useState(false);
  const [started, setStarted] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert"); }, []);

  const callsPerWeek = res?.facts.callsPerWeek ?? DEFAULT_CALLS;
  const canAnalyse = desc.trim().length >= 40;

  async function reprice(ids: string[]) {
    try {
      const d = await fetch("/api/use-cases/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, callsPerWeek }) }).then((r) => r.json());
      setEst(d.estimate);
      return d.checks as Check[];
    } catch { return []; }
  }

  async function analyse() {
    if (!canAnalyse) return;
    setPhase("resolving");
    try {
      const d: Resolved = await fetch("/api/use-cases/resolve", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: desc.trim(), callsPerWeek: recordings ? DEFAULT_CALLS : DEFAULT_CALLS, docs }),
      }).then((r) => r.json());
      if (!d?.checks) { setPhase("blank"); return; }
      setRes(d); setSel(d.checks.map((c) => c.id)); setEst(d.estimate); setPhase("answered");
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
        body: JSON.stringify({ description: `${desc.trim()}\n\nChange requested: ${t}`, callsPerWeek, docs }),
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
        body: JSON.stringify({ description: desc.trim(), facts: res?.facts, ids: sel, status: "pilot" }),
      });
    } catch { /* the pilot is confirmed on screen either way */ }
  }

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;

  const shown = (res?.checks || []).filter((c) => sel.includes(c.id) || true);
  const initial = "N";

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "13px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>New use case</span>
        {phase === "answered" && <>
          <span style={{ fontSize: 12.5, color: MUT }}>you describe it · we work out what to measure</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => { setPhase("blank"); setRes(null); setEst(null); setSel([]); setStarted(false); }}
            style={{ fontSize: 12.5, color: "#4d5a66", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "6px 13px", cursor: "pointer", fontFamily: "inherit" }}>Start over</button>
        </>}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setRecordings(true)} disabled={phase === "resolving"}
                    style={{ fontSize: 12, padding: "6px 11px", borderRadius: 8, border: `1px solid ${recordings ? GREEN : "#d6dee6"}`, background: recordings ? "#e7f4ee" : "#fff", color: recordings ? GREEN : "#4d5a66", cursor: "pointer" }}>
                    {recordings ? `✓ ${DEFAULT_CALLS.toLocaleString()} recordings` : "＋ Add call recordings"}
                  </button>
                  <button onClick={() => setDocs([POLICY_DOC])} disabled={phase === "resolving"}
                    style={{ fontSize: 12, padding: "6px 11px", borderRadius: 8, border: `1px solid ${docs.length ? GREEN : "#d6dee6"}`, background: docs.length ? "#e7f4ee" : "#fff", color: docs.length ? GREEN : "#4d5a66", cursor: "pointer" }}>
                    {docs.length ? `✓ ${docs[0].name}` : "＋ Add a policy doc"}
                  </button>
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
                    <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>{desc.trim()}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                      <span className={mono.className} style={{ fontSize: 11, color: MUT }}>
                        {res.facts.callsPerWeek.toLocaleString()} calls / wk · {res.facts.languages.join(", ")}{res.facts.docs[0] ? ` · ${res.facts.docs[0].name}` : ""}
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
                          <span style={{ flex: 1 }} />
                          <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>{c.priceLabel}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "#4d5a66", lineHeight: 1.55, marginTop: 7 }}>{c.because}</div>
                        <div className={mono.className} style={{ fontSize: 11, color: MUT, marginTop: 7 }}>{c.volumeLabel}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* add more + change in plain language */}
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
                      ＋ {s.name} <span className={mono.className} style={{ fontSize: 11, color: MUT }}>₹{s.priceInr}</span>
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
                  <span style={{ fontSize: 11, color: MUT }}>We will show what it does to the price and to reliability before anything runs.</span>

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
            </div>

            {/* RIGHT RAIL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 16 }}>
              <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: MUT }}>Your estimate at {callsPerWeek.toLocaleString()} calls a week</span>
                <div className={grotesk.className} style={{ fontSize: 29, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>
                  ₹{(est?.weeklyInr ?? 0).toLocaleString()} <span style={{ fontSize: 15, color: MUT, fontWeight: 500 }}>/ wk</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid #eef2f6", paddingTop: 9 }}>
                  {(est?.lines || []).map((l) => {
                    const c = res.checks.find((x) => x.id === l.checkId);
                    return (
                      <div key={l.checkId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "#4d5a66", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name || l.checkId}</span>
                        <span style={{ flex: 1 }} />
                        <span className={mono.className} style={{ color: INK }}>₹{l.inr.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {(est?.lines || []).length === 0 && <span style={{ fontSize: 12, color: MUT }}>Nothing selected yet.</span>}
                </div>
                <span style={{ fontSize: 11, color: MUT }}>Billed on calls actually reviewed, not on the plan.</span>
              </div>

              <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 11, minHeight: 420 }}>
                <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>What happens when you start</span>
                {[
                  ["today", "We build a calibration set from your own recordings and screen 18 Hindi and Hinglish reviewers on it."],
                  ["day 3", "Only reviewers who match our experts get your work. You see the panel reliability number."],
                  ["day 4", "First findings land in Agent insights, each with a timestamp you can play."],
                  ["weekly", "Expert-rated calls stay seeded in every batch, unmarked, so reliability keeps being checked."],
                ].map(([d, t]) => (
                  <div key={d} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className={mono.className} style={{ fontSize: 10.5, color: GREEN, width: 44, flex: "none", paddingTop: 2 }}>{d}</span>
                    <span style={{ fontSize: 12, color: "#4d5a66", lineHeight: 1.55 }}>{t}</span>
                  </div>
                ))}
                <span style={{ flex: 1 }} />
                <button onClick={start} disabled={started || sel.length === 0}
                  style={{ height: 48, borderRadius: 9, background: started ? "#e7f4ee" : GREEN, color: started ? GREEN : "#fff", fontWeight: 600, fontSize: 14.5, border: "none", cursor: started || sel.length === 0 ? "default" : "pointer", marginTop: 3, opacity: sel.length === 0 ? 0.45 : 1 }}>
                  {started ? "✓ Pilot starting · screening begins today" : "Start the 2-week pilot"}
                </button>
                <span style={{ fontSize: 11, color: MUT, textAlign: "center" }}>
                  {started ? "We will email you when the panel clears screening." : "Nothing is configured until you click this."}
                </span>
              </div>
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
