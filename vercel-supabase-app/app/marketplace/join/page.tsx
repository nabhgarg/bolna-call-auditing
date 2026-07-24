"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

// Reviewer onboarding + calibration prototype (from Reviewer Onboarding
// Prototype (Desktop).dc.html). Apply → 10 calibration calls (5 vibe-score,
// 5 transcript-fix) in the SAME workbench UI reviewers use for paid work →
// instant expert feedback + quiz + live AI coach → agreement score sets tier.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", RED = "#d6484f", AMBER = "#b07a15", BLUE = "#5b8def";
const PASS = 75, FAST = true;

type Turn = { p: number; who: string; text: string };
type Call = {
  type: "vibe" | "trans"; sec: number; expert?: number; turns?: Turn[];
  context?: string; heard?: string; asr?: string[]; wrongIdx?: number; golden?: string;
  explain: string; praise: string;
};

const CALLS: Call[] = [
  { type: "vibe", sec: 48, expert: 4, turns: [
    { p: 4, who: "agent", text: "Namaste! Main Riya bol rahi hoon GreenKart se. Aapka kal ka COD order confirm karna tha." },
    { p: 38, who: "user", text: "haan haan, confirm kar do" },
    { p: 70, who: "agent", text: "Done! Order kal 5 baje tak deliver hoga. Dhanyavaad!" }],
    explain: "Greeting, confirmation, close — no wasted turns, natural Hindi. This is what a clean call sounds like.",
    praise: "you listened to the whole call before scoring — keep that habit." },
  { type: "vibe", sec: 67, expert: 2, turns: [
    { p: 4, who: "agent", text: "Aapka order confirm kar doon?" },
    { p: 25, who: "user", text: "haan bola na, kar do" },
    { p: 48, who: "agent", text: "Ji. Kya main aapka order confirm kar doon?" },
    { p: 72, who: "agent", text: "Aapka order confirm kar doon?" },
    { p: 92, who: "sys", text: "user hangs up" }],
    explain: "The agent asked the same question 3 times after the user already said yes. A repetition loop is “noticeably broken” — a 2, even when the voice sounds fine.",
    praise: "the voice itself WAS natural — but score what the agent does, not how it sounds." },
  { type: "vibe", sec: 41, expert: 1, turns: [
    { p: 4, who: "agent", text: "Hello! Shall we continue in English?" },
    { p: 28, who: "user", text: "हिंदी में बात करो" },
    { p: 55, who: "agent", text: "Great! So your booking is confirmed for tomorrow at…" },
    { p: 85, who: "sys", text: "user hangs up" }],
    explain: "The user asked for Hindi and the agent kept going in English until they hung up. The task failed completely — that is a 1, major failure.",
    praise: "you caught that something was off — now weigh how badly it broke the call." },
  { type: "vibe", sec: 72, expert: 2, turns: [
    { p: 4, who: "agent", text: "…toh kya main aapke liye yeh plan activate kar doon?" },
    { p: 30, who: "user", text: "abhi busy hoon, call me later" },
    { p: 58, who: "agent", text: "Sure! Toh main bata rahi thi, is plan mein aapko milta hai…" },
    { p: 90, who: "sys", text: "user hangs up" }],
    explain: "“Call me later” is a refusal — the agent should end the call politely. Restarting the pitch instead makes it noticeably broken: a 2.",
    praise: "you noticed the language and tone were fine — the failure here is behavioral, not vocal." },
  { type: "vibe", sec: 38, expert: 3, turns: [
    { p: 4, who: "agent", text: "Aapki EMI kal due hai. Kya payment ho jayegi?" },
    { p: 35, who: "user", text: "haan kal kar dungi" },
    { p: 64, who: "agent", text: "Theek hai. … Payment kal. … Okay. Dhanyavaad." }],
    explain: "Task done, nothing broke — but the closing was robotic with awkward pauses. Not broken, not clean: “mostly okay”, a 3.",
    praise: "good instinct that it was neither broken nor clean — 3s are the hardest to call." },
  { type: "trans", sec: 9, context: "aap abhi kaam par hain?", heard: "हां दीदी, काम कर रही हूं", asr: ["हां", "दीदी", "कॉम", "कर", "रही", "हूं"], wrongIdx: 2, golden: "हां दीदी, काम कर रही हूं",
    explain: "The user said काम (kaam — work); the ASR wrote कॉम (kom). One vowel changes the meaning — exactly what golden transcripts exist to fix.",
    praise: "you replayed before answering — always do that on short turns." },
  { type: "trans", sec: 6, context: "order confirm kar doon?", heard: "yes confirm kar do", asr: ["yes", "confirm", "kar", "do"], wrongIdx: -1, golden: "yes confirm kar do",
    explain: "The ASR got this one right. Saying “correct” when it IS correct matters as much as catching errors — false alarms poison the dataset.",
    praise: "careful listening — not every turn has an error." },
  { type: "trans", sec: 8, context: "kaunsi jewellery pasand aayi aapko?", heard: "Giva का नया necklace", asr: ["जीवा", "दिवा", "का", "नया", "necklace"], wrongIdx: 1, golden: "Giva का नया necklace",
    explain: "“Giva” is a brand name — the ASR heard an extra word दिवा that was never said. Brand and proper-noun misses are the #1 reason clients buy this dataset.",
    praise: "you checked the words against the audio one by one." },
  { type: "trans", sec: 7, context: "kya aap abhi baat kar sakte hain?", heard: "nahi didi, main busy hoon", asr: ["nahi", "didi", "main", "visi", "hoon"], wrongIdx: 3, golden: "nahi didi, main busy hoon",
    explain: "The user said the English word “busy” — the ASR wrote “visi”. English words inside Hindi sentences trip ASR constantly; they stay Roman in the golden transcript.",
    praise: "good ear for code-switching — that is a paid skill here." },
  { type: "trans", sec: 5, context: "toh main confirm kar deti hoon?", heard: "haan theek hai", asr: ["haan", "theek", "hai"], wrongIdx: -1, golden: "haan theek hai",
    explain: "Correct again. You can now tell both — errors AND clean turns. That is what “calibrated” means.",
    praise: "steady judgment on the last call." }
];

