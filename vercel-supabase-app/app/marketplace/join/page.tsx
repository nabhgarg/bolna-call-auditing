"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED, AMBER, card } from "../../../lib/ui";

// Reviewer onboarding + screening assignment. Apply -> 5 real judgment-heavy
// questions across the two core reviewer tools: transcription review (the exact
// /transcribe segment-card UI) and pronunciation audit (the exact issue-form
// UI). Instant expert feedback + live coach. Real brand/city names kept (this
// is the reviewer-side training content, not client-facing analytics).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const PASS = 75;
const CANON = "https://api.bolna.ai/recordings/call/";

// transcription-tool palette (matches the real /transcribe workbench)
const T_GREEN = "#1f7a5c", T_ORANGE = "#c05621", T_SLATE = "#4a5568", T_RED = "#b03636", T_AMBER = "#b7791f";

type Turn = { who: string; text: string };
type Anchor = { text: string; s: number; e: number };
type Seg = { s: number; e: number } | null;
type Trans = { type: "trans"; call_id: string; recording_url?: string; ts: string; context: string; asr: string; golden: string; wrongLang: string; isCorrect: boolean; explain: string; turns?: Turn[]; anchors?: Anchor[]; seg?: Seg };
type Pron = { type: "pron"; call_id: string; recording_url?: string; ts: string; content_tag: string; word_heard: string; options: string[]; explain: string; turns?: Turn[]; anchors?: Anchor[]; seg?: Seg };
type Iss = { type: "issue"; call_id: string; recording_url?: string; ts: string; setup: string; options: string[]; correct: string; explain: string; turns?: Turn[]; anchors?: Anchor[]; seg?: Seg };
type Q = Trans | Pron | Iss;
type Verdict = "match" | "miss" | "";

function tsSec(ts: string) { const [m, s] = String(ts || "0:0").split(":"); return Number(m) * 60 + Number(s || 0); }

