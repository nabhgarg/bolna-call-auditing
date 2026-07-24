"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED, AMBER, BLUE, card } from "../../../lib/ui";

// Reviewer onboarding + calibration v2. Apply → 10 real tasks in two parts:
// Part 1 · transcription, in the SAME UI pattern as the real /transcribe
// workbench (listen → verdict the ASR segment). Part 2 · objective issue
// spotting (real VBL input-capture + language-switch moments), no vibe scores.
// Free navigation between questions; instant expert feedback + live AI coach.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const PASS = 75;
const CANON = "https://api.bolna.ai/recordings/call/";

type TransItem = { type: "trans"; call_id: string; recording_url?: string; sec: number; context?: string; heard?: string; asr?: string[]; wrongIdx?: number; golden?: string; ts?: string; explain: string };
type IssueItem = { call_id: string; recording_url?: string; ts: string; setup: string; options: string[]; correct: number; explain: string };
type Verdict = "match" | "miss" | "";

function tsSec(ts: string) { const [m, s] = String(ts || "0:0").split(":"); return Number(m) * 60 + Number(s || 0); }

export default function Join() {
  const [screen, setScreen] = useState<"apply" | "work" | "result">("apply");
  const [role, setRole] = useState("Reviewer");
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [edu, setEdu] = useState("Graduate");
  const [hours, setHours] = useState("5-15");
  const [phone, setPhone] = useState("");
  const [part1, setPart1] = useState<TransItem[]>([]);
  const [part2, setPart2] = useState<IssueItem[]>([]);
  const [idx, setIdx] = useState(-1);            // -1 = home picker
  const [results, setResults] = useState<Record<number, Verdict>>({});
  const [feedback, setFeedback] = useState<number | null>(null); // idx currently showing feedback
  const [picked, setPicked] = useState(-1);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [coachQ, setCoachQ] = useState("");
  const [coachA, setCoachA] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/calibration").then((r) => r.json()).then((d) => { setPart1(d.part1 || []); setPart2(d.part2 || []); }).catch(() => {});
  }, []);

  const total = part1.length + part2.length;
  const done = Object.keys(results).length;
  const ptsSum = Object.values(results).reduce((a, v) => a + (v === "match" ? 1 : 0), 0);
  const isTrans = idx >= 0 && idx < part1.length;
  const t: TransItem | undefined = isTrans ? part1[idx] : undefined;
  const q: IssueItem | undefined = !isTrans && idx >= part1.length ? part2[idx - part1.length] : undefined;

  function audioSrcFor(i: number) {
    const item = i < part1.length ? part1[i] : part2[i - part1.length];
    const url = (item as any)?.recording_url || (item ? CANON + (item as any).call_id : "");
    return url ? `/api/audio?url=${encodeURIComponent(url)}` : "";
  }
  function play(i: number, seekTs?: string) {
    const a = audioRef.current; if (!a) return;
    if (playingIdx === i && !a.paused) { a.pause(); setPlayingIdx(null); return; }
    const src = audioSrcFor(i);
    if (a.getAttribute("data-src") !== src) { a.src = src; a.setAttribute("data-src", src); }
    const go = () => { try { if (seekTs) a.currentTime = Math.max(0, tsSec(seekTs) - 2); } catch {} a.play().then(() => setPlayingIdx(i)).catch(() => setPlayingIdx(null)); };
    if (a.readyState >= 1) go(); else { a.addEventListener("loadedmetadata", go, { once: true }); a.load(); }
  }
  function stopAudio() { audioRef.current?.pause(); setPlayingIdx(null); }

  function open(i: number) { if (results[i] !== undefined) return; stopAudio(); setIdx(i); setFeedback(null); setPicked(-1); setCoachQ(""); setCoachA(""); }
  function answer(i: number, v: Verdict, p: number) { stopAudio(); setResults((r) => ({ ...r, [i]: v })); setPicked(p); setFeedback(i); }
  function next() { const n = [...Array(total).keys()].find((i) => results[i] === undefined); stopAudio(); setFeedback(null); setPicked(-1); setCoachQ(""); setCoachA(""); if (n === undefined) setScreen("result"); else setIdx(n); }

  async function askCoach() {
    const qq = coachQ.trim(); if (!qq || coachBusy) return;
    setCoachBusy(true); setCoachA("");
    const fi = feedback ?? idx;
    const ctx = fi < part1.length
      ? (() => { const c = part1[fi]; return `Task: verdict an ASR segment like the real transcription workbench. Agent said: "${c.context}". User actually said: "${c.heard}". ASR wrote: "${(c.asr || []).join(" ")}". ${(c.wrongIdx ?? -1) >= 0 ? `Wrong word: "${(c.asr || [])[c.wrongIdx!]}"; golden: "${c.golden}".` : "The ASR was correct."} Expert note: ${c.explain}.`; })()
      : (() => { const c = part2[fi - part1.length]; return `Task: identify the issue in a real call moment. Setup: ${c.setup} Options: ${c.options.join(" / ")}. Correct: "${c.options[c.correct]}". Expert reasoning: ${c.explain}. Trainee picked: "${c.options[picked] ?? "?"}".`; })();
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: ctx, question: qq }) });
      const d = await r.json(); setCoachA(d.text || "Coach unavailable · re-read the expert note above.");
    } catch { setCoachA("Coach unavailable · re-read the expert note above."); }
    setCoachBusy(false);
  }

  const canApply = langs.length > 0 && phone.replace(/\D/g, "").length >= 10;
  const agreementLabel = done ? Math.round((ptsSum / done) * 100) + "%" : "-";
  const pct = total ? Math.round((ptsSum / total) * 100) : 0;

  function Row({ i, label }: { i: number; label: string }) {
    const st = results[i];
    const cur = idx === i && screen === "work";
    const answered = st !== undefined;
    return (
      <div onClick={() => !answered && open(i)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, border: `1.5px solid ${cur ? GREEN : "transparent"}`, background: cur ? "#f2faf6" : "transparent", borderRadius: 8, padding: "6px 8px", cursor: answered ? "default" : "pointer" }}>
        <span style={{ color: answered ? (st === "match" ? GREEN : RED) : GREEN }}>{answered ? (st === "match" ? "✓" : "✗") : "▶"}</span>
        <span className={mono.className} style={{ color: INK, fontSize: 11.5 }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ borderRadius: 999, background: answered ? (st === "match" ? "#e7f4ee" : "#fbeaea") : "#eef2f6", color: answered ? (st === "match" ? GREEN : RED) : "#93a1ae", padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
          {answered ? (st === "match" ? "✓ matched" : "✗ missed") : (cur ? "in progress" : "open")}
        </span>
      </div>
    );
  }

  const feedbackItem = feedback !== null;
  const fi = feedback ?? 0;
  const fIsTrans = fi < part1.length;
  const fT = fIsTrans ? part1[fi] : undefined;
  const fQ = !fIsTrans ? part2[fi - part1.length] : undefined;
  const fVerdict = feedback !== null ? results[fi] : "";

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#e8ecef", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 22, boxSizing: "border-box" }}>
      <audio ref={audioRef} onEnded={() => setPlayingIdx(null)} style={{ display: "none" }} />
      <div style={{ width: "100%", maxWidth: 1160, background: "#f5f7f9", borderRadius: 16, border: "1px solid #e2e8ee", boxShadow: "0 10px 34px rgba(16,24,31,.1)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 720 }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "13px 20px" }}>
          <span style={{ width: 17, height: 17, borderRadius: 4, background: GREEN }} />
          <span className={grotesk.className} style={{ fontWeight: 700, fontSize: 16 }}>realloop</span>
          <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>
            {screen === "apply" ? "Become a reviewer" : screen === "result" ? "Result" : `Calibration · ${done}/${total || 10}`}
          </span>
          <span style={{ flex: 1 }} />
          {screen === "work" && done > 0 && (
            <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>your agreement: {agreementLabel}</span>
          )}
          <span style={{ fontSize: 12.5, color: MUT }}>Open roles · <a href="/marketplace" style={{ color: MUT }}>Marketplace</a></span>
        </div>

        {/* APPLY */}
        {screen === "apply" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 28, padding: "30px 36px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.12, letterSpacing: "-.4px" }}>Review AI phone calls.<br />Work from anywhere, anytime.</div>
                  <div style={{ fontSize: 14, color: MUT, marginTop: 7, maxWidth: 480 }}>A laptop or phone and headphones are all you need. No resume, no interview · your agreement score decides your tier and pay.</div>
                </div>
                <div style={{ ...card, padding: 16, display: "flex", gap: 14 }}>
                  <div style={{ flex: 1 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22, color: GREEN }}>₹300/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 2 · from day one</div></div>
                  <div style={{ flex: 1, borderLeft: "1px solid #eef2f6", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22, color: GREEN }}>₹500/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 1 · high agreement</div></div>
                  <div style={{ flex: 1.1, borderLeft: "1px solid #eef2f6", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>₹2,000+</div><div style={{ fontSize: 11, color: MUT }}>top reviewers make / day · paid weekly</div></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {[
                    ["1", "Apply in 2 minutes", " · the form on the right", "~2 min", true],
                    ["2", "Do 10 real tasks", " · the tool teaches you as you go", "~40 min", false],
                    ["3", "Short onboarding", " · 30 min on WhatsApp", "same week", false],
                    ["4", "Your agreement score sets your tier and pay", " · improve it, earn more", "ongoing", false]
                  ].map(([n, b, rest, when, dark], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", borderBottom: i < 3 ? "1px solid #e9edf1" : "none", fontSize: 13.5, color: "#4d5a66" }}>
                      <span className={grotesk.className} style={{ width: 24, height: 24, borderRadius: 12, flex: "none", background: dark ? INK : "#e9edf1", color: dark ? "#fff" : MUT, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
                      <span><b style={{ color: INK }}>{b}</b>{rest}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: MUT }}>{when}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...card, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
                <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16 }}>Apply now</span>
                <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                  {["Reviewer", "Expert"].map((n) => (
                    <div key={n} onClick={() => setRole(n)} style={{ flex: 1, textAlign: "center", fontSize: 12.5, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === role ? "#fff" : "transparent", color: n === role ? INK : MUT, boxShadow: n === role ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Languages you speak</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((n) => {
                      const on = langs.includes(n);
                      return <span key={n} onClick={() => setLangs((s) => on ? s.filter((x) => x !== n) : [...s, n])} style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "4px 10px", fontSize: 11.5, cursor: "pointer" }}>{n}</span>;
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Education</div>
                  <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                    {["12th", "Graduate", "Postgrad"].map((n) => (
                      <div key={n} onClick={() => setEdu(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === edu ? "#fff" : "transparent", color: n === edu ? INK : MUT, boxShadow: n === edu ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Hours per week</div>
                  <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                    {["<5", "5-15", "15+"].map((n) => (
                      <div key={n} onClick={() => setHours(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === hours ? "#fff" : "transparent", color: n === hours ? INK : MUT, boxShadow: n === hours ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Phone (WhatsApp)</div>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10, color: "#93a1ae", marginTop: 3 }}>Only for your login code and onboarding call. Never shown anywhere.</div>
                </div>
                <div onClick={() => canApply && setScreen("work")} style={{ height: 44, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: canApply ? 1 : 0.45 }}>Apply → your 10 tasks are ready</div>
                <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>{canApply ? "No wait · calibration starts the moment you submit." : "Pick at least one language and enter a valid phone number."}</div>
              </div>
            </div>
            {/* bottom stat cards */}
            <div style={{ display: "flex", gap: 12, padding: "0 36px 26px" }}>
              {[["14", "reviewers working today"], ["1,733+", "paid reviews delivered"], ["weekly", "payouts, UPI"], ["7", "open roles · see all"]].map(([n, l]) => (
                <div key={l} style={{ ...card, flex: 1, padding: "14px 16px" }}>
                  <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
                  <div style={{ fontSize: 11.5, color: MUT }}>{l === "open roles · see all" ? <>open roles · <a href="/marketplace" style={{ color: GREEN }}>see all</a></> : l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORK */}
        {screen === "work" && (
          <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, padding: "16px 20px", flex: 1, alignItems: "start" }}>
            {/* rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#e2e8ee" }}><div style={{ width: `${total ? (done / total) * 100 : 0}%`, height: 7, borderRadius: 4, background: GREEN }} /></div>
                <span className={mono.className} style={{ fontSize: 12 }}>{done} / {total || 10}</span>
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Fix the transcript</span><span style={{ fontSize: 10.5, color: MUT }}>same tool as paid work</span></div>
                {part1.map((_, i) => <Row key={i} i={i} label={`task ${i + 1} · segment`} />)}
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Spot the issue</span><span style={{ fontSize: 10.5, color: MUT }}>real production moments</span></div>
                {part2.map((_, i) => <Row key={i} i={part1.length + i} label={`task ${part1.length + i + 1} · moment`} />)}
              </div>
              <div style={{ fontSize: 11, color: "#93a1ae", lineHeight: 1.45, padding: "0 3px" }}>Move between open tasks freely. Feedback is instant · these are real production calls, graded by our experts.</div>
            </div>

            {/* panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {idx === -1 && feedback === null && (
                <div style={{ ...card, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>Your 10 calibration tasks</div>
                  <div style={{ fontSize: 13.5, color: MUT, maxWidth: 440 }}>Part 1: fix 5 real ASR segments · in the exact tool our paid transcribers use. Part 2: spot the issue in 5 real production moments. Your agreement with the expert decides your tier.</div>
                  <div onClick={() => total && open(0)} style={{ height: 46, minWidth: 240, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0 22px", opacity: total ? 1 : 0.5 }}>{total ? "Start task 1 ▶" : "Loading…"}</div>
                </div>
              )}

              {/* PART 1 · transcription (real workbench pattern) */}
              {feedback === null && t && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12, alignItems: "start" }}>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 220 }}>
                    <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Segment · task {idx + 1} of {total}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7f9", borderRadius: 9, padding: "9px 11px" }}>
                      <div onClick={() => play(idx, t.ts)} style={{ width: 34, height: 34, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", flex: "none" }}>{playingIdx === idx ? "❚❚" : "▶"}</div>
                      <div style={{ fontSize: 12.5, color: MUT }}>Listen to the user&apos;s turn{t.ts ? <> at <span className={mono.className}>@{t.ts}</span></> : ""} · replay as often as you need</div>
                    </div>
                    <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 11, padding: "7px 11px", fontSize: 13.5 }}>
                      <span style={{ display: "block", fontSize: 9.5, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>agent</span>{t.context}
                    </div>
                    <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#eef4fd", borderRadius: 11, padding: "7px 11px", fontSize: 13.5 }}>
                      <span style={{ display: "block", fontSize: 9.5, color: BLUE, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>user · what the ASR wrote</span>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 3 }}>
                        {(t.asr || []).map((w, i) => (
                          <span key={i} onClick={() => answer(idx, i === t.wrongIdx ? "match" : "miss", i)} style={{ border: "1.5px solid #c6d6ee", background: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 14, cursor: "pointer" }}>{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 15 }}>Your verdict</span>
                    <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.5 }}>Exactly like the paid tool: listen, then either confirm the segment is correct · or <b style={{ color: INK }}>tap the word the ASR got wrong</b>.</div>
                    <div onClick={() => answer(idx, (t.wrongIdx ?? -1) < 0 ? "match" : "miss", -2)} style={{ height: 42, borderRadius: 9, border: `1.5px solid ${GREEN}`, color: GREEN, fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✓ Transcript is correct</div>
                    <div style={{ fontSize: 11.5, color: "#93a1ae" }}>Not sure? Replay the audio. Real calls are messy · that&apos;s the job.</div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 11, color: MUT }}>You can switch to any other open task from the left rail.</div>
                  </div>
                </div>
              )}

              {/* PART 2 · objective issue spotting */}
              {feedback === null && q && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12, alignItems: "start" }}>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 200 }}>
                    <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Real production moment · task {idx + 1} of {total}</span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{q.setup}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7f9", borderRadius: 9, padding: "9px 11px" }}>
                      <div onClick={() => play(idx, q.ts)} style={{ width: 34, height: 34, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", flex: "none" }}>{playingIdx === idx ? "❚❚" : "▶"}</div>
                      <span className={mono.className} style={{ fontSize: 12 }}>{q.call_id.slice(0, 8)} @{q.ts}</span>
                      <span style={{ fontSize: 11.5, color: MUT }}>· plays from ~2s before the moment</span>
                    </div>
                  </div>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 15 }}>What went wrong here?</span>
                    {q.options.map((o, i) => (
                      <div key={i} onClick={() => answer(idx, i === q.correct ? "match" : "miss", i)} style={{ border: "1.5px solid #d6dee6", background: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer" }}>{o}</div>
                    ))}
                    <div style={{ fontSize: 11.5, color: "#93a1ae" }}>Listen first · one specific thing breaks in this moment.</div>
                  </div>
                </div>
              )}

              {/* FEEDBACK */}
              {feedbackItem && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 660 }}>
                  <div style={{ background: fVerdict === "match" ? "#f2faf6" : "#fffafa", border: `1.5px solid ${fVerdict === "match" ? GREEN : RED}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: fVerdict === "match" ? GREEN : RED }}>
                      {fIsTrans
                        ? (fVerdict === "match" ? ((fT!.wrongIdx ?? -1) < 0 ? "✓ Right · the transcript was correct" : `✓ Caught it · “${(fT!.asr || [])[fT!.wrongIdx!]}” was wrong`) : (picked === -2 ? `✗ There was an error · “${(fT!.asr || [])[fT!.wrongIdx!]}” is wrong` : ((fT!.wrongIdx ?? -1) < 0 ? "✗ The transcript was actually correct" : `✗ Not that word · the error was “${(fT!.asr || [])[fT!.wrongIdx!]}”`)))
                        : (fVerdict === "match" ? `✓ Exactly · ${fQ!.options[fQ!.correct].toLowerCase()}` : `✗ Not quite · the issue was: ${fQ!.options[fQ!.correct].toLowerCase()}`)}
                    </span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{fIsTrans ? fT!.explain : fQ!.explain}</div>
                    {fIsTrans && (
                      <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.6 }}>
                        <span style={{ color: MUT }}>ASR:</span> {(fT!.asr || []).join(" ")}<br /><span style={{ color: MUT }}>Golden:</span> <b style={{ color: GREEN }}>{fT!.golden}</b>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div onClick={() => play(fi, fIsTrans ? fT!.ts : fQ!.ts)} style={{ width: 26, height: 26, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, cursor: "pointer" }}>{playingIdx === fi ? "❚❚" : "▶"}</div>
                      <span style={{ fontSize: 11.5, color: MUT }}>replay the moment with the answer in mind</span>
                    </div>
                  </div>
                  <div style={{ ...card, padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: MUT }}><b style={{ color: INK }}>Still unsure? Ask the coach</b> · it knows this exact call.</span>
                    <div style={{ display: "flex", gap: 7 }}>
                      <input value={coachQ} onChange={(e) => setCoachQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askCoach(); }} placeholder="e.g. how would I catch this faster?" style={{ flex: 1, border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }} />
                      <div onClick={askCoach} style={{ minWidth: 58, borderRadius: 8, background: INK, color: "#fff", fontWeight: 600, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{coachBusy ? "…" : "Ask"}</div>
                    </div>
                    {coachA && (
                      <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
                        <span style={{ display: "block", fontSize: 9.5, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>coach</span>{coachA}
                      </div>
                    )}
                  </div>
                  <div onClick={next} style={{ height: 46, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{done >= total ? "See your result →" : "Got it · next task →"}</div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* RESULT */}
        {screen === "result" && (
          <div style={{ display: "flex", flex: 1, alignItems: "flex-start", justifyContent: "center", padding: 24 }}>
            <div style={{ ...card, borderRadius: 14, padding: 34, display: "flex", flexDirection: "column", gap: 13, alignItems: "center", textAlign: "center", maxWidth: 560, width: "100%", boxSizing: "border-box" }}>
              <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 21 }}>Calibration complete</div>
              <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 56, color: pct >= PASS ? GREEN : AMBER, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 13, color: MUT }}>agreement with the expert · {ptsSum} of {total} matched</div>
              <div style={{ display: "flex", gap: 5 }}>
                {[...Array(total).keys()].map((i) => <span key={i} style={{ width: 26, height: 8, borderRadius: 4, background: results[i] === "match" ? GREEN : RED }} />)}
              </div>
              {pct >= PASS ? (
                <div style={{ background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 17, color: GREEN }}>Tier 2 unlocked · ₹300/hr</span>
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>One step left: a 30-minute onboarding call. Then real, paid work starts. Hold ≥75% across 2 real batches → Tier 1 at ₹500/hr.</span>
                  <a href="https://wa.me/919999999999?text=Hi%20realloop%2C%20I%20passed%20calibration%20and%20want%20to%20book%20onboarding" target="_blank" rel="noopener noreferrer" style={{ height: 42, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: 5, textDecoration: "none" }}>Book onboarding on WhatsApp →</a>
                </div>
              ) : (
                <div style={{ background: "#fffdf7", border: "1.5px solid #d99a2b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: AMBER }}>Not yet · you need {PASS}%</span>
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>Retake in 7 days with 10 new tasks. Re-read the expert feedback on the ones you missed · that&apos;s exactly what the retake tests.</span>
                </div>
              )}
              <span onClick={() => { stopAudio(); setScreen("apply"); setIdx(-1); setResults({}); setFeedback(null); setPicked(-1); setPhone(""); }} style={{ fontSize: 12, color: MUT, cursor: "pointer", textDecoration: "underline" }}>restart</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