const QUIZZES = [
  { q: "What makes this a 4, not a 3?", opts: ["It was short", "No wasted turns and a natural close", "The agent spoke Hindi"], correct: 1, note: "a clean call = task done + nothing awkward. Length alone never sets the score." },
  { q: "The user already said yes. What should the agent do next?", opts: ["Confirm once and end the call", "Ask once more to be sure", "Summarize the whole order again"], correct: 0, note: "one confirmation is enough — every repeat after a yes pushes the score down." },
  { q: "User asks for Hindi, agent stays in English. That is…", opts: ["A 2 — minor slip", "A 3 — the content was still right", "A 1 — the task completely failed"], correct: 2, note: "if the user cannot understand the call, nothing else matters." },
  { q: "“Call me later” means…", opts: ["Ask why they are busy", "End politely and schedule a callback", "Keep pitching — they are still on the line"], correct: 1, note: "a refusal ends the call. Continuing the pitch is what broke this one." },
  { q: "Task done, but robotic pauses. What is the score?", opts: ["3 — mostly okay", "4 — task done is all that counts", "2 — pauses make it broken"], correct: 0, note: "flow problems cost polish (a 3), not function (a 2)." },
  { q: "Why does काम vs कॉम matter?", opts: ["It is only a spelling style", "One vowel changes the meaning the model learns", "It does not — they sound similar"], correct: 1, note: "the golden transcript must say what was MEANT, word for word." },
  { q: "Marking a correct transcript as wrong…", opts: ["Is safer than missing an error", "Does not really matter", "Poisons the dataset with false errors"], correct: 2, note: "false alarms are as costly as misses — confirm clean turns confidently." },
  { q: "Brand names like “Giva” should be…", opts: ["Transliterated to Devanagari", "Kept exactly as the brand writes it", "Skipped if unclear"], correct: 1, note: "brands and proper nouns keep their canonical spelling — that is what clients fine-tune on." },
  { q: "English words inside Hindi speech are written…", opts: ["In Roman, as spoken", "Always in Devanagari", "Left out of the transcript"], correct: 0, note: "write each word in the script of the language the speaker used." },
  { q: "A calibrated reviewer is one who…", opts: ["Finds an error in every call", "Rates as fast as possible", "Catches errors AND confirms clean turns"], correct: 2, note: "both directions count in your agreement score." }
];

const MOMENTS: Array<{ t: string; quote: string } | null> = [
  { t: "0:42", quote: "Done! Order kal 5 baje tak deliver hoga." },
  { t: "0:48", quote: "Ji. Kya main aapka order confirm kar doon?" },
  { t: "0:22", quote: "हिंदी में बात करो" },
  { t: "0:30", quote: "abhi busy hoon, call me later" },
  { t: "0:24", quote: "Theek hai. … Payment kal. … Okay." },
  null, null, null, null, null
];