// lifted from the real transcription workbench so this assignment IS the tool
type Tok = { src: string; out: string; converted: boolean };
const SHORTHAND: Record<string, string> = {
  u: "you", ur: "your", pls: "please", plz: "please", ok: "okay", k: "okay",
  tmrw: "tomorrow", thx: "thanks", bcoz: "because", bcz: "because", gud: "good", hv: "have", r: "are", y: "why"
};
function lint(text: string): string[] {
  const w: string[] = [];
  if (/\d+\.\d+/.test(text)) w.push("Decimal digits · write as spoken: \"two point two five\"");
  else if (/\d/.test(text)) w.push("Digits · write numbers as words (पांच / five)");
  for (const word of text.toLowerCase().split(/[^a-z0-9']+/)) if (SHORTHAND[word]) w.push(`"${word}" → "${SHORTHAND[word]}"`);
  return [...new Set(w)];
}
function goldOf(tokens: Tok[], roman: string) {
  return tokens.length ? tokens.map((t) => (t.converted ? t.out : t.src)).join(" ") : roman.trim();
}
function envelope(data: Float32Array, sampleRate: number, hop = 0.05) {
  const win = Math.round(sampleRate * hop);
  const out = new Float32Array(Math.ceil(data.length / win));
  for (let i = 0; i < out.length; i++) {
    let sum = 0; const a = i * win, b = Math.min(data.length, a + win);
    for (let j = a; j < b; j++) sum += data[j] * data[j];
    out[i] = Math.sqrt(sum / Math.max(1, b - a));
  }
  return { env: out, hop };
}
function buckets(env: Float32Array, n = 700) {
  const out = new Array(n).fill(0);
  const max = Math.max(...env, 0.0001);
  for (let i = 0; i < n; i++) out[i] = (env[Math.floor((i / n) * env.length)] || 0) / max;
  return out;
}

const JOBS_REVIEWER = [
  { t: "AI Call Reviewer", d: "Rate whole calls 1-4 and log where the agent broke · the highest-volume work.", pay: "₹28 / review" },
  { t: "AI Call Transcriptor", d: "Listen to a call and fix what the AI's speech-to-text got wrong · code-mixed Hindi/English.", pay: "₹120 / call" },
  { t: "Regional Language Expert", d: "Tamil, Telugu, Marathi, Bengali calls · review and transcribe in your language.", pay: "₹40 / review" },
  { t: "Text Annotator", d: "Judge AI chat and text outputs · correctness, tone, task completion. No audio needed.", pay: "₹18 / item" }
];
const JOBS_EXPERT = [
  { t: "Ground Truth Expert", d: "Set the answer key · your ratings become the hidden ground truth every reviewer is measured against.", pay: "per project" },
  { t: "Panel QA & Calibration", d: "Vet reviewer submissions, resolve disagreements, coach the panel back to accuracy.", pay: "₹700 / hr" },
  { t: "Use-case Onboarding", d: "Work with clients to define rubrics and train the panel on new use cases.", pay: "per use case" }
];

export default function Join() {
  const [screen, setScreen] = useState<"apply" | "work" | "result">("apply");
  const [role, setRole] = useState("Reviewer");
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [edu, setEdu] = useState("Graduate");
  const [hours, setHours] = useState("5-15");
  const [phone, setPhone] = useState("");
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(-1);
  const [results, setResults] = useState<Record<number, Verdict>>({});
  const [feedback, setFeedback] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [coachQ, setCoachQ] = useState(""); const [coachA, setCoachA] = useState(""); const [coachBusy, setCoachBusy] = useState(false);
  const [tKind, setTKind] = useState<"" | "correct" | "wrong" | "noise">("");
  const [tLang, setTLang] = useState("same");
  const [tText, setTText] = useState("");
  const [pTag, setPTag] = useState(""); const [pWord, setPWord] = useState("");
  const [iType, setIType] = useState(""); const [iExpl, setIExpl] = useState("");
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [tTokens, setTTokens] = useState<Tok[]>([]);
  const [altPick, setAltPick] = useState<{ ti: number; alts: string[]; loading: boolean } | null>(null);
  const [wave, setWave] = useState<{ agent: number[]; user: number[]; duration: number } | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const savedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const waveSrcRef = useRef("");
  const tTextRef = useRef("");

  useEffect(() => {
    fetch("/api/assignment").then((r) => r.json()).then((d) => setQs([
      ...(d.trans || []).map((x: any) => ({ ...x, type: "trans" })),
      ...(d.pron || []).map((x: any) => ({ ...x, type: "pron" })),
      ...(d.issue || []).map((x: any) => ({ ...x, type: "issue" }))
    ])).catch(() => {});
  }, []);

  const total = qs.length;
  const done = Object.keys(results).length;
  const ptsSum = Object.values(results).reduce((a, v) => a + (v === "match" ? 1 : 0), 0);
  const q: Q | undefined = idx >= 0 ? qs[idx] : undefined;

  function play(i: number, seekTs?: string) {
    const a = audioRef.current; if (!a) return;
    if (playingIdx === i && !a.paused) { a.pause(); setPlayingIdx(null); return; }
    const item = qs[i]; const url = item?.recording_url || (item ? CANON + item.call_id : "");
    const src = url ? `/api/audio?url=${encodeURIComponent(url)}` : "";
    if (a.getAttribute("data-src") !== src) { a.src = src; a.setAttribute("data-src", src); }
    const go = () => { try { if (item?.seg) a.currentTime = Math.max(0, item.seg.s - 0.15); else if (seekTs) a.currentTime = Math.max(0, tsSec(seekTs) - 2); } catch {} a.play().then(() => setPlayingIdx(i)).catch(() => setPlayingIdx(null)); };
    if (a.readyState >= 1) go(); else { a.addEventListener("loadedmetadata", go, { once: true }); a.load(); }
  }
  function stopAudio() { audioRef.current?.pause(); setPlayingIdx(null); }

  useEffect(() => {
    const a = audioRef.current; const item = feedback !== null ? qs[feedback] : (idx >= 0 ? qs[idx] : undefined);
    if (!a || !item) return;
    const url = item.recording_url || CANON + item.call_id;
    const src = `/api/audio?url=${encodeURIComponent(url)}`;
    if (a.getAttribute("data-src") !== src) { a.pause(); a.src = src; a.setAttribute("data-src", src); }
    // decode audio for the waveform (same pipeline as the workbench: fetch ->
    // decodeAudioData -> per-channel RMS envelope -> 700 buckets)
    if (waveSrcRef.current !== src) {
      waveSrcRef.current = src;
      setWave(null); setPlayhead(0); setAnalyzing(true);
      (async () => {
        try {
          const buf = await fetch(src).then((r) => r.arrayBuffer());
          if (waveSrcRef.current !== src) return;
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audio = await ctx.decodeAudioData(buf);
          ctx.close().catch(() => {});
          if (waveSrcRef.current !== src) return;
          const e0 = envelope(audio.getChannelData(0), audio.sampleRate);
          const e1 = audio.numberOfChannels >= 2 ? envelope(audio.getChannelData(1), audio.sampleRate) : e0;
          // user channel = the one whose energy best overlaps the telemetry
          // anchors (same rule as the workbench: anchors ARE user speech)
          let userIdx = 1;
          const anchors = item.anchors || [];
          if (audio.numberOfChannels >= 2 && anchors.length) {
            const inAnchors = (env: { env: Float32Array; hop: number }) => {
              let s = 0;
              for (const a of anchors) {
                const i0 = Math.max(0, Math.floor(a.s / env.hop)), i1 = Math.min(env.env.length, Math.ceil(a.e / env.hop));
                for (let i = i0; i < i1; i++) s += env.env[i];
              }
              return s;
            };
            userIdx = inAnchors(e1) >= inAnchors(e0) ? 1 : 0;
          }
          const uEnv = userIdx === 1 ? e1 : e0, aEnv = userIdx === 1 ? e0 : e1;
          setWave({ agent: buckets(aEnv.env), user: buckets(uEnv.env), duration: audio.duration });
        } catch { /* keep the plain player */ }
        if (waveSrcRef.current === src) setAnalyzing(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, feedback, qs.length]);

  // classic dual-channel waveform + segment highlight + playhead (lifted from the workbench)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wave) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width = canvas.offsetWidth * 2, H = canvas.height = 120, mid = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e6ebe9";
    ctx.fillRect(0, mid - 0.5, W, 1);
    const bars = wave.agent.length;
    const bw = W / bars;
    for (let i = 0; i < bars; i++) {
      const up = (wave.agent[i] || 0) * (mid - 2);
      const down = (wave.user[i] || 0) * (mid - 2);
      ctx.fillStyle = "#1f7a5c";
      ctx.fillRect(i * bw, mid - up, Math.max(bw - 0.5, 0.5), up);
      ctx.fillStyle = "#5b8def";
      ctx.fillRect(i * bw, mid, Math.max(bw - 0.5, 0.5), down);
    }
    const item = feedback !== null ? qs[feedback] : (idx >= 0 ? qs[idx] : undefined);
    if (item && wave.duration > 0) {
      // telemetry anchors = user speech · highlight bottom half like the tool
      // (current segment amber + outline, the rest the pending red tint)
      const anchors = item.anchors || [];
      const qs0 = item.seg ? item.seg.s : Math.max(0, tsSec(item.ts) - 0.5);
      const qe0 = item.seg ? item.seg.e : Math.min(wave.duration, tsSec(item.ts) + 4);
      anchors.forEach((a) => {
        const isQ = Math.min(a.e, qe0) - Math.max(a.s, qs0) > 0.2;
        const x1 = (a.s / wave.duration) * W, x2 = (a.e / wave.duration) * W;
        ctx.fillStyle = isQ ? "rgba(183,121,31,0.4)" : "rgba(214,69,69,0.18)";
        ctx.fillRect(x1, mid, Math.max(2, x2 - x1), mid);
        if (isQ) { ctx.strokeStyle = "#b7791f"; ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2); }
      });
      // the question moment itself always gets the amber box (covers pron/issue
      // questions whose moment is agent speech, not a user anchor)
      if (!anchors.some((a) => Math.min(a.e, qe0) - Math.max(a.s, qs0) > 0.2)) {
        const x1 = (qs0 / wave.duration) * W, x2 = (qe0 / wave.duration) * W;
        ctx.fillStyle = "rgba(183,121,31,0.4)";
        ctx.fillRect(x1, mid, Math.max(2, x2 - x1), mid);
        ctx.strokeStyle = "#b7791f"; ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2);
      }
    }
    if (wave.duration > 0) {
      const x = (playhead / wave.duration) * W;
      ctx.fillStyle = "#d64545";
      ctx.fillRect(x - 1, 0, 2, H);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave, playhead, idx, feedback]);

  function seekWave(e: React.MouseEvent<HTMLCanvasElement>) {
    const a = audioRef.current; if (!a || !wave || wave.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * wave.duration;
    try { a.currentTime = Math.max(0, Math.min(wave.duration, t)); } catch {}
    if (a.paused) a.play().then(() => setPlayingIdx(feedback ?? idx)).catch(() => {});
  }

  function onRoman(value: string) {
    setTText(value); tTextRef.current = value;
    setAltPick(null); // tokens are about to refresh · stale chooser index
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const d = await fetch("/api/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) }).then((r) => r.json());
        if (tTextRef.current === value) setTTokens(d.tokens || []);
      } catch { /* keep roman */ }
    }, 450);
  }

  function clearTransState() { setTKind(""); setTLang("same"); setTText(""); tTextRef.current = ""; setTTokens([]); setAltPick(null); }
  function openQ(i: number) { if (results[i] !== undefined) return; stopAudio(); setIdx(i); setFeedback(null); clearTransState(); setPTag(""); setPWord(""); setIType(""); setIExpl(""); setCoachQ(""); setCoachA(""); }
  function record(i: number, v: Verdict) { stopAudio(); setResults((r) => ({ ...r, [i]: v })); setFeedback(i); }
  function next() { const n = [...Array(total).keys()].find((i) => results[i] === undefined); stopAudio(); setFeedback(null); clearTransState(); setPTag(""); setPWord(""); setIType(""); setIExpl(""); setCoachQ(""); setCoachA(""); if (n === undefined) setScreen("result"); else setIdx(n); }

  // like the workbench: ✓ Correct / {noise} resolve the segment instantly;
  // ✏ Edit opens the editor (ASR prefilled) and "Save & next" resolves it
  function resolveTrans(kind: "correct" | "wrong" | "noise") {
    if (!q || q.type !== "trans") return;
    setTKind(kind);
    if (kind === "wrong") { onRoman(q.asr); return; }
    record(idx, ((kind === "noise") !== q.isCorrect) ? "match" : "miss");
  }
  function saveTransEdit() {
    if (!q || q.type !== "trans" || !goldOf(tTokens, tText)) return;
    record(idx, (true !== q.isCorrect) ? "match" : "miss");
  }
  function submitPron() {
    if (!q || q.type !== "pron" || !pTag || !pWord.trim()) return;
    record(idx, pTag === q.content_tag ? "match" : "miss");
  }
  function submitIssue() {
    if (!q || q.type !== "issue" || !iType || !iExpl.trim()) return;
    record(idx, iType === q.correct ? "match" : "miss");
  }

  async function askCoach() {
    const qq = coachQ.trim(); if (!qq || coachBusy) return;
    setCoachBusy(true); setCoachA("");
    const fi = feedback ?? idx; const c = qs[fi];
    const ctx = c.type === "trans"
      ? `Task: transcription review. Agent said: "${c.context}". ASR wrote: "${c.asr}". Golden: "${c.golden}". ${c.isCorrect ? "The ASR was correct." : "The ASR was wrong and should be edited."} Expert note: ${c.explain}`
      : c.type === "pron"
        ? `Task: pronunciation audit. The agent mispronounced "${c.word_heard}", tagged as ${c.content_tag}. Expert note: ${c.explain}`
        : `Task: issue logging. ${c.setup} Correct error type: "${c.correct}". Expert note: ${c.explain}`;
    try { const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: ctx, question: qq }) }); const d = await r.json(); setCoachA(d.text || "Coach unavailable · re-read the expert note above."); }
    catch { setCoachA("Coach unavailable · re-read the expert note above."); }
    setCoachBusy(false);
  }

  useEffect(() => {
    if (screen !== "result" || savedRef.current || !applicantId || !total) return;
    savedRef.current = true;
    fetch("/api/apply", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
      id: applicantId, score: Math.round((ptsSum / total) * 100), total, matched: ptsSum,
      results: [...Array(total).keys()].map((i) => ({ i, type: qs[i]?.type, verdict: results[i] }))
    }) }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const canApply = langs.length > 0 && phone.replace(/\D/g, "").length >= 10;
  const agreementLabel = done ? Math.round((ptsSum / done) * 100) + "%" : "-";
  const pct = total ? Math.round((ptsSum / total) * 100) : 0;
  const transN = qs.filter((x) => x.type === "trans").length;

  function Row({ i }: { i: number }) {
    const st = results[i]; const cur = idx === i && screen === "work"; const answered = st !== undefined;
    const label = qs[i].type === "trans" ? "call · segment" : qs[i].type === "pron" ? "call · pronunciation" : "call · issue log";
    return (
      <div onClick={() => !answered && openQ(i)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, border: `1.5px solid ${cur ? GREEN : "transparent"}`, background: cur ? "#f2faf6" : "transparent", borderRadius: 8, padding: "6px 8px", cursor: answered ? "default" : "pointer" }}>
        <span style={{ color: answered ? (st === "match" ? GREEN : RED) : GREEN }}>{answered ? (st === "match" ? "✓" : "✗") : "▶"}</span>
        <span className={mono.className} style={{ color: INK, fontSize: 11.5 }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ borderRadius: 999, background: answered ? (st === "match" ? "#e7f4ee" : "#fbeaea") : "#eef2f6", color: answered ? (st === "match" ? GREEN : RED) : "#93a1ae", padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{answered ? (st === "match" ? "matched" : "missed") : (cur ? "in progress" : "open")}</span>
      </div>
    );
  }

  const fi = feedback ?? 0; const fq = feedback !== null ? qs[fi] : undefined; const fVerdict = feedback !== null ? results[fi] : "";

  function TranscriptPanel({ item, highlight }: { item: Q; highlight?: string }) {
    const turns = item.turns || [];
    const hl = (highlight || "").trim().toLowerCase().slice(0, 30);
    return (
      <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
        <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", position: "sticky", top: 0, background: "#fff", paddingBottom: 4 }}>Call transcript · {turns.length} turns</span>
        {turns.map((t, i) => {
          const isHl = hl.length > 3 && t.text.toLowerCase().includes(hl);
          return (
            <div key={i} style={{ alignSelf: t.who === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: isHl ? "#fdecc8" : t.who === "user" ? "#eef4fd" : "#f5f7f9", border: isHl ? "1.5px solid #b7791f" : "1px solid #e9edf1", borderRadius: 10, padding: "5px 9px", fontSize: 12.5, lineHeight: 1.45 }}>
              <span style={{ display: "block", fontSize: 9, color: t.who === "user" ? "#5b8def" : GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.who}</span>{t.text}
            </div>
          );
        })}
        {turns.length === 0 && <span style={{ fontSize: 12, color: MUT }}>No transcript available for this call.</span>}
      </div>
    );
  }

  const activeQ = feedback !== null ? fq : q;

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ width: "100%", background: "#f5f7f9", display: "flex", flexDirection: "column", flex: 1 }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 32px" }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN }} />
          <span className={grotesk.className} style={{ fontWeight: 700, fontSize: 16 }}>realloop</span>
          <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>{screen === "apply" ? "Become a reviewer" : screen === "result" ? "Result" : `Assignment · ${done}/${total || 5}`}</span>
          <span style={{ flex: 1 }} />
          {screen === "work" && done > 0 && <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>your agreement: {agreementLabel}</span>}
          <span style={{ fontSize: 12.5, color: MUT }}>Open roles</span>
        </div>

        {screen === "apply" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 32, padding: "26px 32px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.12, letterSpacing: "-.4px" }}>Review AI phone calls.<br />Work from anywhere, anytime.</div>
                  <div style={{ fontSize: 14, color: MUT, marginTop: 7, maxWidth: 520 }}>A laptop or phone and headphones are all you need. No resume, no interview · your agreement score decides your tier and pay.</div>
                </div>
                {role === "Expert" ? (
                  <div style={{ ...card, padding: "16px 20px", display: "flex", gap: 18 }}>
                    <div style={{ flex: 1 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>₹700/hr</div><div style={{ fontSize: 11, color: MUT }}>expert base · QA & calibration</div></div>
                    <div style={{ flex: 1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>per project</div><div style={{ fontSize: 11, color: MUT }}>ground truth & onboarding work</div></div>
                    <div style={{ flex: 1.1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23 }}>your name</div><div style={{ fontSize: 11, color: MUT }}>experts are credited on every dataset they resolve</div></div>
                  </div>
                ) : (
                  <div style={{ ...card, padding: "16px 20px", display: "flex", gap: 18 }}>
                    <div style={{ flex: 1 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>₹300/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 2 · from day one</div></div>
                    <div style={{ flex: 1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>₹500/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 1 · high agreement</div></div>
                    <div style={{ flex: 1.1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23 }}>₹2,000+</div><div style={{ fontSize: 11, color: MUT }}>top reviewers make / day · paid weekly</div></div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>The work on offer</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(role === "Expert" ? JOBS_EXPERT : JOBS_REVIEWER).map((j) => (
                      <div key={j.t} style={{ ...card, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>{j.t}</div>
                          <div style={{ fontSize: 12, color: MUT, marginTop: 1 }}>{j.d}</div>
                        </div>
                        <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", flex: "none" }}>{j.pay}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUT, marginTop: 7 }}>{role === "Expert" ? "Experts go deeper: the same assignment, then a calibration deep-dive with the founding team." : "Your 2-minute assignment samples the reviewer and transcriptor work. Do well and you unlock all of them."}</div>
                </div>
              </div>
              <div style={{ ...card, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16 }}>Apply now</span>
                <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                  {["Reviewer", "Expert"].map((n) => <div key={n} onClick={() => setRole(n)} style={{ flex: 1, textAlign: "center", fontSize: 12.5, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === role ? "#fff" : "transparent", color: n === role ? INK : MUT, boxShadow: n === role ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Languages you speak</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((n) => { const on = langs.includes(n); return <span key={n} onClick={() => setLangs((s) => on ? s.filter((x) => x !== n) : [...s, n])} style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "4px 10px", fontSize: 11.5, cursor: "pointer" }}>{n}</span>; })}
                  </div>
                </div>
                <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Education</div><div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>{["12th", "Graduate", "Postgrad"].map((n) => <div key={n} onClick={() => setEdu(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === edu ? "#fff" : "transparent", color: n === edu ? INK : MUT, boxShadow: n === edu ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>)}</div></div>
                <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Hours per week</div><div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>{["<5", "5-15", "15+"].map((n) => <div key={n} onClick={() => setHours(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === hours ? "#fff" : "transparent", color: n === hours ? INK : MUT, boxShadow: n === hours ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>)}</div></div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Phone (WhatsApp)</div>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10, color: "#93a1ae", marginTop: 3 }}>Only for your login code and onboarding call. Never shown anywhere.</div>
                </div>
                <div style={{ flex: 1, minHeight: 12 }} />
                <div onClick={() => { if (!canApply) return; setScreen("work"); fetch("/api/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, languages: langs, education: edu, hours, phone }) }).then((r) => r.json()).then((d) => { if (d.ok) setApplicantId(d.id); }).catch(() => {}); }} style={{ height: 46, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: canApply ? 1 : 0.45 }}>{role === "Expert" ? "Apply → assignment + expert deep-dive" : "Apply → your assignment is ready"}</div>
                <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>{canApply ? "No wait · 5 real questions, about 2 minutes." : "Pick at least one language and enter a valid phone number."}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, padding: "0 32px 26px" }}>
              {[["14", "reviewers working today"], ["1,733+", "paid reviews delivered"], ["weekly", "payouts, UPI"], ["7", "open roles"]].map(([n, l]) => (
                <div key={l} style={{ ...card, flex: 1, padding: "14px 16px" }}><div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{n}</div><div style={{ fontSize: 11.5, color: MUT }}>{l}</div></div>
              ))}
            </div>
          </div>
        )}

        {screen === "work" && (
          <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, padding: "18px 32px", flex: 1, alignItems: "start", width: "100%", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#e2e8ee" }}><div style={{ width: `${total ? (done / total) * 100 : 0}%`, height: 7, borderRadius: 4, background: GREEN }} /></div>
                <span className={mono.className} style={{ fontSize: 12 }}>{done} / {total || 5}</span>
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Fix the transcript</span></div>
                {qs.map((x, i) => x.type === "trans" ? <Row key={i} i={i} /> : null)}
              </div>
              <div style={{ ...card, padding: "11px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}><span className={grotesk.className} style={{ fontWeight: 600, fontSize: 13 }}>Issue logging</span></div>
                {qs.map((x, i) => x.type !== "trans" ? <Row key={i} i={i} /> : null)}
              </div>
              <div style={{ fontSize: 11, color: "#93a1ae", lineHeight: 1.45, padding: "0 3px" }}>Move between open tasks freely. Feedback is instant · these are real production calls, graded by our experts.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {activeQ && (
                <div style={{ ...card, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span className={mono.className} style={{ fontSize: 11.5, color: MUT, flex: "none" }}>full call · {activeQ.call_id.slice(0, 8)}</span>
                    <audio ref={audioRef} controls preload="none" onEnded={() => setPlayingIdx(null)} onTimeUpdate={(e) => setPlayhead((e.target as HTMLAudioElement).currentTime)} style={{ flex: 1, minWidth: 260, height: 34 }} />
                    <span style={{ fontSize: 11, color: MUT, flex: "none" }}>listen to any part · the ▶ buttons jump to the moment</span>
                  </div>
                  {wave
                    ? <canvas ref={canvasRef} onClick={seekWave} style={{ width: "100%", height: 60, display: "block", cursor: "pointer", borderRadius: 6, background: "#fbfcfc" }} title="click anywhere to jump · amber box = the segment in question" />
                    : <div style={{ height: 60, borderRadius: 6, background: "#fbfcfc", border: "1px dashed #e2e8ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: "#93a1ae" }}>{analyzing ? "analyzing audio · drawing waveform…" : "waveform loads with the call"}</div>}
                  {wave && <div style={{ fontSize: 10.5, color: "#93a1ae" }}><span style={{ color: "#1f7a5c" }}>▮</span> agent · <span style={{ color: "#5b8def" }}>▮</span> user · <span style={{ color: "#b7791f" }}>▯</span> this segment · <span style={{ color: "#d64545" }}>▯</span> other user turns · click the waveform to seek</div>}
                </div>
              )}

              {idx === -1 && feedback === null && (
                <div style={{ ...card, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>Your {total || 6}-question assignment</div>
                  <div style={{ fontSize: 13.5, color: MUT, maxWidth: 440 }}>{transN} transcription checks and {total - transN} issue logs, with the full call in front of you. Your agreement with the expert decides your tier.</div>
                  <div onClick={() => total && openQ(0)} style={{ height: 46, minWidth: 220, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0 22px", opacity: total ? 1 : 0.5 }}>{total ? "Start question 1 ▶" : "Loading…"}</div>
                </div>
              )}

              {feedback === null && q && q.type === "trans" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 12, alignItems: "start" }}>
                <div style={{ border: `2px solid ${T_AMBER}`, background: "#fff", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={() => play(idx, q.ts)} style={{ fontSize: 13, padding: "4px 10px", borderRadius: 7, border: "1px solid #cfd8e0", background: "#fff", cursor: "pointer" }}>{playingIdx === idx ? "❚❚" : "🔁"} @{q.ts}</button>
                    <strong style={{ fontSize: 13, color: "#5b6b64" }}>segment · question {idx + 1} of {total}</strong>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8a988f", marginTop: 10 }}>Conversation:</div>
                  <div style={{ fontSize: 13.5, color: "#5b6b64", margin: "2px 0 8px" }}><b style={{ color: T_GREEN }}>agent:</b> {q.context}</div>
                  <div style={{ fontSize: 11.5, color: "#8a988f" }}>ASR heard (user):</div>
                  <p style={{ fontSize: 16, margin: "4px 0 10px", color: "#1f2d28", lineHeight: 1.6 }}>{q.asr}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => resolveTrans("correct")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: `1px solid ${T_GREEN}`, background: tKind === "correct" ? T_GREEN : "#fff", color: tKind === "correct" ? "#fff" : T_GREEN, cursor: "pointer" }}>✓ Correct</button>
                    <button onClick={() => resolveTrans("wrong")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: `1px solid ${T_ORANGE}`, background: tKind === "wrong" ? T_ORANGE : "#fff", color: tKind === "wrong" ? "#fff" : T_ORANGE, cursor: "pointer" }}>✏ Edit · ASR is wrong</button>
                    <button onClick={() => resolveTrans("noise")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: `1px solid ${T_SLATE}`, background: tKind === "noise" ? T_SLATE : "#fff", color: tKind === "noise" ? "#fff" : T_SLATE, cursor: "pointer" }}>{"{noise}"}</button>
                    <button style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: `1px solid ${T_RED}`, background: "#fff", color: T_RED, cursor: "pointer" }} title="This isn't a user turn; the detector was wrong.">🗑 Not a user turn</button>
                  </div>
                  {tKind === "wrong" && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#5b6b64", marginBottom: 6 }}>
                        wrong in:
                        <label style={{ cursor: "pointer" }}><input type="radio" checked={tLang === "same"} onChange={() => setTLang("same")} /> same language</label>
                        <label style={{ cursor: "pointer" }}><input type="radio" checked={tLang === "different"} onChange={() => setTLang("different")} /> different language</label>
                      </div>
                      <textarea value={tText} rows={2} autoFocus style={{ width: "100%", boxSizing: "border-box", fontSize: 14.5, padding: "8px 10px", border: "1px solid #cfd8e0", borderRadius: 8, fontFamily: "inherit" }} placeholder="Type in Roman · hindi words convert automatically (e.g. haan didi main kaam kar rahi hoon)" onChange={(e) => onRoman(e.target.value)} />
                      {tTokens.length > 0 && (
                        <div style={{ background: "#f2faf7", border: "1px solid #cfe3da", borderRadius: 8, padding: "8px 10px", marginTop: 6, fontSize: 15.5, lineHeight: 1.9 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 2 }}>
                            {tTokens.map((t, ti) => (
                              <span key={ti} onClick={async () => {
                                if (altPick?.ti === ti) { setAltPick(null); return; }
                                setAltPick({ ti, alts: [], loading: true });
                                const core = t.src.replace(/^[^\wऀ-ॿ{]+|[^\wऀ-ॿ}]+$/g, "");
                                try {
                                  const d = await fetch("/api/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: core }) }).then((r) => r.json());
                                  setAltPick((p) => (p && p.ti === ti ? { ...p, alts: d.alts || [], loading: false } : p));
                                } catch {
                                  setAltPick((p) => (p && p.ti === ti ? { ...p, loading: false } : p));
                                }
                              }} title="click to fix this word"
                                style={{ cursor: "pointer", padding: "1px 3px", borderRadius: 4, marginRight: 3, background: altPick?.ti === ti ? "#f9dcae" : t.converted ? "#fdecc8" : "transparent" }}>
                                {t.converted ? t.out : t.src}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: "#8a988f", marginTop: 2 }}>highlighted = converted to Devanagari · click any word to fix it</div>
                          {altPick && tTokens[altPick.ti] && (() => {
                            const tk0 = tTokens[altPick.ti];
                            const apply = (out: string | null) => { // null = keep Roman
                              const tk = [...tTokens];
                              tk[altPick.ti] = out === null ? { ...tk[altPick.ti], converted: false } : { ...tk[altPick.ti], out, converted: true };
                              setTTokens(tk);
                              setAltPick(null);
                            };
                            return (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: "1px dashed #cfe3da", marginTop: 6, paddingTop: 7 }}>
                                <span style={{ fontSize: 12, color: "#5b6b64" }}>“{tk0.src}” =</span>
                                {altPick.loading && <span style={{ fontSize: 12, color: "#8a988f" }}>…</span>}
                                {altPick.alts.map((a) => (
                                  <button key={a} onClick={() => apply(a)}
                                    style={{ fontSize: 15, padding: "2px 10px", borderRadius: 6, cursor: "pointer", border: tk0.converted && tk0.out === a ? "2px solid #1f7a5c" : "1px solid #cfe3da", background: "#fff" }}>
                                    {a}
                                  </button>
                                ))}
                                <button onClick={() => apply(null)}
                                  style={{ fontSize: 13, padding: "2px 10px", borderRadius: 6, cursor: "pointer", border: !tk0.converted ? "2px solid #1f7a5c" : "1px solid #cfd4d1", background: "#fff", color: "#4a5568" }}>
                                  {tk0.src}
                                </button>
                                <button onClick={() => setAltPick(null)} style={{ fontSize: 12, border: "none", background: "transparent", color: "#8a988f", cursor: "pointer" }}>✕</button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {lint(goldOf(tTokens, tText)).map((w) => <div key={w} style={{ fontSize: 11.5, color: "#b7791f", marginTop: 3 }}>⚠ {w}</div>)}
                      <button onClick={saveTransEdit} disabled={!goldOf(tTokens, tText)}
                        style={{ marginTop: 8, fontSize: 13, padding: "7px 16px", borderRadius: 7, border: "none", background: goldOf(tTokens, tText) ? "#1f7a5c" : "#c8d6d0", color: "#fff", cursor: goldOf(tTokens, tText) ? "pointer" : "not-allowed" }}>
                        Save & next
                      </button>
                    </div>
                  )}
                </div>
                <TranscriptPanel item={q} highlight={q.asr} />
                </div>
              )}

              {feedback === null && q && q.type === "pron" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 180 }}>
                    <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Pronunciation · question {idx + 1} of {total}</span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>Play the moment and listen for a name, city or brand the <b>agent</b> mispronounced. Log it the way you would in the tool.</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7f9", borderRadius: 9, padding: "9px 11px" }}>
                      <div onClick={() => play(idx, q.ts)} style={{ width: 34, height: 34, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", flex: "none" }}>{playingIdx === idx ? "❚❚" : "▶"}</div>
                      <span className={mono.className} style={{ fontSize: 12 }}>{q.call_id.slice(0, 8)} @{q.ts}</span>
                      <span style={{ fontSize: 11.5, color: MUT }}>· plays from ~2s before</span>
                    </div>
                    <TranscriptPanel item={q} highlight={q.type === "pron" ? q.word_heard : undefined} />
                  </div>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 14 }}>Log the pronunciation issue</span>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Issue type
                      <div style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, background: "#f5f7f9", color: INK }}>Pronunciation</div>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Timestamp
                      <div className={mono.className} style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, background: "#f5f7f9", color: INK }}>{q.ts}</div>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Content tag
                      <select value={pTag} onChange={(e) => setPTag(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${pTag ? "#d6dee6" : "#e2b3b3"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                        <option value="">Select content tag</option>
                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Word mispronounced
                      <input value={pWord} onChange={(e) => setPWord(e.target.value)} placeholder="type the exact word you heard" style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    </label>
                    <button onClick={submitPron} disabled={!pTag || !pWord.trim()} style={{ marginTop: 2, fontSize: 13.5, padding: "9px 0", borderRadius: 8, border: "none", background: (!pTag || !pWord.trim()) ? "#c8d6d0" : GREEN, color: "#fff", fontWeight: 600, cursor: (!pTag || !pWord.trim()) ? "not-allowed" : "pointer" }}>Add issue</button>
                  </div>
                </div>
              )}

              {feedback === null && q && q.type === "issue" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Issue logging · question {idx + 1} of {total}</span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{q.setup}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7f9", borderRadius: 9, padding: "9px 11px" }}>
                      <div onClick={() => play(idx, q.ts)} style={{ width: 34, height: 34, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", flex: "none" }}>{playingIdx === idx ? "❚❚" : "▶"}</div>
                      <span className={mono.className} style={{ fontSize: 12 }}>{q.call_id.slice(0, 8)} @{q.ts}</span>
                      <span style={{ fontSize: 11.5, color: MUT }}>· plays from ~2s before</span>
                    </div>
                    <TranscriptPanel item={q} />
                  </div>
                  <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 14 }}>Log the issue</span>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Issue type
                      <div style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, background: "#f5f7f9", color: INK }}>Response appropriateness</div>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Timestamp
                      <div className={mono.className} style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, background: "#f5f7f9", color: INK }}>{q.ts}</div>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Type of error
                      <select value={iType} onChange={(e) => setIType(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${iType ? "#d6dee6" : "#e2b3b3"}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                        <option value="">Select type of error</option>
                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 4 }}>Explain the error
                      <textarea value={iExpl} rows={2} onChange={(e) => setIExpl(e.target.value)} placeholder="one line: what went wrong?" style={{ padding: "8px 10px", border: "1px solid #d6dee6", borderRadius: 7, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
                    </label>
                    <button onClick={submitIssue} disabled={!iType || !iExpl.trim()} style={{ marginTop: 2, fontSize: 13.5, padding: "9px 0", borderRadius: 8, border: "none", background: (!iType || !iExpl.trim()) ? "#c8d6d0" : GREEN, color: "#fff", fontWeight: 600, cursor: (!iType || !iExpl.trim()) ? "not-allowed" : "pointer" }}>Add issue</button>
                  </div>
                </div>
              )}

              {feedback !== null && fq && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 660 }}>
                  <div style={{ background: fVerdict === "match" ? "#f2faf6" : "#fffafa", border: `1.5px solid ${fVerdict === "match" ? GREEN : RED}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: fVerdict === "match" ? GREEN : RED }}>
                      {fq.type === "trans"
                        ? (fVerdict === "match" ? (fq.isCorrect ? "✓ Right: the ASR was correct" : "✓ Caught it: the ASR was wrong") : (fq.isCorrect ? "✗ The ASR was actually correct" : "✗ Missed it: the ASR was wrong"))
                        : fq.type === "pron"
                          ? (fVerdict === "match" ? `✓ Right: it's a ${fq.content_tag}` : `✗ Not quite: it's a ${fq.content_tag}`)
                          : (fVerdict === "match" ? `✓ Exactly: ${fq.correct.toLowerCase()}` : `✗ Not quite: the expert logged ${fq.correct.toLowerCase()}`)}
                    </span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{fq.explain}</div>
                    {fq.type === "trans"
                      ? <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.6 }}><span style={{ color: MUT }}>ASR:</span> {fq.asr}<br /><span style={{ color: MUT }}>Golden:</span> <b style={{ color: GREEN }}>{fq.golden}</b></div>
                      : fq.type === "pron"
                        ? <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13 }}><span style={{ color: MUT }}>Expert logged:</span> <b>{fq.word_heard}</b> · <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>{fq.content_tag}</span></div>
                        : <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13 }}><span style={{ color: MUT }}>Expert logged:</span> <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>{fq.correct}</span></div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div onClick={() => play(fi, fq.ts)} style={{ width: 26, height: 26, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, cursor: "pointer" }}>{playingIdx === fi ? "❚❚" : "▶"}</div>
                      <span style={{ fontSize: 11.5, color: MUT }}>replay with the answer in mind</span>
                    </div>
                  </div>
                  <div style={{ ...card, padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: MUT }}><b style={{ color: INK }}>Still unsure? Ask the coach</b> · it knows this exact call.</span>
                    <div style={{ display: "flex", gap: 7 }}>
                      <input value={coachQ} onChange={(e) => setCoachQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askCoach(); }} placeholder="e.g. how do I catch this faster?" style={{ flex: 1, border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, outline: "none", fontFamily: "inherit" }} />
                      <div onClick={askCoach} style={{ minWidth: 58, borderRadius: 8, background: INK, color: "#fff", fontWeight: 600, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{coachBusy ? "…" : "Ask"}</div>
                    </div>
                    {coachA && <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5 }}><span style={{ display: "block", fontSize: 9.5, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>coach</span>{coachA}</div>}
                  </div>
                  <div onClick={next} style={{ height: 46, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{done >= total ? "See your result →" : "Got it · next question →"}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div style={{ display: "flex", flex: 1, alignItems: "flex-start", justifyContent: "center", padding: "40px 24px", width: "100%", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
            <div style={{ ...card, borderRadius: 14, padding: 34, display: "flex", flexDirection: "column", gap: 13, alignItems: "center", textAlign: "center", maxWidth: 560, width: "100%", boxSizing: "border-box" }}>
              <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 21 }}>Assignment complete</div>
              <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 56, color: pct >= PASS ? GREEN : AMBER, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 13, color: MUT }}>agreement with the expert · {ptsSum} of {total} matched</div>
              <div style={{ display: "flex", gap: 5 }}>{[...Array(total).keys()].map((i) => <span key={i} style={{ width: 32, height: 8, borderRadius: 4, background: results[i] === "match" ? GREEN : RED }} />)}</div>
              {pct >= PASS ? (
                <div style={{ background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 17, color: GREEN }}>Tier 2 unlocked · ₹300/hr</span>
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>One step left: a 30-minute onboarding call. Then real, paid work starts. Hold ≥75% across 2 real batches → Tier 1 at ₹500/hr.</span>
                  <a href="https://wa.me/919999999999?text=Hi%20realloop%2C%20I%20passed%20the%20assignment" target="_blank" rel="noopener noreferrer" style={{ height: 42, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: 5, textDecoration: "none" }}>Book onboarding on WhatsApp →</a>
                </div>
              ) : (
                <div style={{ background: "#fffdf7", border: "1.5px solid #d99a2b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: AMBER }}>Not yet · you need {PASS}%</span>
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>Retake in 7 days with new questions. Re-read the expert feedback on the ones you missed · that's exactly what the retake tests.</span>
                </div>
              )}
              <span onClick={() => { stopAudio(); setScreen("apply"); setIdx(-1); setResults({}); setFeedback(null); setPhone(""); }} style={{ fontSize: 12, color: MUT, cursor: "pointer", textDecoration: "underline" }}>restart</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
