"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED, AMBER, BLUE, card } from "../../../lib/ui";

// Reviewer onboarding + calibration. Apply → 10 REAL GT-graded calls (5
// expert-scored vibe + 5 real ASR-error transcript checks) played from the
// actual Bolna recordings, in the SAME workbench reviewers use for paid work →
// instant expert feedback + quiz + live AI coach → agreement score sets tier.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const PASS = 75;
const CANON = "https://api.bolna.ai/recordings/call/";

type Turn = { who: string; text: string };
type Call = {
  type: "vibe" | "trans"; call_id: string; recording_url?: string; sec: number;
  expert?: number; turns?: Turn[]; context?: string; heard?: string; asr?: string[];
  wrongIdx?: number; golden?: string; ts?: string; explain: string;
};

const SCORE_LABELS: Record<number, string> = { 1: "Major failure", 2: "Noticeably broken", 3: "Mostly okay", 4: "Clean call" };
type Verdict = "match" | "close" | "miss" | "";
const pts = (v: Verdict) => (v === "match" ? 1 : v === "close" ? 0.5 : 0);

const PRAISE = ["you listened before answering — keep that habit.", "careful attention on that one.", "you weighed the whole call, not just one moment.", "good instinct — now sharpen where the line falls.", "steady judgment — that is what calibrated means."];

function vibeQuiz(score: number) {
  const bank: Record<number, { q: string; opts: string[]; correct: number; note: string }> = {
    4: { q: "What makes a call a 4, not a 3?", opts: ["It was short", "Task done AND no wasted turns or awkwardness", "The agent spoke Hindi"], correct: 1, note: "a clean call = task done + nothing awkward. Length never sets the score." },
    3: { q: "Task done, but the flow was awkward. Score?", opts: ["3 — mostly okay", "4 — task done is all that counts", "2 — flow problems make it broken"], correct: 0, note: "flow problems cost polish (a 3), not function (a 2)." },
    2: { q: "The voice sounded fine but the agent mishandled the user. That is…", opts: ["a 3 — the content was okay", "a 2 — noticeably broken", "a 1 — total failure"], correct: 1, note: "score what the agent does, not how it sounds — a loop or ignored input is a 2." },
    1: { q: "The user never got helped (wrong language / abandoned). That is…", opts: ["a 2 — minor slip", "a 1 — major failure", "a 3 — mostly okay"], correct: 1, note: "if the task fails for the user, nothing else can raise it above a 1." }
  };
  return bank[score] || bank[2];
}
function transQuiz(hasError: boolean) {
  return hasError
    ? { q: "Why does one wrong word matter?", opts: ["It is only a spelling style", "One word changes the meaning the model learns", "It does not — they sound similar"], correct: 1, note: "the golden transcript must say what was MEANT, word for word." }
    : { q: "Marking a correct transcript as wrong…", opts: ["Is safer than missing an error", "Does not really matter", "Poisons the dataset with false errors"], correct: 2, note: "false alarms are as costly as misses — confirm clean turns confidently." };
}

