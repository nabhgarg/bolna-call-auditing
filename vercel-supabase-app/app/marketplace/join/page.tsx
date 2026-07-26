"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, RED, AMBER, card } from "../../../lib/ui";

// Reviewer onboarding + screening assignment. Apply -> 7 real judgment-heavy
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
type TransSeg = { ts: string; s: number; e: number; asr: string; golden: string; isCorrect: boolean };
type Trans = { type: "trans"; call_id: string; recording_url?: string; explain: string; turns?: Turn[]; anchors?: Anchor[]; segments: TransSeg[] };
type SegKind = "correct" | "wrong" | "noise" | "deleted";
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
// exact cheat-sheet from the /transcribe workbench
const RULES: Array<[string, string]> = [
  ["Script", "Hindi in Devanagari, English in Roman · never translate. Type Roman; the tool converts."],
  ["Numbers", "As spoken words, not digits · पांच / five, not 5"],
  ["Decimals", "No \".\" · \"two point two five\", written out"],
  ["Names", "Indian names/places in Devanagari; foreign in Roman"],
  ["No shortcuts", "okay not ok · please not pls · you not u"],
  ["Noise", "Unclear / gibberish / non-speech → {noise}, never guess"]
];
function lint(text: string): string[] {
  const w: string[] = [];
  if (/\d+\.\d+/.test(text)) w.push("Decimal digits · write as spoken: \"two point two five\"");
  else if (/\d/.test(text)) w.push("Digits · write numbers as words (पांच / five)");
  for (const word of text.toLowerCase().split(/[^a-z0-9']+/)) if (SHORTHAND[word]) w.push(`"${word}" → "${SHORTHAND[word]}"`);
  return [...new Set(w)];
}
// what actually differs between what the ASR wrote and what was really said ·
// used to explain each clip in words, not just mark it right or wrong
function normW(w: string) { return w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, ""); }
function whyOf(asr: string, golden: string): string {
  const a = String(asr || "").trim().split(/\s+/).filter(Boolean);
  const g = String(golden || "").trim().split(/\s+/).filter(Boolean);
  let p = 0;
  while (p < a.length && p < g.length && normW(a[p]) === normW(g[p])) p++;
  let sfx = 0;
  while (sfx < a.length - p && sfx < g.length - p && normW(a[a.length - 1 - sfx]) === normW(g[g.length - 1 - sfx])) sfx++;
  const aMid = a.slice(p, a.length - sfx).join(" ");
  const gMid = g.slice(p, g.length - sfx).join(" ");
  if (!aMid && gMid) return `the transcript dropped “${gMid}”`;
  if (aMid && !gMid) return `the transcript added “${aMid}”, which was never said`;
  if (aMid && gMid) return `“${aMid}” should be “${gMid}”`;
  return "the transcript does not match the audio";
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

const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Chandigarh","Jammu & Kashmir","Ladakh","Puducherry","Andaman & Nicobar","Other"];
const JOBS_REVIEWER = [
  { t: "AI Call Reviewer", d: "Rate whole calls 1-4 and log where the agent broke · the highest-volume work.", pay: "₹28 / review" },
  { t: "AI Call Transcriptor", d: "Listen to a call and fix what the AI's speech-to-text got wrong · code-mixed Hindi/English.", pay: "₹120 / call" },
  { t: "Regional Language Expert", d: "Tamil, Telugu, Marathi, Bengali calls · review and transcribe in your language.", pay: "₹40 / review" },
  { t: "Text Annotator", d: "Judge AI chat and text outputs · correctness, tone, task completion. No audio needed.", pay: "₹18 / item" }
];
export default function Join() {
  const [screen, setScreen] = useState<"apply" | "work" | "result">("apply");
  const role = "Reviewer";
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [edu, setEdu] = useState("Graduate");
  const [hours, setHours] = useState("5-15");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [stateName, setStateName] = useState("");
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(-1);
  const [results, setResults] = useState<Record<number, Verdict>>({});
  const [feedback, setFeedback] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [coachQ, setCoachQ] = useState(""); const [coachA, setCoachA] = useState(""); const [coachBusy, setCoachBusy] = useState(false);
  const [tKind, setTKind] = useState<"" | "correct" | "wrong" | "noise">("");
  const [tLang, setTLang] = useState("same");
  const [tText, setTText] = useState("");
  // multi-segment transcription (whole user side of the call, like /transcribe)
  const [segState, setSegState] = useState<Record<number, Record<number, SegKind>>>({});
  const [segUnclear, setSegUnclear] = useState<Record<number, Record<number, boolean>>>({});
  const [segCur, setSegCur] = useState(0);
  const [rate, setRate] = useState(1);            // playback speed (0.5/0.75/1x) like the workbench
  const [rulesOpen, setRulesOpen] = useState(false);
  const stopAtRef = useRef<number | null>(null);   // bound segment playback to its end
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

  function play(i: number, seekTs?: string, seekSec?: number, stopSec?: number) {
    const a = audioRef.current; if (!a) return;
    if (playingIdx === i && !a.paused) { a.pause(); setPlayingIdx(null); return; }
    const item = qs[i]; const url = item?.recording_url || (item ? CANON + item.call_id : "");
    const src = url ? `/api/audio?url=${encodeURIComponent(url)}` : "";
    if (a.getAttribute("data-src") !== src) { a.src = src; a.setAttribute("data-src", src); }
    stopAtRef.current = stopSec != null ? stopSec + 0.15 : null;   // bound to segment end like the tool
    const seek = () => { try { a.playbackRate = rate; if (seekSec != null) a.currentTime = Math.max(0, seekSec - 0.15); else if (seekTs) a.currentTime = Math.max(0, tsSec(seekTs) - 2); } catch {} };
    // play() must be issued INSIDE the tap. The old code waited for
    // loadedmetadata and called play() from that callback · by then the user
    // gesture is over and mobile Safari blocks it, silently, via the .catch().
    // That is why the very first clip never played while every later one did:
    // once the element has started once, it is unlocked and readyState >= 1
    // takes the synchronous path.
    // Muted for the moment between starting and having metadata to seek with,
    // so the unlock does not leak audio from 0:00.
    a.muted = true;
    const started = a.play();
    const ready = () => { seek(); a.muted = false; setPlayingIdx(i); };
    if (a.readyState >= 1) ready(); else a.addEventListener("loadedmetadata", ready, { once: true });
    if (started && typeof started.catch === "function") started.catch(() => { a.muted = false; setPlayingIdx(null); });
  }
  function changeRate(r: number) { setRate(r); if (audioRef.current) audioRef.current.playbackRate = r; }
  function playCurSeg() { const g = transSegs[segCur]; if (g) play(idx, undefined, g.s, g.e); }
  function stopAudio() { audioRef.current?.pause(); setPlayingIdx(null); stopAtRef.current = null; }

  useEffect(() => {
    const a = audioRef.current; const item = feedback !== null ? qs[feedback] : (idx >= 0 ? qs[idx] : undefined);
    if (!a || !item) return;
    const url = item.recording_url || CANON + item.call_id;
    const src = `/api/audio?url=${encodeURIComponent(url)}`;
    if (a.getAttribute("data-src") !== src) { a.pause(); a.src = src; a.setAttribute("data-src", src); }
    // waveform removed for the simple mobile flow · the hidden <audio> element
    // is the whole player; bounded segment playback via play()/stopAtRef.
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
    const fi2 = feedback !== null ? feedback : idx;
    const item = feedback !== null ? qs[feedback] : (idx >= 0 ? qs[idx] : undefined);
    if (item && wave.duration > 0) {
      const anchors = item.anchors || [];
      if (item.type === "trans") {
        // whole-call transcription: colour every user segment by its state -
        // current amber (outlined), resolved-correct green, resolved-wrong/noise
        // red, pending red-tint, exactly like the workbench.
        const st = segState[fi2] || {};
        anchors.forEach((a, si) => {
          const k = st[si]; const isCur = feedback === null && si === segCur;
          const x1 = (a.s / wave.duration) * W, x2 = (a.e / wave.duration) * W;
          ctx.fillStyle = isCur ? "rgba(183,121,31,0.4)" : k === "correct" ? "rgba(31,122,92,0.28)" : k ? "rgba(176,54,54,0.3)" : "rgba(214,69,69,0.16)";
          ctx.fillRect(x1, mid, Math.max(2, x2 - x1), mid);
          if (isCur) { ctx.strokeStyle = "#b7791f"; ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2); }
        });
      } else {
        // pron / issue: highlight the one moment in question (amber), other user turns faint
        const qs0 = Math.max(0, tsSec(item.ts) - 0.5), qe0 = Math.min(wave.duration, tsSec(item.ts) + 4);
        anchors.forEach((a) => {
          const isQ = Math.min(a.e, qe0) - Math.max(a.s, qs0) > 0.2;
          const x1 = (a.s / wave.duration) * W, x2 = (a.e / wave.duration) * W;
          ctx.fillStyle = isQ ? "rgba(183,121,31,0.4)" : "rgba(214,69,69,0.16)";
          ctx.fillRect(x1, mid, Math.max(2, x2 - x1), mid);
          if (isQ) { ctx.strokeStyle = "#b7791f"; ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2); }
        });
        if (!anchors.some((a) => Math.min(a.e, qe0) - Math.max(a.s, qs0) > 0.2)) {
          const x1 = (qs0 / wave.duration) * W, x2 = (qe0 / wave.duration) * W;
          ctx.fillStyle = "rgba(183,121,31,0.4)";
          ctx.fillRect(x1, mid, Math.max(2, x2 - x1), mid);
          ctx.strokeStyle = "#b7791f"; ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2);
        }
      }
    }
    if (wave.duration > 0) {
      const x = (playhead / wave.duration) * W;
      ctx.fillStyle = "#d64545";
      ctx.fillRect(x - 1, 0, 2, H);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave, playhead, idx, feedback, segState, segCur]);

  function seekWave(e: React.MouseEvent<HTMLCanvasElement>) {
    const a = audioRef.current; if (!a || !wave || wave.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * wave.duration;
    // clicking a spike jumps to AND plays that segment (bounded), like the tool;
    // clicking empty audio just seeks there.
    const item = feedback !== null ? qs[feedback] : (idx >= 0 ? qs[idx] : undefined);
    if (item && item.type === "trans" && feedback === null) {
      const hit = item.segments.findIndex((g) => t >= g.s - 0.15 && t <= g.e + 0.15);
      if (hit >= 0) { gotoSeg(hit); return; }
    }
    stopAtRef.current = null;
    try { a.playbackRate = rate; a.currentTime = Math.max(0, Math.min(wave.duration, t)); } catch {}
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
  function openQ(i: number) { if (results[i] !== undefined) return; stopAudio(); setIdx(i); setFeedback(null); clearTransState(); setSegCur(0); setPTag(""); setPWord(""); setIType(""); setIExpl(""); setCoachQ(""); setCoachA(""); }
  function record(i: number, v: Verdict) { stopAudio(); setResults((r) => ({ ...r, [i]: v })); setFeedback(i); }
  function next() { const n = [...Array(total).keys()].find((i) => results[i] === undefined); stopAudio(); setFeedback(null); clearTransState(); setSegCur(0); setPTag(""); setPWord(""); setIType(""); setIExpl(""); setCoachQ(""); setCoachA(""); if (n === undefined) setScreen("result"); else setIdx(n); }

  // --- multi-segment transcription: step through every user turn of the call ---
  const transSegs = q && q.type === "trans" ? q.segments : [];
  const qState = (idx >= 0 ? segState[idx] : undefined) || {};
  const transAllResolved = transSegs.length > 0 && transSegs.every((_, si) => qState[si] !== undefined);
  function setSeg(si: number, kind: SegKind) { setSegState((s) => ({ ...s, [idx]: { ...(s[idx] || {}), [si]: kind } })); }
  function firstUnresolved(state: Record<number, SegKind>) { return transSegs.findIndex((_, si) => state[si] === undefined); }
  function gotoSeg(si: number) { clearTransState(); setSegCur(si); const g = transSegs[si]; if (g) play(idx, undefined, g.s, g.e); }
  const segUnclearState = (idx >= 0 ? segUnclear[idx] : undefined) || {};
  function toggleUnclear(si: number) { setSegUnclear((s) => ({ ...s, [idx]: { ...(s[idx] || {}), [si]: !((s[idx] || {})[si]) } })); }
  // keyboard shortcuts, exactly like the workbench: Space = replay segment, ←/→ = prev/next
  useEffect(() => {
    if (screen !== "work" || feedback !== null || !q || q.type !== "trans") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      if (e.code === "Space") { e.preventDefault(); playCurSeg(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (segCur > 0) gotoSeg(segCur - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (segCur < transSegs.length - 1) gotoSeg(segCur + 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, feedback, idx, segCur, qs.length]);
  // ✓ Correct / {noise} / 🗑 resolve instantly and jump to the next open segment;
  // ✏ Edit opens the transliteration editor prefilled with the ASR text.
  function commitSeg(kind: SegKind) {
    // judge the clip, then STOP · the reviewer sees why they were right or wrong
    // before moving on. Advancing is a deliberate tap (advanceSeg).
    setSeg(segCur, kind);
    clearTransState();
  }
  function advanceSeg() {
    const nu = transSegs.findIndex((_, si) => qState[si] === undefined);
    if (nu >= 0) { setSegCur(nu); return; }   // next unjudged clip
    // every clip judged -> grade the call and go straight on. No call-level
    // feedback screen: each clip already told them what they got right or wrong.
    let caughtAll = true, falseFlags = 0;
    transSegs.forEach((s2, si) => {
      const flagged = qState[si] !== "correct";
      if (!s2.isCorrect && !flagged) caughtAll = false;
      if (s2.isCorrect && flagged) falseFlags += 1;
    });
    const verdict: Verdict = (caughtAll && falseFlags === 0) ? "match" : "miss";
    stopAudio();
    const after = { ...results, [idx]: verdict };
    setResults(after);
    clearTransState(); setSegCur(0); setPTag(""); setPWord(""); setIType(""); setIExpl(""); setCoachQ(""); setCoachA("");
    const n = [...Array(total).keys()].find((i) => after[i] === undefined);
    if (n === undefined) setScreen("result"); else setIdx(n);
  }
  function resolveSeg(kind: SegKind) {
    if (!q || q.type !== "trans") return;
    // Wrong opens the correction editor (ASR prefilled) instead of resolving instantly.
    if (kind === "wrong") { setTKind("wrong"); onRoman(transSegs[segCur]?.asr || ""); return; }
    commitSeg(kind);
  }
  function saveSegEdit() {
    if (!q || q.type !== "trans" || !goldOf(tTokens, tText)) return;
    commitSeg("wrong");
  }
  function submitTransCall() {
    if (!q || q.type !== "trans" || !transAllResolved) return;
    let caughtAll = true, falseFlags = 0;
    transSegs.forEach((seg, si) => {
      const flagged = qState[si] !== "correct";      // reviewer said this ASR is not right
      if (!seg.isCorrect && !flagged) caughtAll = false;
      if (seg.isCorrect && flagged) falseFlags += 1;
    });
    record(idx, (caughtAll && falseFlags === 0) ? "match" : "miss");
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
    const cWrong = c.type === "trans" ? c.segments.filter((s) => !s.isCorrect) : [];
    const ctx = c.type === "trans"
      ? `Task: transcription review of a whole call (${c.segments.length} user turns). The wrong segments were: ${cWrong.length ? cWrong.map((s) => `at ${s.ts} ASR "${s.asr}" should be "${s.golden}"`).join("; ") : "none, every turn was transcribed correctly"}. Expert note: ${c.explain}`
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

  const canApply = fullName.trim().length >= 2 && !!stateName && langs.length > 0 && phone.replace(/\D/g, "").length >= 10;
  const agreementLabel = done ? Math.round((ptsSum / done) * 100) + "%" : "-";
  const pct = total ? Math.round((ptsSum / total) * 100) : 0;
  const transN = qs.filter((x) => x.type === "trans").length;

  function Row({ i }: { i: number }) {
    const st = results[i]; const cur = idx === i && screen === "work"; const answered = st !== undefined;
    const label = qs[i].type === "trans" ? "full call · transcription" : qs[i].type === "pron" ? "call · pronunciation" : "call · issue log";
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
  const fWrong = fq && fq.type === "trans" ? fq.segments.filter((s) => !s.isCorrect) : [];

  // which user turn is playing right now: the k-th telemetry anchor whose window
  // holds the playhead maps to the k-th user turn in the transcript. This makes
  // the transcript follow playback exactly like the /transcribe workbench.
  function TranscriptPanel({ item, highlight, activeUserIdx }: { item: Q; highlight?: string; activeUserIdx: number }) {
    const turns = item.turns || [];
    const hl = (highlight || "").trim().toLowerCase().slice(0, 30);
    let uSeen = -1;
    return (
      <div className="jn-transcript" style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
        <span style={{ fontSize: 11, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", position: "sticky", top: 0, background: "#fff", paddingBottom: 4 }}>Call transcript · {turns.length} turns</span>
        {turns.map((t, i) => {
          if (t.who === "user") uSeen += 1;
          const isPlaying = t.who === "user" && uSeen === activeUserIdx;
          const isHl = !isPlaying && hl.length > 3 && t.text.toLowerCase().includes(hl);
          return (
            <div key={i} data-jn-active={isPlaying ? "1" : undefined} style={{ alignSelf: t.who === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: isPlaying ? "#d7ebff" : isHl ? "#fdecc8" : t.who === "user" ? "#eef4fd" : "#f5f7f9", border: isPlaying ? "1.5px solid #5b8def" : isHl ? "1.5px solid #b7791f" : "1px solid #e9edf1", borderRadius: 10, padding: "5px 9px", fontSize: 12.5, lineHeight: 1.45, boxShadow: isPlaying ? "0 0 0 3px rgba(91,141,239,.15)" : "none", transition: "background .15s" }}>
              <span style={{ display: "block", fontSize: 9, color: t.who === "user" ? "#5b8def" : GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.who}{isPlaying ? " · now playing" : ""}</span>{t.text}
            </div>
          );
        })}
        {turns.length === 0 && <span style={{ fontSize: 12, color: MUT }}>No transcript available for this call.</span>}
      </div>
    );
  }

  const activeQ = feedback !== null ? fq : q;
  // the anchor (user turn) the playhead is currently inside / just past
  const activeUserIdx = (() => {
    const ans = activeQ?.anchors || [];
    if (!ans.length) return -1;
    const inside = ans.findIndex((a) => playhead >= a.s - 0.25 && playhead <= a.e + 0.35);
    if (inside >= 0) return inside;
    let last = -1;
    for (let i = 0; i < ans.length; i++) { if (playhead >= ans[i].s - 0.25) last = i; else break; }
    return last;
  })();
  // keep the active user turn scrolled into view as it plays
  useEffect(() => {
    if (activeUserIdx < 0) return;
    const el = document.querySelector('[data-jn-active="1"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeUserIdx]);

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ width: "100%", background: "#f5f7f9", display: "flex", flexDirection: "column", flex: 1 }}>

        <div className="jn-top" style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 32px" }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN }} />
          <span className={grotesk.className} style={{ fontWeight: 700, fontSize: 16 }}>realloop</span>
          <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>{screen === "apply" ? "Become a reviewer" : screen === "result" ? "Result" : `Assignment · ${done}/${total || 5}`}</span>
          <span style={{ flex: 1 }} />
          {screen === "work" && done > 0 && <span style={{ borderRadius: 999, background: "#e7f4ee", padding: "4px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>your agreement: {agreementLabel}</span>}
          <span style={{ fontSize: 12.5, color: MUT }}>Open roles</span>
        </div>

        {screen === "apply" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
            <div className="jn-apply" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 32, padding: "26px 32px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className={`jn-hero ${grotesk.className}`} style={{ fontWeight: 600, fontSize: 30, lineHeight: 1.12, letterSpacing: "-.4px" }}>Review AI phone calls.<br />Work from anywhere, anytime.</div>
                  <div style={{ fontSize: 14, color: MUT, marginTop: 7, maxWidth: 520 }}>A laptop or phone and headphones are all you need. No resume, no interview · your agreement score decides your tier and pay.</div>
                </div>
                <div className="jn-pay" style={{ ...card, padding: "16px 20px", display: "flex", gap: 18 }}>
                  <div style={{ flex: 1 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>₹300/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 2 · from day one</div></div>
                  <div style={{ flex: 1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23, color: GREEN }}>₹500/hr</div><div style={{ fontSize: 11, color: MUT }}>Tier 1 · high agreement</div></div>
                  <div style={{ flex: 1.1, borderLeft: "1px solid #eef2f6", paddingLeft: 18 }}><div className={grotesk.className} style={{ fontWeight: 600, fontSize: 23 }}>₹2,000+</div><div style={{ fontSize: 11, color: MUT }}>top reviewers make / day · paid weekly</div></div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>The work on offer</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {JOBS_REVIEWER.map((j) => (
                      <div key={j.t} className="jn-job" style={{ ...card, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>{j.t}</div>
                          <div style={{ fontSize: 12, color: MUT, marginTop: 1 }}>{j.d}</div>
                        </div>
                        <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", flex: "none" }}>{j.pay}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUT, marginTop: 7 }}>Your 2-minute assignment samples the reviewer and transcriptor work. Do well and you unlock all of them.</div>
                </div>
              </div>
              <div style={{ ...card, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16 }}>Apply now</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Full name</div>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Languages you speak</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((n) => { const on = langs.includes(n); return <span key={n} onClick={() => setLangs((s) => on ? s.filter((x) => x !== n) : [...s, n])} style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "4px 10px", fontSize: 11.5, cursor: "pointer" }}>{n}</span>; })}
                  </div>
                </div>
                <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Education</div><div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>{["12th", "Graduate", "Postgrad"].map((n) => <div key={n} onClick={() => setEdu(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === edu ? "#fff" : "transparent", color: n === edu ? INK : MUT, boxShadow: n === edu ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>)}</div></div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>State</div>
                  <select value={stateName} onChange={(e) => setStateName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${stateName ? "#d6dee6" : "#e2b3b3"}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", background: "#fff", color: stateName ? INK : "#93a1ae" }}>
                    <option value="">Select your state</option>
                    {STATES.map((s) => <option key={s} value={s} style={{ color: INK }}>{s}</option>)}
                  </select>
                </div>
                <div><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Hours per week</div><div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>{["<5", "5-15", "15+"].map((n) => <div key={n} onClick={() => setHours(n)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "6px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: n === hours ? "#fff" : "transparent", color: n === hours ? INK : MUT, boxShadow: n === hours ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{n}</div>)}</div></div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Phone (WhatsApp)</div>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10, color: "#93a1ae", marginTop: 3 }}>Only for your login code and onboarding call. Never shown anywhere.</div>
                </div>
                <div style={{ flex: 1, minHeight: 12 }} />
                <div onClick={() => { if (!canApply) return; setScreen("work"); fetch("/api/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, full_name: fullName, state: stateName, languages: langs, education: edu, hours, phone }) }).then((r) => r.json()).then((d) => { if (d.ok) setApplicantId(d.id); }).catch(() => {}); }} style={{ height: 46, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: canApply ? 1 : 0.45 }}>Apply → your assignment is ready</div>
                <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>{canApply ? "No wait · 7 real questions, about 3 minutes." : "Add your name, state, a language and a valid phone number."}</div>
              </div>
            </div>
            <div className="jn-stats" style={{ display: "flex", gap: 12, padding: "0 32px 26px", flexWrap: "wrap" }}>
              {[["10", "reviewers, scaling to 50"], ["~200 hrs", "of paid work delivered"], ["weekly", "payouts, UPI"], ["7", "open roles"]].map(([n, l]) => (
                <div key={l} style={{ ...card, flex: 1, padding: "14px 16px" }}><div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{n}</div><div style={{ fontSize: 11.5, color: MUT }}>{l}</div></div>
              ))}
            </div>
          </div>
        )}

        {screen === "work" && (
          <div className="jn-work" style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 16, padding: "18px 32px", flex: 1, alignItems: "start", width: "100%", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
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
                <audio ref={audioRef} preload="none" onEnded={() => setPlayingIdx(null)} onTimeUpdate={(e) => { const a = e.target as HTMLAudioElement; setPlayhead(a.currentTime); if (stopAtRef.current !== null && a.currentTime >= stopAtRef.current) { a.pause(); stopAtRef.current = null; setPlayingIdx(null); } }} style={{ display: "none" }} />
              )}

              {idx === -1 && feedback === null && (
                <div style={{ ...card, borderRadius: 14, padding: 40, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
                  <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 22 }}>Your {total || 6}-question assignment</div>
                  <div style={{ fontSize: 13.5, color: MUT, maxWidth: 440 }}>{transN} transcription checks and {total - transN} listen-and-judge questions, with the full call in front of you. Your agreement with the expert decides your tier.</div>
                  <div onClick={() => total && openQ(0)} style={{ height: 46, minWidth: 220, borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "0 22px", opacity: total ? 1 : 0.5 }}>{total ? "Start question 1 ▶" : "Loading…"}</div>
                </div>
              )}

              {feedback === null && q && q.type === "trans" && transSegs[segCur] && (() => {
                const seg = transSegs[segCur];
                const curKind = qState[segCur];
                const isPlaying = playingIdx === idx;
                const resolved = Object.keys(qState).length;
                const vbtn = (bg: string, label: string, kind: SegKind, active: boolean) => (
                  <button onClick={() => resolveSeg(kind)} style={{ height: 56, borderRadius: 12, border: `1.5px solid ${bg}`, background: active ? bg : "#fff", color: active ? "#fff" : bg, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{label}</button>
                );
                return (
                  <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 15, maxWidth: 460, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Clip {segCur + 1} of {transSegs.length}</span>
                      <span style={{ flex: 1 }} />
                      <span className={mono.className} style={{ fontSize: 11.5, color: GREEN }}>{resolved}/{transSegs.length} done</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {transSegs.map((_, si) => { const k = qState[si]; return <span key={si} style={{ flex: 1, height: 5, borderRadius: 3, background: si === segCur ? T_AMBER : k ? T_GREEN : "#e2e8ee" }} />; })}
                    </div>
                    <button onClick={() => play(idx, undefined, seg.s, seg.e)} style={{ height: 70, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 17, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{isPlaying ? "❚❚" : "▶"}</span>{isPlaying ? "Playing…" : "Play the clip"}
                    </button>
                    <div style={{ background: "#f5f7f9", borderRadius: 10, padding: "13px 15px" }}>
                      <div style={{ fontSize: 10.5, color: MUT, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>The AI heard the user say</div>
                      <div style={{ fontSize: 18, lineHeight: 1.5, color: INK }}>{seg.asr || "·"}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: MUT, textAlign: "center" }}>Listen · does the text match what the user said?</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {vbtn(T_GREEN, "✓ Correct", "correct", false)}
                      {vbtn(T_ORANGE, "✗ Wrong · fix it", "wrong", tKind === "wrong")}
                      {vbtn(T_SLATE, "{noise} · unclear / not speech", "noise", false)}
                    </div>
                    {tKind === "wrong" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #eef2f6", paddingTop: 12 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>Type what you actually heard</div>
                        <div style={{ fontSize: 11.5, color: MUT }}>Type in Roman · Hindi words convert to Devanagari, English stays as-is. Tap a word to fix it.</div>
                        <textarea value={tText} rows={2} autoFocus onChange={(e) => onRoman(e.target.value)} placeholder="e.g. haan didi main kaam kar rahi hoon" style={{ width: "100%", boxSizing: "border-box", fontSize: 16, padding: "10px 12px", border: "1px solid #cfd8e0", borderRadius: 10, fontFamily: "inherit" }} />
                        {tTokens.length > 0 && (
                          <div style={{ background: "#f2faf7", border: "1px solid #cfe3da", borderRadius: 10, padding: "10px 12px", fontSize: 17, lineHeight: 1.9 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 2 }}>
                              {tTokens.map((t, ti) => (
                                <span key={ti} onClick={async () => {
                                  if (altPick?.ti === ti) { setAltPick(null); return; }
                                  setAltPick({ ti, alts: [], loading: true });
                                  const core = t.src.replace(/^[^\wऀ-ॿ{]+|[^\wऀ-ॿ}]+$/g, "");
                                  try { const d = await fetch("/api/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word: core }) }).then((r) => r.json()); setAltPick((p) => (p && p.ti === ti ? { ...p, alts: d.alts || [], loading: false } : p)); }
                                  catch { setAltPick((p) => (p && p.ti === ti ? { ...p, loading: false } : p)); }
                                }} title="tap to fix this word" style={{ cursor: "pointer", padding: "1px 4px", borderRadius: 4, marginRight: 2, background: altPick?.ti === ti ? "#f9dcae" : t.converted ? "#fdecc8" : "transparent" }}>{t.converted ? t.out : t.src}</span>
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: "#8a988f", marginTop: 3 }}>highlighted = converted to Devanagari · tap any word to fix it</div>
                            {altPick && tTokens[altPick.ti] && (() => {
                              const tk0 = tTokens[altPick.ti];
                              const apply = (out: string | null) => { const tk = [...tTokens]; tk[altPick.ti] = out === null ? { ...tk[altPick.ti], converted: false } : { ...tk[altPick.ti], out, converted: true }; setTTokens(tk); setAltPick(null); };
                              return (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: "1px dashed #cfe3da", marginTop: 6, paddingTop: 7 }}>
                                  <span style={{ fontSize: 12, color: "#5b6b64" }}>“{tk0.src}” =</span>
                                  {altPick.loading && <span style={{ fontSize: 12, color: "#8a988f" }}>…</span>}
                                  {altPick.alts.map((a) => (<button key={a} onClick={() => apply(a)} style={{ fontSize: 16, padding: "3px 12px", borderRadius: 6, cursor: "pointer", border: tk0.converted && tk0.out === a ? "2px solid #1f7a5c" : "1px solid #cfe3da", background: "#fff" }}>{a}</button>))}
                                  <button onClick={() => apply(null)} style={{ fontSize: 13, padding: "3px 12px", borderRadius: 6, cursor: "pointer", border: !tk0.converted ? "2px solid #1f7a5c" : "1px solid #cfd4d1", background: "#fff", color: "#4a5568" }}>{tk0.src}</button>
                                  <button onClick={() => setAltPick(null)} style={{ fontSize: 12, border: "none", background: "transparent", color: "#8a988f", cursor: "pointer" }}>✕</button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {lint(goldOf(tTokens, tText)).map((w) => <div key={w} style={{ fontSize: 11.5, color: "#b7791f" }}>⚠ {w}</div>)}
                        <button onClick={saveSegEdit} disabled={!goldOf(tTokens, tText)} style={{ height: 50, borderRadius: 12, border: "none", background: goldOf(tTokens, tText) ? T_GREEN : "#c8d6d0", color: "#fff", fontSize: 15.5, fontWeight: 600, cursor: goldOf(tTokens, tText) ? "pointer" : "not-allowed" }}>Save &amp; next clip</button>
                      </div>
                    )}

                    {/* per-clip verdict · shown the moment this clip is judged */}
                    {curKind !== undefined && (() => {
                      const flagged = curKind !== "correct";
                      const right = seg.isCorrect ? !flagged : flagged;
                      const last = transSegs.every((_, si) => qState[si] !== undefined);
                      const why = seg.isCorrect
                        ? "The transcript matched the audio here. Not flagging a clean clip is half the skill · false flags waste expert time."
                        : `${whyOf(seg.asr, seg.golden)}.`;
                      return (
                        <div ref={(el) => { if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }}
                          style={{ borderRadius: 14, padding: 15, display: "flex", flexDirection: "column", gap: 10,
                          background: right ? "#f2faf6" : "#fffafa", border: `1.5px solid ${right ? T_GREEN : T_RED}` }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: right ? T_GREEN : T_RED }}>
                            {seg.isCorrect
                              ? (right ? "✓ Right · this clip was correct" : "✗ False flag · this clip was correct")
                              : (right ? "✓ Caught it · the transcript was wrong" : "✗ Missed it · the transcript was wrong")}
                          </span>
                          <span style={{ fontSize: 14, lineHeight: 1.6, color: "#3f4a44" }}>{why}</span>
                          {!seg.isCorrect && (
                            <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 10, padding: "10px 12px", fontSize: 14.5, lineHeight: 1.7 }}>
                              <span style={{ color: MUT }}>heard:</span> <b style={{ color: T_GREEN }}>{seg.golden}</b>
                            </div>
                          )}
                          <button onClick={advanceSeg} style={{ height: 48, borderRadius: 12, border: "none", background: T_GREEN, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                            {last ? "See how you did →" : "Next clip →"}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {feedback === null && q && q.type === "pron" && (() => {
                const isPlaying = playingIdx === idx;
                return (
                  <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 15, maxWidth: 460, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Pronunciation</span>
                      <span style={{ flex: 1 }} />
                      <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>question {idx + 1} of {total}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: MUT, lineHeight: 1.5 }}>Play the moment and listen for a name, city or brand the <b style={{ color: INK }}>agent</b> mispronounced.</div>
                    <button onClick={() => play(idx, q.ts)} style={{ height: 70, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 17, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{isPlaying ? "❚❚" : "▶"}</span>{isPlaying ? "Playing…" : "Play the moment"}
                    </button>
                    <div style={{ fontSize: 12.5, color: MUT, textAlign: "center" }}>What kind of word did the agent mispronounce?</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {q.options.map((o) => (
                        <button key={o} onClick={() => { setPTag(o); record(idx, o === q.content_tag ? "match" : "miss"); }} style={{ height: 56, borderRadius: 12, border: "1.5px solid #d6dee6", background: "#fff", color: INK, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>{o}</button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {feedback === null && q && q.type === "issue" && (() => {
                const isPlaying = playingIdx === idx;
                return (
                  <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 15, maxWidth: 460, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Spot the issue</span>
                      <span style={{ flex: 1 }} />
                      <span className={mono.className} style={{ fontSize: 11.5, color: MUT }}>question {idx + 1} of {total}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: MUT, lineHeight: 1.5 }}>{q.setup}</div>
                    <button onClick={() => play(idx, q.ts)} style={{ height: 70, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 17, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{isPlaying ? "❚❚" : "▶"}</span>{isPlaying ? "Playing…" : "Play the moment"}
                    </button>
                    <div style={{ fontSize: 12.5, color: MUT, textAlign: "center" }}>What kind of issue is this?</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {q.options.map((o) => (
                        <button key={o} onClick={() => { setIType(o); record(idx, o === q.correct ? "match" : "miss"); }} style={{ minHeight: 54, borderRadius: 12, border: "1.5px solid #d6dee6", background: "#fff", color: INK, fontSize: 15, fontWeight: 600, cursor: "pointer", padding: "8px 12px", lineHeight: 1.3 }}>{o}</button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {feedback !== null && fq && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 660 }}>
                  <div style={{ background: fVerdict === "match" ? "#f2faf6" : "#fffafa", border: `1.5px solid ${fVerdict === "match" ? GREEN : RED}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
                    <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: fVerdict === "match" ? GREEN : RED }}>
                      {fq.type === "trans"
                        ? (fVerdict === "match" ? (fWrong.length ? `✓ Nailed it: caught all ${fWrong.length} wrong segment${fWrong.length > 1 ? "s" : ""}, no false flags` : "✓ Right: a clean call, you flagged nothing") : "✗ Not quite: check the segments below")
                        : fq.type === "pron"
                          ? (fVerdict === "match" ? `✓ Right: it's a ${fq.content_tag}` : `✗ Not quite: it's a ${fq.content_tag}`)
                          : (fVerdict === "match" ? `✓ Exactly: ${fq.correct.toLowerCase()}` : `✗ Not quite: the expert logged ${fq.correct.toLowerCase()}`)}
                    </span>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{fq.explain}</div>
                    {fq.type === "trans"
                      ? <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 5 }}>
                          {fWrong.length === 0
                            ? <span style={{ color: MUT }}>Every one of the {fq.segments.length} user turns was transcribed correctly · the right move was to mark them all correct.</span>
                            : fWrong.map((s, i) => <span key={i}><span className={mono.className} style={{ color: MUT, fontSize: 11.5 }}>@{s.ts}</span> <span style={{ color: MUT }}>ASR:</span> {s.asr} <span style={{ color: MUT }}>→</span> <b style={{ color: GREEN }}>{s.golden}</b></span>)}
                        </div>
                      : fq.type === "pron"
                        ? <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13 }}><span style={{ color: MUT }}>Expert logged:</span> <b>{fq.word_heard}</b> · <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>{fq.content_tag}</span></div>
                        : <div style={{ background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "9px 11px", fontSize: 13 }}><span style={{ color: MUT }}>Expert logged:</span> <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, padding: "2px 8px", fontSize: 11.5, fontWeight: 600 }}>{fq.correct}</span></div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div onClick={() => play(fi, fq.type === "trans" ? undefined : fq.ts, fq.type === "trans" ? (fWrong[0]?.s ?? 0) : undefined)} style={{ width: 26, height: 26, borderRadius: 999, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, cursor: "pointer" }}>{playingIdx === fi ? "❚❚" : "▶"}</div>
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
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>That&apos;s it for now · <b style={{ color: INK }}>our team will message you on WhatsApp</b> on the number you applied with, with your next steps. Keep an eye on it. Hold ≥75% across 2 real batches and you move to Tier 1 at ₹500/hr.</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, background: "#fff", border: "1px solid #bfe2d2", borderRadius: 9, padding: "10px 12px", fontSize: 13, fontWeight: 600, color: GREEN }}>💬 Watch for a WhatsApp message from realloop</div>
                </div>
              ) : (
                <div style={{ background: "#fffdf7", border: "1.5px solid #d99a2b", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <span className={grotesk.className} style={{ fontWeight: 600, fontSize: 16, color: AMBER }}>Not yet · you need {PASS}%</span>
                  <span style={{ fontSize: 13, color: "#4d5a66", lineHeight: 1.45 }}>Retake in 7 days with new questions. Re-read the expert feedback on the ones you missed · that's exactly what the retake tests.</span>
                </div>
              )}
              <span onClick={() => { stopAudio(); setScreen("apply"); setIdx(-1); setResults({}); setFeedback(null); setPhone(""); setFullName(""); setStateName(""); }} style={{ fontSize: 12, color: MUT, cursor: "pointer", textDecoration: "underline" }}>restart</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