const SCORE_LABELS: Record<number, string> = { 1: "Major failure", 2: "Noticeably broken", 3: "Mostly okay", 4: "Clean call" };
type Verdict = "match" | "close" | "miss" | "";
const pts = (v: Verdict) => (v === "match" ? 1 : v === "close" ? 0.5 : 0);

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
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const c = CALLS[idx];
  const isVibe = c.type === "vibe";
  const done = results.length;
  const ptsSum = results.reduce((a, v) => a + pts(v), 0);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function clearT() { if (timer.current) { clearInterval(timer.current); timer.current = null; } }
  const durMs = () => (FAST ? 6000 : c.sec * 1000);

  // Completion handled here (not inside the setState updater — StrictMode
  // double-invokes updaters, so side effects there clear the timer mid-play).
  useEffect(() => {
    if (progress >= 100 && playing) { clearT(); setPlaying(false); setPlayed(true); }
  }, [progress, playing]);

  function play() {
    if (playing) { clearT(); setPlaying(false); return; }
    const from = progress >= 100 ? 0 : progress;
    clearT(); setPlaying(true); setProgress(from);
    const step = (100 * 50) / durMs();
    timer.current = setInterval(() => {
      setProgress((p) => Math.min(100, p + step));
    }, 50);
  }

  function startCall(i: number) { clearT(); setPlaying(false); setProgress(0); setPlayed(false); setSel(0); setVerdict(""); setPicked(-1); setIdx(i); setScreen("call"); }
  function finish(v: Verdict, p: number) { clearT(); setVerdict(v); setPicked(p); setResults((r) => [...r, v]); setScreen("feedback"); setPlaying(false); setQuizPicked(-1); setCoachQ(""); setCoachA(""); setCoachBusy(false); }

  async function askCoach() {
    const q = coachQ.trim();
    if (!q || coachBusy) return;
    setCoachBusy(true); setCoachA("");
    const ctx = isVibe
      ? "Task: rate the call 1-4 (1 major failure, 2 noticeably broken, 3 mostly okay, 4 clean call). Transcript: " + (c.turns || []).map((t) => t.who + ": " + t.text).join(" | ") + ". Expert rating: " + c.expert + ". Expert reasoning: " + c.explain + ". Trainee rated: " + sel + " (verdict: " + verdict + ")."
      : "Task: check what the ASR wrote against the audio. Agent said: \"" + c.context + "\". User actually said: \"" + c.heard + "\". ASR wrote: \"" + (c.asr || []).join(" ") + "\". " + ((c.wrongIdx ?? -1) >= 0 ? ("The wrong word is \"" + (c.asr || [])[c.wrongIdx!] + "\"; golden transcript: \"" + c.golden + "\".") : "The ASR was correct.") + " Expert note: " + c.explain + ". Trainee verdict: " + verdict + ".";
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: ctx, question: q }) });
      const d = await r.json();
      setCoachA(d.text || "Coach is unavailable right now — re-read the expert reasoning above."); setCoachBusy(false);
    } catch { setCoachA("Coach is unavailable right now — re-read the expert reasoning above."); setCoachBusy(false); }
  }

  const canApply = langs.length > 0 && phone.replace(/\D/g, "").length >= 10;
  const agreementLabel = done ? Math.round((ptsSum / done) * 100) + "%" : "—";
  const posSec = Math.round((progress / 100) * c.sec);
  const fmt = (x: number) => Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0");
  const threshold = PASS;
  const pct = Math.round((ptsSum / 10) * 100);
  const counts = { match: 0, close: 0, miss: 0 };
  results.forEach((r) => { counts[r as "match" | "close" | "miss"]++; });

  const pillMap: Record<string, [string, string, string]> = { match: ["✓ matched", "#e7f4ee", GREEN], close: ["≈ off by one", "#faf3e3", AMBER], miss: ["✗ missed", "#fbeaea", RED] };

  function Row({ i }: { i: number }) {
    const cc = CALLS[i];
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

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };
  const inWork = screen !== "apply";

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#e8ecef", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 22, boxSizing: "border-box" }}>
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

        {/* WORK: home / call / feedback / result */}
        {inWork && (
          <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, padding: "16px 20px", flex: 1, alignItems: "start" }}>
            {/* left rail */}
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
              <div style={{ fontSize: 11, color: "#93a1ae", lineHeight: 1.45, padding: "0 3px" }}>Feedback is instant on every call. Mistakes here are how you learn — this is the same tool you&apos;ll use for paid work.</div>
            </div>

            {/* right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* HOME picker */}
              {screen === "home" && (
                <div style={{ ...card, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>Your 10 calibration calls</div>
                  <div style={{ fontSize: 13.5, color: MUT, maxWidth: 420 }}>Work through them in order — 5 vibe scores, then 5 transcript checks. Your agreement with the expert decides your tier.</div>
                  <div onClick={() => { done >= 10 ? setScreen("result") : startCall(done); }} style={{ height: 46, minWidth: 240, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0 22px" }}>{done >= 10 ? "See your result →" : "Start call " + (done + 1) + " ▶"}</div>
                </div>
              )}

              {/* CALL: player + vibe/trans */}
              {screen === "call" && (
                <>
                  <div style={{ ...card, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={play} style={{ width: 36, height: 36, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", flex: "none" }}>{playing ? "❚❚" : (played ? "↻" : "▶")}</div>
                      <span style={{ fontSize: 13 }}>Call <b>{idx + 1}</b> of 10 · <span style={{ color: MUT }}>{isVibe ? "score the call" : "fix the transcript"}</span></span>
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
                        {(c.turns || []).filter((t) => progress >= t.p).map((t, i) => (
                          <div key={i} style={{ alignSelf: t.who === "user" ? "flex-end" : (t.who === "sys" ? "center" : "flex-start"), maxWidth: "80%", background: t.who === "user" ? "#e7f4ee" : (t.who === "sys" ? "transparent" : "#f5f7f9"), color: t.who === "sys" ? "#93a1ae" : INK, border: `1px solid ${t.who === "sys" ? "transparent" : "#e2e8ee"}`, borderRadius: 11, padding: "7px 11px", fontSize: 13.5, fontStyle: t.who === "sys" ? "italic" : "normal" }}>
                            <span style={{ display: "block", fontSize: 9.5, color: t.who === "user" ? BLUE : GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.who === "sys" ? "—" : t.who}</span>{t.text}
                          </div>
                        ))}
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

              {/* FEEDBACK */}
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
                const moment = MOMENTS[idx];
                const qz = QUIZZES[idx];
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
                    {verdict !== "match" && c.praise && (
                      <div style={{ background: "#f2faf6", border: "1px solid #bfe2d2", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.45 }}>
                        <b style={{ color: GREEN }}>✓ What you got right:</b> {c.praise}
                      </div>
                    )}
                    {showTrain && (
                      <>
                        {moment && (
                          <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, padding: "11px 13px", fontSize: 12.5, display: "flex", gap: 9, alignItems: "baseline" }}>
                            <span className={mono.className} style={{ color: AMBER, fontSize: 11 }}>@{moment.t}</span>
                            <span>&quot;{moment.quote}&quot; <span style={{ color: "#93a1ae" }}>— the moment that sets the score</span></span>
                          </div>
                        )}
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
                      </>
                    )}
                    {/* coach */}
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

              {/* RESULT */}
              {screen === "result" && (
                <div style={{ ...card, borderRadius: 14, padding: 34, display: "flex", flexDirection: "column", gap: 13, alignItems: "center", textAlign: "center", maxWidth: 560, alignSelf: "center", width: "100%", boxSizing: "border-box" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 21 }}>Calibration complete</div>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 56, color: pct >= threshold ? GREEN : AMBER, lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 13, color: MUT }}>agreement with the expert · {counts.match} matched · {counts.close} off by one · {counts.miss} missed</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {results.map((r, i) => <span key={i} style={{ width: 26, height: 8, borderRadius: 4, background: r === "match" ? GREEN : r === "close" ? "#d99a2b" : RED }} />)}
                  </div>
                  {pct >= threshold ? (
                    <div style={{ background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                      <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 17, color: GREEN }}>Tier 2 unlocked · ₹300/hr</span>
                      <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>One step left: a 30-minute onboarding call. Then real, paid work starts. Hold ≥75% across 2 real batches → Tier 1 at ₹500/hr.</span>
                      <a href="https://wa.me/919999999999?text=Hi%20realloop%2C%20I%20passed%20calibration%20and%20want%20to%20book%20onboarding" target="_blank" rel="noopener noreferrer" style={{ height: 42, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: 5, textDecoration: "none" }}>Book onboarding on WhatsApp →</a>
                    </div>
                  ) : (
                    <div style={{ background: "#fffdf7", border: "1.5px solid #d99a2b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                      <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: AMBER }}>Not yet — you need {threshold}%</span>
                      <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>Retake in 7 days with 10 new calls. Re-read the expert feedback on the calls you missed — that&apos;s exactly what the retake tests.</span>
                    </div>
                  )}
                  <span onClick={() => { clearT(); setScreen("apply"); setIdx(0); setResults([]); setPlaying(false); setProgress(0); setPlayed(false); setSel(0); setVerdict(""); setPicked(-1); setQuizPicked(-1); setPhone(""); }} style={{ fontSize: 12, color: MUT, cursor: "pointer", textDecoration: "underline" }}>restart prototype</span>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