function Seg({ opts, cur, onPick }: { opts: string[]; cur: string; onPick: (v: string) => void }) {
  return (
    <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
      {opts.map((n) => (
        <div key={n} onClick={() => onPick(n)} style={{ flex: 1, textAlign: "center", fontSize: 12.5, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === cur ? "#fff" : "transparent", color: n === cur ? INK : MUT, boxShadow: n === cur ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>
      ))}
    </div>
  );
}

export default function Join() {
  const [screen, setScreen] = useState<"apply" | "home" | "call" | "feedback" | "result">("apply");
  const [role, setRole] = useState("Reviewer");
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [edu, setEdu] = useState("Graduate");
  const [hours, setHours] = useState("5–15");
  const [phone, setPhone] = useState("");
  const [calls, setCalls] = useState<Call[]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Verdict[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [played, setPlayed] = useState(false);
  const [sel, setSel] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>("");
  const [picked, setPicked] = useState(-1);
  const [quizPicked, setQuizPicked] = useState(-1);
  const [coachQ, setCoachQ] = useState("");
  const [coachA, setCoachA] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { fetch("/api/calibration").then((r) => r.json()).then((d) => setCalls(d.calls || [])).catch(() => {}); }, []);

  const c: Call = calls[idx] || ({ type: "vibe", call_id: "", sec: 1, explain: "", turns: [] } as Call);
  const isVibe = c.type === "vibe";
  const done = results.length;
  const ptsSum = results.reduce((a, v) => a + pts(v), 0);

  function stopAudio() { const a = audioRef.current; if (a) { a.pause(); } }

  function play() {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    if (progress >= 100) { a.currentTime = 0; setProgress(0); }
    a.play().then(() => setPlaying(true)).catch(() => {
      // audio unavailable (proxy/CORS) — fall back to a timed reveal so the flow still works
      setPlaying(true);
      const started = progress;
      const iv = setInterval(() => {
        setProgress((p) => {
          const np = Math.min(100, p + (100 * 100) / (Math.max(4, c.sec) * 1000) * 1);
          if (np >= 100) { clearInterval(iv); setPlaying(false); setPlayed(true); return 100; }
          return np;
        });
      }, 100);
      void started;
    });
  }

  function onTime() { const a = audioRef.current; if (!a || !a.duration) return; setProgress(Math.min(100, (a.currentTime / a.duration) * 100)); }
  function onEnded() { setPlaying(false); setPlayed(true); setProgress(100); }

  function startCall(i: number) { stopAudio(); setPlaying(false); setProgress(0); setPlayed(false); setSel(0); setVerdict(""); setPicked(-1); setIdx(i); setScreen("call"); }
  function finish(v: Verdict, p: number) { stopAudio(); setVerdict(v); setPicked(p); setResults((r) => [...r, v]); setScreen("feedback"); setPlaying(false); setQuizPicked(-1); setCoachQ(""); setCoachA(""); setCoachBusy(false); }

  async function askCoach() {
    const q = coachQ.trim(); if (!q || coachBusy) return;
    setCoachBusy(true); setCoachA("");
    const ctx = isVibe
      ? "Task: rate the call 1-4 (1 major failure, 2 noticeably broken, 3 mostly okay, 4 clean call). Transcript: " + (c.turns || []).map((t) => t.who + ": " + t.text).join(" | ") + ". Expert rating: " + c.expert + ". Expert reasoning: " + c.explain + ". Trainee rated: " + sel + " (verdict: " + verdict + ")."
      : "Task: check what the ASR wrote against the audio. Agent said: \"" + c.context + "\". User actually said: \"" + c.heard + "\". ASR wrote: \"" + (c.asr || []).join(" ") + "\". " + ((c.wrongIdx ?? -1) >= 0 ? ("The wrong word is \"" + (c.asr || [])[c.wrongIdx!] + "\"; golden transcript: \"" + c.golden + "\".") : "The ASR was correct.") + " Expert note: " + c.explain + ". Trainee verdict: " + verdict + ".";
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: ctx, question: q }) });
      const d = await r.json(); setCoachA(d.text || "Coach is unavailable — re-read the expert reasoning above."); setCoachBusy(false);
    } catch { setCoachA("Coach is unavailable — re-read the expert reasoning above."); setCoachBusy(false); }
  }

  const canApply = langs.length > 0 && phone.replace(/\D/g, "").length >= 10;
  const agreementLabel = done ? Math.round((ptsSum / done) * 100) + "%" : "—";
  const posSec = Math.round((progress / 100) * c.sec);
  const fmt = (x: number) => Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0");
  const pct = Math.round((ptsSum / 10) * 100);
  const counts = { match: 0, close: 0, miss: 0 };
  results.forEach((r) => { counts[r as "match" | "close" | "miss"]++; });

  const pillMap: Record<string, [string, string, string]> = { match: ["✓ matched", "#e7f4ee", GREEN], close: ["≈ off by one", "#faf3e3", AMBER], miss: ["✗ missed", "#fbeaea", RED] };

  function Row({ i }: { i: number }) {
    const cc = calls[i]; if (!cc) return null;
    const st = i < done ? results[i] : (i === done ? "next" : "locked");
    const cur = screen === "call" && idx === i;
    const p = pillMap[st as string];
    const clickable = st === "next" && !cur;
    return (
      <div onClick={() => clickable && startCall(i)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, border: `1.5px solid ${(st === "next" || cur) ? GREEN : "transparent"}`, background: (st === "next" || cur) ? "#f2faf6" : "transparent", borderRadius: 8, padding: "6px 8px", cursor: st === "next" ? "pointer" : "default" }}>
        <span style={{ color: i < done ? GREEN : (st === "next" ? GREEN : "#c3ccd4") }}>{i < done ? "✓" : (st === "next" ? "▶" : "○")}</span>
        <span className={mono.className} style={{ color: st === "locked" ? "#93a1ae" : INK, fontSize: 11.5 }}>call {i + 1} · 0:{String(cc.sec).padStart(2, "0")}</span>
        <span style={{ flex: 1 }} />
        <span style={{ borderRadius: 999, background: p ? p[1] : (st === "next" ? "#e7f4ee" : "transparent"), color: p ? p[2] : (st === "next" ? GREEN : "#93a1ae"), padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
          {p ? p[0] : (st === "next" ? (cur ? "in progress" : "next up →") : "")}
        </span>
      </div>
    );
  }

  const inWork = screen !== "apply";
  // vibe turns reveal progressively with playback
  const nTurns = (c.turns || []).length;
  const visTurns = isVibe ? (c.turns || []).filter((_, i) => progress >= ((i + 1) / (nTurns + 1)) * 100 || played) : [];

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#e8ecef", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 22, boxSizing: "border-box" }}>
      <audio ref={audioRef} onTimeUpdate={onTime} onEnded={onEnded} style={{ display: "none" }} src={c.recording_url ? `/api/audio?url=${encodeURIComponent(c.recording_url.startsWith("http") ? c.recording_url : CANON + c.call_id)}` : undefined} />
      <div style={{ width: "100%", maxWidth: 1160, background: "#f5f7f9", borderRadius: 16, border: "1px solid #e2e8ee", boxShadow: "0 10px 34px rgba(16,24,31,.1)", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 720 }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "13px 20px" }}>
          <span style={{ width: 17, height: 17, borderRadius: 4, background: GREEN }} />
          <span className={grotesk.className} style={{ fontWeight: 700, fontSize: 16 }}>realloop</span>
          <span style={{ borderRadius: 999, background: "#eef2f6", padding: "4px 12px", fontSize: 12, color: "#4d5a66", fontWeight: 600 }}>
            {screen === "apply" ? "Become a reviewer" : screen === "result" ? "Result" : "Calibration · " + done + "/10"}
          </span>
          <span style={{ flex: 1 }} />
          {inWork && screen !== "result" && done > 0 && (
            <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>your agreement: {agreementLabel}</span>
          )}
          <a href="/marketplace" style={{ fontSize: 12.5, color: MUT, textDecoration: "none" }}>Marketplace</a>
        </div>

        {/* APPLY */}
        {screen === "apply" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 28, padding: "30px 36px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.12, letterSpacing: "-.4px" }}>Review AI phone calls.<br />Work from anywhere, anytime.</div>
                <div style={{ fontSize: 14, color: MUT, marginTop: 7, maxWidth: 480 }}>A laptop or phone and headphones are all you need. No resume, no interview — your agreement score decides your tier and pay.</div>
              </div>
              <div style={{ ...card, padding: 16, display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22, color: GREEN }}>₹300/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 2 · from day one</div></div>
                <div style={{ flex: 1, borderLeft: "1px solid #eef2f6", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22, color: GREEN }}>₹500/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 1 · high agreement</div></div>
                <div style={{ flex: 1.1, borderLeft: "1px solid #eef2f6", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>₹2,000+</div><div style={{ fontSize: 11, color: MUT }}>top reviewers make / day · paid weekly</div></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "#4d5a66" }}>
                <div>1 · <b style={{ color: INK }}>Apply in 2 minutes</b> — the form on the right</div>
                <div>2 · <b style={{ color: INK }}>Rate 10 real calls</b> — the tool teaches you as you go</div>
                <div>3 · <b style={{ color: INK }}>Short onboarding</b> — 30 min on WhatsApp</div>
                <div>4 · <b style={{ color: INK }}>Your agreement score sets your tier and pay</b></div>
              </div>
            </div>
            <div style={{ ...card, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
              <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16 }}>Apply now</span>
              <Seg opts={["Reviewer", "Expert"]} cur={role} onPick={setRole} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Languages you speak</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((n) => {
                    const on = langs.includes(n);
                    return <span key={n} onClick={() => setLangs((s) => on ? s.filter((x) => x !== n) : [...s, n])} style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "4px 10px", fontSize: 11.5, cursor: "pointer" }}>{n}</span>;
                  })}
                </div>
              </div>
              <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Education</div><Seg opts={["12th", "Graduate", "Postgrad"]} cur={edu} onPick={setEdu} /></div>
              <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Hours per week</div><Seg opts={["<5", "5–15", "15+"]} cur={hours} onPick={setHours} /></div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Phone (WhatsApp)</div>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <div style={{ fontSize: 10, color: "#93a1ae", marginTop: 3 }}>Only for your login code and onboarding call. Never shown anywhere.</div>
              </div>
              <div onClick={() => canApply && setScreen("home")} style={{ height: 44, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: canApply ? 1 : 0.45 }}>Apply → your 10 calls are ready</div>
              <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>{canApply ? "No wait — calibration starts the moment you submit." : "Pick at least one language and enter a valid phone number."}</div>
            </div>
          </div>
        )}

        {/* WORK */}
        {inWork && (
          <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, padding: "16px 20px", flex: 1, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#e2e8ee" }}><div style={{ width: `${done * 10}%`, height: 7, borderRadius: 4, background: GREEN }} /></div>
                <span className={mono.className} style={{ fontSize: 12 }}>{done} / 10</span>
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Score the call</span><span style={{ fontSize: 10.5, color: MUT }}>vibe 1–4</span></div>
                {[0, 1, 2, 3, 4].map((i) => <Row key={i} i={i} />)}
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Fix the transcript</span><span style={{ fontSize: 10.5, color: MUT }}>what the AI heard</span></div>
                {[5, 6, 7, 8, 9].map((i) => <Row key={i} i={i} />)}
              </div>
              <div style={{ fontSize: 11, color: "#93a1ae", lineHeight: 1.45, padding: "0 3px" }}>Real production calls, graded by our experts. Feedback is instant — this is the same tool you&apos;ll use for paid work.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {screen === "home" && (
                <div style={{ ...card, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>Your 10 calibration calls</div>
                  <div style={{ fontSize: 13.5, color: MUT, maxWidth: 420 }}>Real calls our experts already graded — 5 vibe scores, then 5 transcript checks. Your agreement with the expert decides your tier.</div>
                  <div onClick={() => { calls.length ? (done >= 10 ? setScreen("result") : startCall(done)) : null; }} style={{ height: 46, minWidth: 240, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0 22px", opacity: calls.length ? 1 : 0.5 }}>{!calls.length ? "Loading calls…" : done >= 10 ? "See your result →" : "Start call " + (done + 1) + " ▶"}</div>
                </div>
              )}

              {screen === "call" && (
                <>
                  <div style={{ ...card, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={play} style={{ width: 36, height: 36, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", flex: "none" }}>{playing ? "❚❚" : (played ? "↻" : "▶")}</div>
                      <span style={{ fontSize: 13 }}>Call <b>{idx + 1}</b> of 10 · <span style={{ color: MUT }}>{isVibe ? "score the call" : "fix the transcript"}</span></span>
                      <span className={mono.className} style={{ fontSize: 10.5, color: "#93a1ae" }}>· {c.call_id.slice(0, 8)}</span>
                      <span style={{ flex: 1 }} />
                      <span className={mono.className} style={{ fontSize: 12, color: MUT }}>{fmt(posSec)} / {fmt(c.sec)}</span>
                    </div>
                    <div style={{ height: 44, borderRadius: 8, background: "#f5f7f9", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, right: 0, top: 5, height: 15, background: "repeating-linear-gradient(90deg,#0e8a5f 0 2px,transparent 2px 6px)", opacity: 0.45 }} />
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: 5, height: 15, background: "repeating-linear-gradient(90deg,#5b8def 0 2px,transparent 2px 7px)", opacity: 0.45 }} />
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${progress}%`, width: 2, background: INK }} />
                    </div>
                  </div>

                  {isVibe ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
                      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 7, minHeight: 250 }}>
                        <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Live transcript</span>
                        {visTurns.map((t, i) => (
                          <div key={i} style={{ alignSelf: t.who === "user" ? "flex-end" : (t.who === "sys" ? "center" : "flex-start"), maxWidth: "80%", background: t.who === "user" ? "#e7f4ee" : (t.who === "sys" ? "transparent" : "#f5f7f9"), color: t.who === "sys" ? "#93a1ae" : INK, border: `1px solid ${t.who === "sys" ? "transparent" : "#e2e8ee"}`, borderRadius: 11, padding: "7px 11px", fontSize: 13.5, fontStyle: t.who === "sys" ? "italic" : "normal" }}>
                            <span style={{ display: "block", fontSize: 9.5, color: t.who === "user" ? BLUE : GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.who === "sys" ? "—" : t.who}</span>{t.text}
                          </div>
                        ))}
                        {!played && <span style={{ fontSize: 11, color: "#c3ccd4", marginTop: "auto" }}>transcript reveals as the call plays</span>}
                      </div>
                      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 15 }}>Overall vibe score</span>
                        <div style={{ fontSize: 11.5, color: "#93a1ae" }}>{played ? "Pick a score, then submit." : (playing ? "Listening…" : "▶ Play the call — scoring unlocks at the end")}</div>
                        <div style={{ display: "flex", gap: 7 }}>
                          {[1, 2, 3, 4].map((n) => (
                            <div key={n} onClick={() => { if (played) setSel(n); }} style={{ flex: 1, height: 62, borderRadius: 10, border: `1.5px solid ${sel === n ? GREEN : "#d6dee6"}`, background: sel === n ? GREEN : "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", opacity: played ? 1 : 0.4 }}>
                              <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 19, color: sel === n ? "#fff" : INK }}>{n}</span>
                              <span style={{ fontSize: 9, color: sel === n ? "#c9e9db" : MUT, textAlign: "center", lineHeight: 1.15 }}>{SCORE_LABELS[n]}</span>
                            </div>
                          ))}
                        </div>
                        <div onClick={() => { if (played && sel > 0) { const d = Math.abs(sel - (c.expert || 0)); finish(d === 0 ? "match" : d === 1 ? "close" : "miss", -1); } }} style={{ height: 44, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: (played && sel > 0) ? 1 : 0.45 }}>Submit score</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
                      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8, minHeight: 220 }}>
                        <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Conversation</span>
                        <div style={{ alignSelf: "flex-start", maxWidth: "80%", background: "#fff", border: "1px solid #e2e8ee", borderRadius: 11, padding: "7px 11px", fontSize: 13.5 }}>
                          <span style={{ display: "block", fontSize: 9.5, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>agent</span>{c.context}
                        </div>
                        {(playing || played) && (
                          <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "#e7f4ee", borderRadius: 11, padding: "7px 11px", fontSize: 13.5, fontStyle: "italic" }}>
                            <span style={{ display: "block", fontSize: 9.5, color: BLUE, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", fontStyle: "normal" }}>you hear the user say</span>&quot;{c.heard}&quot;
                          </div>
                        )}
                      </div>
                      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, opacity: played ? 1 : 0.45 }}>
                        <div style={{ fontSize: 12.5, color: MUT }}>The ASR wrote this. <b style={{ color: INK }}>Click the wrong word</b> — or confirm it&apos;s correct.</div>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {(c.asr || []).map((w, i) => (
                            <span key={i} onClick={() => { if (played) finish(i === c.wrongIdx ? "match" : "miss", i); }} style={{ border: "1.5px solid #d6dee6", background: "#fff", borderRadius: 7, padding: "7px 12px", fontSize: 14.5, cursor: "pointer" }}>{w}</span>
                          ))}
                        </div>
                        <div onClick={() => { if (played) finish((c.wrongIdx ?? -1) < 0 ? "match" : "miss", -2); }} style={{ height: 40, borderRadius: 9, border: `1.5px solid ${GREEN}`, color: GREEN, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✓ Transcript is correct</div>
                        <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>{played ? "" : "Play the turn first — answering unlocks at the end"}</div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {screen === "feedback" && (() => {
                const e = c.expert || 0, y = sel;
                let fbColor = GREEN, fbBg = "#f2faf6", fbBorder = GREEN;
                if (verdict === "close") { fbColor = AMBER; fbBg = "#fffdf7"; fbBorder = "#d99a2b"; }
                if (verdict === "miss") { fbColor = RED; fbBg = "#fffafa"; fbBorder = RED; }
                let fbTitle = "";
                if (isVibe) {
                  fbTitle = verdict === "match" ? "✓ Matched the expert — it’s a " + e : verdict === "close" ? "≈ Close — expert rated " + e + ", you rated " + y : "✗ Off — expert rated " + e + ", you rated " + y;
                } else {
                  fbTitle = verdict === "match"
                    ? ((c.wrongIdx ?? -1) < 0 ? "✓ Right — the transcript was correct" : "✓ Caught it — “" + (c.asr || [])[c.wrongIdx!] + "” was wrong")
                    : (picked === -2 ? "✗ There was an error — “" + (c.asr || [])[c.wrongIdx!] + "” is wrong" : ((c.wrongIdx ?? -1) < 0 ? "✗ The transcript was actually correct" : "✗ Not that word — the error was “" + (c.asr || [])[c.wrongIdx!] + "”"));
                }
                const showTrain = verdict !== "match";
                const qz = isVibe ? vibeQuiz(e) : transQuiz((c.wrongIdx ?? -1) >= 0);
                const praise = PRAISE[idx % PRAISE.length];
                const nextBlocked = showTrain && quizPicked < 0;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 640 }}>
                    <div style={{ background: fbBg, border: `1.5px solid ${fbBorder}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
                      <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: fbColor }}>{fbTitle}</span>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{c.explain}</div>
                      {isVibe && (
                        <div style={{ display: "flex", gap: 7, fontSize: 12 }}>
                          <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, padding: "3px 11px", fontWeight: 600 }}>expert: {e} · {SCORE_LABELS[e] || ""}</span>
                          <span style={{ borderRadius: 999, background: "#eef2f6", color: "#4d5a66", padding: "3px 11px", fontWeight: 600 }}>you: {y} · {SCORE_LABELS[y] || ""}</span>
                        </div>
                      )}
                      {!isVibe && (
                        <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.6 }}>
                          <span style={{ color: MUT }}>ASR:</span> {(c.asr || []).join(" ")}<br /><span style={{ color: MUT }}>Golden:</span> <b style={{ color: GREEN }}>{c.golden}</b>
                        </div>
                      )}
                    </div>
                    {verdict !== "match" && (
                      <div style={{ background: "#f2faf6", border: "1px solid #bfe2d2", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.45 }}>
                        <b style={{ color: GREEN }}>✓ What you got right:</b> {praise}
                      </div>
                    )}
                    {showTrain && (
                      <div style={{ background: "#fff", border: `1.5px solid ${INK}`, borderRadius: 12, padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 13 }}><b>Quick check:</b> {qz.q}</span>
                        {qz.opts.map((o, i) => {
                          let bg = "#fff", border = "#d6dee6", color = INK;
                          if (quizPicked >= 0) { if (i === qz.correct) { bg = "#e7f4ee"; border = GREEN; color = GREEN; } else if (i === quizPicked) { bg = "#fbeaea"; border = RED; color = RED; } else { color = "#93a1ae"; } }
                          return <div key={i} onClick={() => { if (quizPicked < 0) setQuizPicked(i); }} style={{ border: `1.5px solid ${border}`, background: bg, color, borderRadius: 8, padding: "8px 11px", fontSize: 12.5, cursor: "pointer" }}>{o}</div>;
                        })}
                        {quizPicked >= 0 && (
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: quizPicked === qz.correct ? GREEN : AMBER }}>{quizPicked === qz.correct ? "✓ Locked in — " + qz.note : "Not quite. " + qz.note}</div>
                        )}
                      </div>
                    )}
                    <div style={{ ...card, padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: MUT }}><b style={{ color: INK }}>Still unsure? Ask the coach</b> — it knows this exact call.</span>
                      <div style={{ display: "flex", gap: 7 }}>
                        <input value={coachQ} onChange={(e2) => setCoachQ(e2.target.value)} onKeyDown={(e2) => { if (e2.key === "Enter") askCoach(); }} placeholder="e.g. why is this a 2 and not a 3?" style={{ flex: 1, border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }} />
                        <div onClick={askCoach} style={{ minWidth: 58, borderRadius: 8, background: INK, color: "#fff", fontWeight: 600, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{coachBusy ? "…" : "Ask"}</div>
                      </div>
                      {coachA && (
                        <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5 }}>
                          <span style={{ display: "block", fontSize: 9.5, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>coach</span>{coachA}
                        </div>
                      )}
                    </div>
                    <div onClick={() => { if (!nextBlocked) { done >= 10 ? setScreen("result") : startCall(done); } }} style={{ height: 46, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: nextBlocked ? 0.45 : 1 }}>{done >= 10 ? "See your result →" : "Got it · call " + (done + 1) + " →"}</div>
                  </div>
                );
              })()}

              {screen === "result" && (
                <div style={{ ...card, borderRadius: 14, padding: 34, display: "flex", flexDirection: "column", gap: 13, alignItems: "center", textAlign: "center", maxWidth: 560, alignSelf: "center", width: "100%", boxSizing: "border-box" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 21 }}>Calibration complete</div>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 56, color: pct >= PASS ? GREEN : AMBER, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 13, color: MUT }}>agreement with the expert · {counts.match} matched · {counts.close} off by one · {counts.miss} missed</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {results.map((r, i) => <span key={i} style={{ width: 26, height: 8, borderRadius: 4, background: r === "match" ? GREEN : r === "close" ? "#d99a2b" : RED }} />)}
                  </div>
                  {pct >= PASS ? (
                    <div style={{ background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                      <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 17, color: GREEN }}>Tier 2 unlocked · ₹300/hr</span>
                      <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>One step left: a 30-minute onboarding call. Then real, paid work starts. Hold ≥75% across 2 real batches → Tier 1 at ₹500/hr.</span>
                      <a href="https://wa.me/919999999999?text=Hi%20realloop%2C%20I%20passed%20calibration%20and%20want%20to%20book%20onboarding" target="_blank" rel="noopener noreferrer" style={{ height: 42, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: 5, textDecoration: "none" }}>Book onboarding on WhatsApp →</a>
                    </div>
                  ) : (
                    <div style={{ background: "#fffdf7", border: "1.5px solid #d99a2b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                      <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: AMBER }}>Not yet — you need {PASS}%</span>
                      <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>Retake in 7 days with 10 new calls. Re-read the expert feedback on the calls you missed — that&apos;s exactly what the retake tests.</span>
                    </div>
                  )}
                  <span onClick={() => { stopAudio(); setScreen("apply"); setIdx(0); setResults([]); setPlaying(false); setProgress(0); setPlayed(false); setSel(0); setVerdict(""); setPicked(-1); setQuizPicked(-1); setPhone(""); }} style={{ fontSize: 12, color: MUT, cursor: "pointer", textDecoration: "underline" }}>restart</span>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
