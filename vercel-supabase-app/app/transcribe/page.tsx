"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// Transcription workbench — golden dataset, audio-first.
// The unit of work is a USER-CHANNEL WAVEFORM SPIKE, not a transcript turn:
// every detected user-speech segment must be listened to and resolved. ASR
// turns are mapped onto spikes where they exist (verdict: correct / edit);
// spikes with no transcript are written from scratch. Reviewers type Roman;
// Hindi words are converted to Devanagari in real time and highlighted so a
// wrong conversion is one click to flip.

type Turn = { role: string; text: string };
type Call = { execution_id: string; agent_name?: string; duration_sec?: number; recording_url?: string; turns: Turn[] };
type QueueItem = { queue_id: string; execution_id: string; agent_name?: string; duration_sec?: number; reviewed: boolean };

type Seg = { start: number; end: number; turnIndex: number | null };
type Tok = { src: string; out: string; converted: boolean };
type SegState = {
  status: "pending" | "done";
  kind: "correct" | "wrong" | "missing" | "noise" | null;
  wrongLang: "same" | "different";
  roman: string;
  tokens: Tok[];
  unclear: boolean;
};

const MODE = "timing_transcription";

const RULES: Array<[string, string]> = [
  ["Script", "Hindi in Devanagari, English in Roman — never translate (\"pepsi के दो can\"). Type in Roman; the tool converts."],
  ["Numbers", "As spoken words, not digits — पांच / five, not 5"],
  ["Decimals", "No \".\" — \"two point two five\", written out"],
  ["Names", "Indian names/places in Devanagari; foreign in Roman"],
  ["No shortcuts", "okay not ok · please not pls · you not u"],
  ["Noise", "Unclear / gibberish / non-speech → {noise}, never guess"]
];

const SHORTHAND: Record<string, string> = {
  u: "you", ur: "your", pls: "please", plz: "please", ok: "okay", k: "okay",
  tmrw: "tomorrow", thx: "thanks", bcoz: "because", bcz: "because", gud: "good", hv: "have", r: "are", y: "why"
};

function lint(text: string): string[] {
  const w: string[] = [];
  if (/\d+\.\d+/.test(text)) w.push("Decimal digits — write as spoken: \"two point two five\"");
  else if (/\d/.test(text)) w.push("Digits — write numbers as words (पांच / five)");
  for (const word of text.toLowerCase().split(/[^a-z0-9']+/)) if (SHORTHAND[word]) w.push(`"${word}" → "${SHORTHAND[word]}"`);
  return [...new Set(w)];
}

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function words(t: string) { return t.trim().split(/\s+/).filter(Boolean); }
function goldOf(tokens: Tok[], roman: string) {
  return tokens.length ? tokens.map((t) => (t.converted ? t.out : t.src)).join(" ") : roman.trim();
}

// ---------- waveform analysis: user-channel spikes ----------
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
function segmentsFromEnv(env: Float32Array, hop: number) {
  const sorted = [...env].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const thr = Math.max(0.015, p95 * 0.18);
  const segs: Array<{ start: number; end: number }> = [];
  let s = -1;
  for (let i = 0; i <= env.length; i++) {
    const on = i < env.length && env[i] > thr;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { segs.push({ start: s * hop, end: i * hop }); s = -1; }
  }
  // merge gaps < 0.55s, drop < 0.35s
  const merged: typeof segs = [];
  for (const g of segs) {
    const last = merged[merged.length - 1];
    if (last && g.start - last.end < 0.55) last.end = g.end;
    else merged.push({ ...g });
  }
  return merged.filter((g) => g.end - g.start >= 0.35);
}
// monotonic DP: map segments to user turns by duration-vs-wordcount fit
function alignSegs(segs: Array<{ start: number; end: number }>, turnWords: number[]) {
  const m = segs.length, n = turnWords.length;
  const totalDur = segs.reduce((a, g) => a + (g.end - g.start), 0) || 1;
  const totalW = turnWords.reduce((a, b) => a + b, 0) || 1;
  const spw = totalDur / totalW;
  const INF = 1e9;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const bk: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 0; i <= m; i++) for (let k = 0; k <= n; k++) {
    if (dp[i][k] === INF) continue;
    if (i < m && k < n) {
      const dur = segs[i].end - segs[i].start;
      const c = dp[i][k] + Math.abs(dur - turnWords[k] * spw);
      if (c < dp[i + 1][k + 1]) { dp[i + 1][k + 1] = c; bk[i + 1][k + 1] = 1; }
    }
    if (i < m) { // unmatched spike (candidate missing speech)
      const c = dp[i][k] + (segs[i].end - segs[i].start) * 0.9;
      if (c < dp[i + 1][k]) { dp[i + 1][k] = c; bk[i + 1][k] = 2; }
    }
    if (k < n) { // turn with no spike
      const c = dp[i][k] + turnWords[k] * spw * 1.1;
      if (c < dp[i][k + 1]) { dp[i][k + 1] = c; bk[i][k + 1] = 3; }
    }
  }
  const map = new Array(m).fill(null) as Array<number | null>;
  let i = m, k = n;
  while (i > 0 || k > 0) {
    const b = bk[i][k];
    if (b === 1) { map[i - 1] = k - 1; i--; k--; }
    else if (b === 2) { i--; }
    else { k--; }
  }
  return map;
}

export default function Transcribe() {
  const [email, setEmail] = useState("");
  const [display, setDisplay] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [call, setCall] = useState<Call | null>(null);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [userEnv, setUserEnv] = useState<{ env: Float32Array; hop: number } | null>(null);
  const [approxMode, setApproxMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [cur, setCur] = useState(0);
  const [states, setStates] = useState<Record<number, SegState>>({});
  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    const e = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
    setEmail(e); setDisplay(window.localStorage.getItem("auditReviewerDisplay") || e);
  }, []);
  useEffect(() => {
    if (!email) return;
    fetch(`/api/calls?reviewer=${encodeURIComponent(email)}&audit_mode=${MODE}`)
      .then((r) => r.json()).then((d) => setQueue((d.calls || []).filter((c: QueueItem) => c.execution_id)))
      .catch(() => setQueue([]));
  }, [email, submittedId]);

  const st = (i: number): SegState =>
    states[i] || { status: "pending", kind: null, wrongLang: "same", roman: "", tokens: [], unclear: false };
  const patch = (i: number, p: Partial<SegState>) => setStates((s) => ({ ...s, [i]: { ...st(i), ...p } }));
  const doneCount = segs.filter((_, i) => st(i).status === "done").length;
  const allDone = segs.length > 0 && doneCount === segs.length;

  async function openCall(item: QueueItem) {
    setCall(null); setSegs([]); setStates({}); setCur(0); setApproxMode(false); setUserEnv(null);
    const d: Call = await fetch(`/api/calls/${item.execution_id}`).then((r) => r.json());
    setCall(d);
    setAnalyzing(true);
    try {
      const buf = await fetch(`/api/audio?url=${encodeURIComponent(d.recording_url || "")}`).then((r) => r.arrayBuffer());
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audio = await ctx.decodeAudioData(buf);
      const userTurnIdx = d.turns.map((t, i) => ({ t, i })).filter((x) => x.t.role !== "assistant");
      const wc = userTurnIdx.map((x) => words(x.t.text).length);
      let chosen: { env: Float32Array; hop: number } | null = null;
      let chosenSegs: Array<{ start: number; end: number }> = [];
      if (audio.numberOfChannels >= 2) {
        // score each channel: how well do its spikes fit the user turns?
        let best = Infinity;
        for (let ch = 0; ch < 2; ch++) {
          const e = envelope(audio.getChannelData(ch), audio.sampleRate);
          const gs = segmentsFromEnv(e.env, e.hop);
          const mapb = alignSegs(gs, wc);
          const matched = mapb.filter((x) => x !== null).length;
          const score = Math.abs(gs.length - wc.length) * 2 - matched * 1.5;
          if (score < best) { best = score; chosen = e; chosenSegs = gs; }
        }
      } else {
        setApproxMode(true);
        const e = envelope(audio.getChannelData(0), audio.sampleRate);
        chosen = e; chosenSegs = segmentsFromEnv(e.env, e.hop);
      }
      ctx.close();
      const map = alignSegs(chosenSegs, wc);
      const built: Seg[] = chosenSegs.map((g, gi) => ({
        start: Math.max(0, g.start - 0.2), end: g.end + 0.2,
        turnIndex: map[gi] === null ? null : userTurnIdx[map[gi] as number].i
      }));
      setSegs(built); setUserEnv(chosen);
      // prefill matched segments' roman with nothing (ASR text shown separately)
      setTimeout(() => playSeg(0, built), 300);
    } catch {
      // decode failed — approx mode from word-count estimates
      setApproxMode(true);
      const dur = Number(d.duration_sec || 0);
      const uidx = d.turns.map((t, i) => ({ t, i })).filter((x) => x.t.role !== "assistant");
      const counts = d.turns.map((t) => words(t.text).length);
      const total = counts.reduce((a, b) => a + b, 0) || 1;
      let before = 0; const est: Record<number, { s: number; e: number }> = {};
      d.turns.forEach((t, i) => { est[i] = { s: (before / total) * dur, e: ((before + counts[i]) / total) * dur }; before += counts[i]; });
      setSegs(uidx.map((x) => ({ start: est[x.i].s, end: est[x.i].e, turnIndex: x.i })));
    } finally {
      setAnalyzing(false);
    }
  }

  function playSeg(i: number, list: Seg[] = segs) {
    const g = list[i]; const a = audioRef.current;
    if (!g || !a) return;
    setCur(i);
    a.currentTime = Math.max(0, g.start - 0.15);
    stopAtRef.current = g.end + 0.15;
    a.play().catch(() => {});
  }
  function onTime() {
    const a = audioRef.current;
    if (a && stopAtRef.current !== null && a.currentTime >= stopAtRef.current) { a.pause(); stopAtRef.current = null; }
  }
  function next(i = cur) {
    const nxt = segs.findIndex((_, k) => k > i && st(k).status === "pending");
    const target = nxt >= 0 ? nxt : Math.min(i + 1, segs.length - 1);
    playSeg(target);
  }

  // waveform strip
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !userEnv || !call) return;
    const W = cv.width = cv.offsetWidth * 2, H = cv.height = 96;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const { env, hop } = userEnv;
    const dur = env.length * hop;
    const max = Math.max(...env, 0.001);
    ctx.fillStyle = "#c8d6d0";
    for (let x = 0; x < W; x++) {
      const v = env[Math.floor((x / W) * env.length)] / max;
      const h = Math.max(1, v * (H - 8));
      ctx.fillRect(x, (H - h) / 2, 1, h);
    }
    segs.forEach((g, i) => {
      const x1 = (g.start / dur) * W, x2 = (g.end / dur) * W;
      ctx.fillStyle = i === cur ? "rgba(183,121,31,0.35)" : st(i).status === "done" ? "rgba(31,122,92,0.28)" : "rgba(192,86,33,0.18)";
      ctx.fillRect(x1, 0, Math.max(2, x2 - x1), H);
    });
  }, [userEnv, segs, states, cur, call]);

  // roman -> devanagari (debounced per current segment)
  function onRoman(i: number, value: string) {
    patch(i, { roman: value });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const d = await fetch("/api/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) }).then((r) => r.json());
        setStates((s) => {
          const now = s[i]; if (!now || now.roman !== value) return s; // stale
          return { ...s, [i]: { ...now, tokens: d.tokens || [] } };
        });
      } catch { /* keep roman */ }
    }, 450);
  }

  function resolve(i: number, kind: SegState["kind"]) {
    const s = st(i);
    if (kind === "correct" || kind === "noise") {
      patch(i, { kind, status: "done", tokens: kind === "noise" ? [] : s.tokens, roman: kind === "noise" ? "{noise}" : s.roman });
      next(i);
    } else {
      patch(i, { kind }); // wrong / missing -> editor opens; done on save
    }
  }
  function saveEdit(i: number) {
    const s = st(i);
    const gold = goldOf(s.tokens, s.roman);
    if (!gold && !s.unclear) return;
    patch(i, { status: "done" });
    next(i);
  }

  async function submit() {
    if (!call || !allDone || submitting) return;
    setSubmitting(true);
    try {
      const issues = segs.map((g, i) => {
        const s = st(i);
        const asr = g.turnIndex !== null ? call.turns[g.turnIndex].text : "";
        const gold = s.kind === "correct" ? asr : s.kind === "noise" ? "{noise}" : goldOf(s.tokens, s.roman) || "{noise}";
        return {
          type: "transcription",
          timestamp: fmt(g.start),
          segment_start_sec: Number(g.start.toFixed(1)),
          segment_end_sec: Number(g.end.toFixed(1)),
          turn_number: g.turnIndex !== null ? String(g.turnIndex + 1) : `spike ${i + 1} (no transcript)`,
          verdict: s.kind,
          transcripted: asr || "(missing from transcript)",
          audio_said: gold,
          raw_roman: s.roman,
          transcription_error_type:
            s.kind === "correct" ? "Correct" :
            s.kind === "noise" ? "Noise" :
            s.kind === "missing" ? "Missing" :
            s.wrongLang === "same" ? "Wrong Transcription same language" : "Wrong Transcription different language",
          audio_unclear: s.unclear ? "Yes" : "No",
          lint_warnings: s.kind === "wrong" || s.kind === "missing" ? lint(goldOf(s.tokens, s.roman)) : [],
          approx_timing: approxMode ? "Yes" : "No"
        };
      });
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: call.execution_id, reviewer_name: display, reviewer_email: email, review_mode: MODE,
          vibe_score: "", flow_score: "", llm_rating: "", llm_error_type: "",
          notes: `golden transcription | ${segs.length} spikes | approx=${approxMode}`,
          issues, started_at: new Date().toISOString(), duration_taken_sec: 0
        })
      }).then((r) => r.json());
      if (res.error) { alert(res.error); return; }
      setSubmittedId(call.execution_id); setCall(null);
    } finally { setSubmitting(false); }
  }

  // keyboard: space = replay, arrows = prev/next
  useEffect(() => {
    if (!call) return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); playSeg(cur); }
      if (e.code === "ArrowRight") playSeg(Math.min(cur + 1, segs.length - 1));
      if (e.code === "ArrowLeft") playSeg(Math.max(cur - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [call, cur, segs]);

  if (!email) {
    return <main style={{ maxWidth: 560, margin: "80px auto", fontFamily: "system-ui", textAlign: "center", color: "#5b6b64" }}>
      <h1 style={{ color: "#1f2d28" }}>Transcription</h1>
      <p>Log in on the <a href="/">main review app</a> first, then come back to /transcribe.</p>
    </main>;
  }

  const g = segs[cur];
  const s = g ? st(cur) : null;
  const asrText = g && g.turnIndex !== null && call ? call.turns[g.turnIndex].text : "";
  const editorOpen = s && (s.kind === "wrong" || s.kind === "missing" || (g && g.turnIndex === null && s.kind === null));

  return (
    <main style={{ fontFamily: "system-ui", background: "#f6f8f7", minHeight: "100vh", padding: "12px 16px 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 19, color: "#1f2d28", margin: 0 }}>Transcription — golden dataset</h1>
          <span style={{ fontSize: 12, color: "#8a988f" }}>{display} · {queue.filter((c) => !c.reviewed).length} pending / {queue.length} assigned</span>
          <button onClick={() => setRulesOpen(!rulesOpen)} style={{ fontSize: 12, marginLeft: "auto" }}>{rulesOpen ? "hide rules ▴" : "golden rules ▾"}</button>
          <a href="/" style={{ fontSize: 12 }}>← main app</a>
        </div>
        {rulesOpen && (
          <section style={{ background: "#fffbea", border: "1px solid #f0e2b0", borderRadius: 10, padding: "8px 14px", margin: "10px 0" }}>
            <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 12.5, color: "#5b5330", lineHeight: 1.7 }}>
              {RULES.map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
            </ul>
          </section>
        )}

        {!call ? (
          <section style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 14, color: "#5b6b64" }}>Your transcription queue</h2>
            {queue.length === 0 && <p style={{ color: "#8a988f", fontSize: 13 }}>No calls assigned yet.</p>}
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
              {queue.map((c) => (
                <button key={c.queue_id} onClick={() => !c.reviewed && openCall(c)} disabled={c.reviewed}
                  style={{ textAlign: "left", padding: 12, borderRadius: 10, cursor: c.reviewed ? "default" : "pointer", border: "1px solid #e2e8e5", background: c.reviewed ? "#eef2f0" : "#fff", opacity: c.reviewed ? 0.6 : 1 }}>
                  <code style={{ fontSize: 11, color: "#8a988f" }}>{c.execution_id.slice(0, 8)}</code>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2d28" }}>{c.agent_name || "call"}</div>
                  <div style={{ fontSize: 12, color: "#5b6b64" }}>{fmt(Number(c.duration_sec || 0))} {c.reviewed ? "· ✓ done" : ""}</div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", border: "1px solid #e2e8e5", borderRadius: 10, padding: "8px 12px", margin: "10px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13 }}>{call.agent_name || call.execution_id.slice(0, 8)}</strong>
              <audio ref={audioRef} controls preload="auto" onTimeUpdate={onTime}
                src={`/api/audio?url=${encodeURIComponent(call.recording_url || "")}`} style={{ height: 32, flex: "1 1 260px" }} />
              <span style={{ fontSize: 12, color: allDone ? "#1f7a5c" : "#5b6b64" }}>{doneCount}/{segs.length} spikes resolved</span>
              {approxMode && <span style={{ fontSize: 11, color: "#b7791f" }}>~approx timing</span>}
              <button onClick={() => setCall(null)} style={{ fontSize: 12 }}>close</button>
            </div>

            {analyzing ? (
              <p style={{ color: "#5b6b64", fontSize: 13 }}>Analyzing user-channel waveform…</p>
            ) : (
              <>
                {/* waveform strip */}
                <canvas ref={canvasRef} onClick={(e) => {
                  const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                  const frac = (e.clientX - r.left) / r.width;
                  const dur = userEnv ? userEnv.env.length * userEnv.hop : 0;
                  const t = frac * dur;
                  const hit = segs.findIndex((gg) => t >= gg.start && t <= gg.end);
                  if (hit >= 0) playSeg(hit);
                }} style={{ width: "100%", height: 48, background: "#fff", border: "1px solid #e2e8e5", borderRadius: 8, cursor: "pointer" }} />
                <div style={{ fontSize: 11, color: "#8a988f", margin: "2px 0 10px" }}>
                  user-channel spikes: <span style={{ color: "#c05621" }}>■ pending</span> · <span style={{ color: "#1f7a5c" }}>■ done</span> · <span style={{ color: "#b7791f" }}>■ current</span> — click a block to jump · Space replays · ←/→ navigate
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(360px,1fr) minmax(260px,0.7fr)", gap: 14, alignItems: "start" }}>
                  {/* CURRENT SPIKE CARD */}
                  <section>
                    {g && s && (
                      <div style={{ border: "2px solid #b7791f", background: "#fff", borderRadius: 12, padding: 14 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <button onClick={() => playSeg(cur)} style={{ fontSize: 13 }}>🔁 {fmt(g.start)}–{fmt(g.end)}</button>
                          <strong style={{ fontSize: 13, color: "#5b6b64" }}>spike {cur + 1} of {segs.length}</strong>
                          {s.status === "done" && <span style={{ fontSize: 11, color: "#1f7a5c" }}>✓ {s.kind}</span>}
                          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            <button disabled={cur === 0} onClick={() => playSeg(cur - 1)} style={{ fontSize: 12 }}>← prev</button>
                            <button disabled={cur >= segs.length - 1} onClick={() => playSeg(cur + 1)} style={{ fontSize: 12 }}>next →</button>
                          </span>
                        </div>

                        {g.turnIndex !== null ? (
                          <>
                            <div style={{ fontSize: 11.5, color: "#8a988f", marginTop: 10 }}>ASR heard (turn {g.turnIndex + 1}):</div>
                            <p style={{ fontSize: 16, margin: "4px 0 10px", color: "#1f2d28", lineHeight: 1.6 }}>{asrText}</p>
                          </>
                        ) : (
                          <p style={{ fontSize: 13.5, margin: "10px 0", color: "#9b2c2c" }}>No transcript for this audio — listen and write what was said.</p>
                        )}

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {g.turnIndex !== null && (
                            <>
                              <button onClick={() => resolve(cur, "correct")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid #1f7a5c", background: s.kind === "correct" ? "#1f7a5c" : "#fff", color: s.kind === "correct" ? "#fff" : "#1f7a5c", cursor: "pointer" }}>✓ Correct</button>
                              <button onClick={() => resolve(cur, "wrong")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid #c05621", background: s.kind === "wrong" ? "#c05621" : "#fff", color: s.kind === "wrong" ? "#fff" : "#c05621", cursor: "pointer" }}>✏ Edit — ASR is wrong</button>
                            </>
                          )}
                          {g.turnIndex === null && (
                            <button onClick={() => resolve(cur, "missing")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid #c05621", background: s.kind === "missing" ? "#c05621" : "#fff", color: s.kind === "missing" ? "#fff" : "#c05621", cursor: "pointer" }}>✏ Write it</button>
                          )}
                          <button onClick={() => resolve(cur, "noise")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid #4a5568", background: s.kind === "noise" ? "#4a5568" : "#fff", color: s.kind === "noise" ? "#fff" : "#4a5568", cursor: "pointer" }}>{"{noise}"}</button>
                          <label style={{ fontSize: 12, color: "#5b6b64", display: "flex", gap: 4, alignItems: "center", marginLeft: "auto" }}>
                            <input type="checkbox" checked={s.unclear} onChange={(e) => patch(cur, { unclear: e.target.checked })} /> audio unclear
                          </label>
                        </div>

                        {editorOpen && (
                          <div style={{ marginTop: 10 }}>
                            {g.turnIndex !== null && (
                              <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#5b6b64", marginBottom: 6 }}>
                                wrong in:
                                <label><input type="radio" checked={s.wrongLang === "same"} onChange={() => patch(cur, { wrongLang: "same" })} /> same language</label>
                                <label><input type="radio" checked={s.wrongLang === "different"} onChange={() => patch(cur, { wrongLang: "different" })} /> different language</label>
                              </div>
                            )}
                            <textarea value={s.roman} rows={2} autoFocus style={{ width: "100%", fontSize: 14.5 }}
                              placeholder="Type in Roman — hindi words convert automatically (e.g. haan didi main kaam kar rahi hoon)"
                              onChange={(e) => onRoman(cur, e.target.value)} />
                            {s.tokens.length > 0 && (
                              <div style={{ background: "#f2faf7", border: "1px solid #cfe3da", borderRadius: 8, padding: "8px 10px", marginTop: 6, fontSize: 15.5, lineHeight: 1.9 }}>
                                {s.tokens.map((t, ti) => (
                                  <span key={ti} onClick={() => {
                                    const tk = [...s.tokens]; tk[ti] = { ...tk[ti], converted: !tk[ti].converted };
                                    patch(cur, { tokens: tk });
                                  }} title={t.converted ? `click to keep Roman: ${t.src}` : "click to convert to Devanagari"}
                                    style={{ cursor: "pointer", padding: "1px 3px", borderRadius: 4, marginRight: 3, background: t.converted ? "#fdecc8" : "transparent" }}>
                                    {t.converted ? t.out : t.src}
                                  </span>
                                ))}
                                <div style={{ fontSize: 11, color: "#8a988f", marginTop: 2 }}>highlighted = converted to Devanagari — click any word to flip it</div>
                              </div>
                            )}
                            {lint(goldOf(s.tokens, s.roman)).map((w) => <div key={w} style={{ fontSize: 11.5, color: "#b7791f", marginTop: 3 }}>⚠ {w}</div>)}
                            <button onClick={() => saveEdit(cur)} disabled={!goldOf(s.tokens, s.roman) && !s.unclear}
                              style={{ marginTop: 8, fontSize: 13, padding: "7px 16px", borderRadius: 7, border: "none", background: "#1f7a5c", color: "#fff", cursor: "pointer" }}>
                              Save & next
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ position: "sticky", bottom: 10, marginTop: 14 }}>
                      <button onClick={submit} disabled={!allDone || submitting}
                        style={{ width: "100%", padding: "12px 0", fontSize: 15, borderRadius: 10, border: "none", cursor: allDone ? "pointer" : "not-allowed", background: allDone ? "#1f7a5c" : "#c8d6d0", color: "#fff" }}>
                        {submitting ? "Submitting…" : allDone ? "Submit golden transcription" : `Resolve all spikes to submit (${doneCount}/${segs.length})`}
                      </button>
                    </div>
                  </section>

                  {/* FULL TRANSCRIPT */}
                  <section style={{ background: "#fff", border: "1px solid #e2e8e5", borderRadius: 10, padding: 12, maxHeight: "70vh", overflow: "auto", position: "sticky", top: 62 }}>
                    <div style={{ fontSize: 12, color: "#8a988f", marginBottom: 8 }}>Full transcript (read-only)</div>
                    {call.turns.map((t, i) => (
                      <p key={i} style={{ fontSize: 12.5, lineHeight: 1.6, margin: "6px 0", color: t.role === "assistant" ? "#9aa8a1" : "#1f2d28", background: g && g.turnIndex === i ? "#fdf3e3" : "transparent", borderRadius: 4, padding: "2px 4px" }}>
                        <strong>{i + 1}. {t.role === "assistant" ? "agent" : "user"}:</strong> {t.text}
                      </p>
                    ))}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
