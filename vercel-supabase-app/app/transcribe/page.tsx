"use client";

import React, { useEffect, useRef, useState } from "react";
import { readRole } from "../../lib/role";
import { isDemo, demoHref } from "../../lib/demo";
import DemoReady from "../../lib/DemoReady";
import ThemeToggle, { currentTheme } from "../../lib/ThemeToggle";

// Sandbox reviewer for the YC partner demo · a real row in `reviewers` so the
// queue API answers normally, but nothing it submits is ever written.
const DEMO_REVIEWER = "ycdemo@realloop.in";

// Transcription workbench · golden dataset, audio-first.
// Same shell as the main app (sidebar call list + workspace). The waveform is
// the classic dual-channel view (agent up/green, user down/blue) with USER
// speech segments highlighted and clickable; each segment is the unit of work.

type Turn = { role: string; text: string };
type Anchor = { text: string; startSec: number; endSec: number };
type Call = { execution_id: string; agent_name?: string; duration_sec?: number; recording_url?: string; turns: Turn[]; turn_anchors?: Anchor[] };
type QueueItem = { queue_id: string; execution_id: string; agent_name?: string; duration_sec?: number; reviewed: boolean };

// A segment is either an OFFICIAL Bolna turn (asr text + exact timing) or an
// extra user-channel spike with no official transcript (asr = null → "write it").
// `manual` marks a segment the reviewer added by clicking the waveform · the
// detector never found it, so it carries no ASR and is theirs to remove.
type Seg = { start: number; end: number; asr: string | null; official: boolean; manual?: boolean };
type Tok = { src: string; out: string; converted: boolean };
type SegState = {
  status: "pending" | "done";
  kind: "correct" | "wrong" | "missing" | "noise" | "deleted" | null;
  wrongLang: "same" | "different";
  roman: string;
  tokens: Tok[];
  unclear: boolean;
};
type Wave = { agent: number[]; user: number[]; duration: number };

const MODE = "timing_transcription";

const RULES: Array<[string, string]> = [
  ["Script", "Hindi in Devanagari, English in Roman · never translate. Type Roman; the tool converts."],
  ["Numbers", "As spoken words, not digits · पांच / five, not 5"],
  ["Decimals", "No \".\" · \"two point two five\", written out"],
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
  if (/\d+\.\d+/.test(text)) w.push("Decimal digits · write as spoken: \"two point two five\"");
  else if (/\d/.test(text)) w.push("Digits · write numbers as words (पांच / five)");
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
function segmentsFromEnv(env: Float32Array, hop: number) {
  const sorted = [...env].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const median = sorted[Math.floor(sorted.length * 0.5)] || 0;
  // Noise-aware threshold: quiet far-end channels (phone users) sit well below
  // a fixed 0.015 floor and lost most speech (seen on a7d51f2b, p95=0.024).
  // The median tracks the channel's noise floor and protects noisy lines.
  const thr = Math.max(0.006, p95 * 0.15, median * 4);
  const raw: Array<{ start: number; end: number }> = [];
  let s = -1;
  for (let i = 0; i <= env.length; i++) {
    const on = i < env.length && env[i] > thr;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { raw.push({ start: s * hop, end: i * hop }); s = -1; }
  }
  const merged: typeof raw = [];
  for (const g of raw) {
    const last = merged[merged.length - 1];
    if (last && g.start - last.end < 0.55) last.end = g.end;
    else merged.push({ ...g });
  }
  // 0.25s floor: short "हां"/"जी" backchannels are real user speech and must
  // become spikes · a 0.35s floor silently dropped them (seen on e8addc83).
  return merged.filter((g) => g.end - g.start >= 0.25);
}
// Agent-window alignment: agent turns are long, distinctive TTS · align THEM
// to the agent channel first (merging sub-1.2s pauses: TTS turns are
// continuous), then each user turn must sit in the silence window between its
// surrounding agent turns. Duration-only matching on user spikes ties/flips;
// this anchors every user turn temporally (fixes hello@0:05 on e81b7796).
function alignByAgentWindows(
  userSegs: Array<{ start: number; end: number }>,
  agentSegs: Array<{ start: number; end: number }>,
  turns: Turn[]
) {
  // merge agent fragments across short pauses
  const merged: Array<{ start: number; end: number }> = [];
  for (const g of agentSegs) {
    const last = merged[merged.length - 1];
    if (last && g.start - last.end < 1.2) last.end = g.end;
    else merged.push({ ...g });
  }
  const agentWords = turns.filter((t) => t.role === "assistant").map((t) => words(t.text).length);
  const aMap = alignSegs(merged, agentWords); // merged seg -> agent-turn ordinal
  const aRange = new Map<number, { start: number; end: number }>();
  aMap.forEach((t, si) => {
    if (t === null) return;
    const r = aRange.get(t as number);
    const g = merged[si];
    if (r) { r.start = Math.min(r.start, g.start); r.end = Math.max(r.end, g.end); }
    else aRange.set(t as number, { ...g });
  });
  // walk transcript: each user turn takes the earliest free spike between the
  // previous agent turn's audio end and the next agent turn's audio start
  const map = new Array(userSegs.length).fill(null) as Array<number | null>;
  const used = new Set<number>();
  let aOrd = -1, uOrd = 0;
  for (const t of turns) {
    if (t.role === "assistant") { aOrd += 1; continue; }
    const lo = aOrd >= 0 && aRange.has(aOrd) ? (aRange.get(aOrd) as { end: number }).end : 0;
    let hi = Infinity;
    for (let a2 = aOrd + 1; a2 < agentWords.length; a2++) {
      if (aRange.has(a2)) { hi = (aRange.get(a2) as { start: number }).start; break; }
    }
    for (let si = 0; si < userSegs.length; si++) {
      if (used.has(si)) continue;
      const mid = (userSegs[si].start + userSegs[si].end) / 2;
      if (mid >= lo - 0.4 && mid <= hi + 0.4) { used.add(si); map[si] = uOrd; break; }
    }
    uOrd += 1;
  }
  return map;
}

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
    if (i < m) {
      const c = dp[i][k] + (segs[i].end - segs[i].start) * 0.9;
      if (c < dp[i + 1][k]) { dp[i + 1][k] = c; bk[i + 1][k] = 2; }
    }
    if (k < n) {
      const c = dp[i][k] + turnWords[k] * spw * 1.1;
      if (c < dp[i][k + 1]) { dp[i][k + 1] = c; bk[i][k + 1] = 3; }
    }
  }
  const map = new Array(m).fill(null) as Array<number | null>;
  let i = m, k = n;
  while (i > 0 || k > 0) {
    const b = bk[i][k];
    if (b === 1) { map[i - 1] = k - 1; i--; k--; }
    else if (b === 2) i--;
    else k--;
  }
  return map;
}

export default function Transcribe() {
  const [email, setEmail] = useState("");
  const [display, setDisplay] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [call, setCall] = useState<Call | null>(null);
  const [currentQueueId, setCurrentQueueId] = useState("");
  const [segs, setSegs] = useState<Seg[]>([]);
  const [wave, setWave] = useState<Wave | null>(null);
  const [approxMode, setApproxMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [cur, setCur] = useState(0);
  const [states, setStates] = useState<Record<number, SegState>>({});
  const [rulesOpen, setRulesOpen] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [rate, setRate] = useState(1); // playback speed · 0.5x/0.75x help catch fast/slurred speech
  const rateRef = useRef(1);
  // Channel isolation · these recordings are true two-channel telephony (agent
  // on one leg, user on the other), so "user only" is a hard mute of the agent
  // channel, not diarization. Mono calls can't be split · the toggle disables.
  const [hear, setHear] = useState<"both" | "user" | "agent">("both");
  const hearRef = useRef<"both" | "user" | "agent">("both");
  const [stereoOk, setStereoOk] = useState(false);
  const chanRef = useRef<{ user: AudioBuffer | null; agent: AudioBuffer | null }>({ user: null, agent: null });
  function pickHear(h: "both" | "user" | "agent") { hearRef.current = h; setHear(h); }
  // click-a-word chooser: 3 Devanagari options + keep Roman
  const [altPick, setAltPick] = useState<{ ti: number; alts: string[]; loading: boolean } | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagNote, setFlagNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [queueView, setQueueView] = useState<"pending" | "submitted">("pending");
  const [clientView, setClientView] = useState<"all" | "oolka" | "bolna">("all");
  // The canvas cannot resolve var() · it needs real values, so the waveform
  // redraw must know when the theme flips. Everything else follows CSS alone.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<any>(null);
  // Spike playback goes through Web Audio from the decoded buffer · the
  // <audio> element can't reliably seek into unbuffered ranges through the
  // proxy, which made spike clicks restart from 0:00 in production.
  const ctxRef = useRef<AudioContext | null>(null);
  const bufRef = useRef<AudioBuffer | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const playInfoRef = useRef<{ startedAt: number; offset: number; until: number; rate: number } | null>(null);
  const rafRef = useRef<number>(0);

  function stopSpikeAudio() {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
    playInfoRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }
  function playBuffer(from: number, until: number) {
    const ctx = ctxRef.current;
    // isolation picks the source buffer · same timeline, one leg muted
    const mode = hearRef.current;
    const buf =
      mode === "user" && chanRef.current.user ? chanRef.current.user :
      mode === "agent" && chanRef.current.agent ? chanRef.current.agent :
      bufRef.current;
    if (!ctx || !buf) return false;
    stopSpikeAudio();
    audioRef.current?.pause();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rateRef.current;
    src.connect(ctx.destination);
    const start = Math.max(0, Math.min(from, buf.duration));
    const stop = Math.max(start, Math.min(until, buf.duration));
    src.start(0, start, stop - start);
    srcRef.current = src;
    playInfoRef.current = { startedAt: ctx.currentTime, offset: start, until: stop, rate: rateRef.current };
    const tick = () => {
      const info = playInfoRef.current;
      if (!info || !ctxRef.current) return;
      // at rate<1 the buffer advances slower than wall-clock, so scale elapsed
      const pos = info.offset + (ctxRef.current.currentTime - info.startedAt) * info.rate;
      setPlayhead(Math.min(pos, info.until));
      // keep the visible <audio> player in step with spike playback (it stays
      // paused · we just move its position so the time display follows)
      const a = audioRef.current;
      if (a && a.paused && Math.abs(a.currentTime - pos) > 0.25) {
        try { a.currentTime = Math.min(pos, info.until); } catch { /* not seekable yet */ }
      }
      if (pos < info.until) rafRef.current = requestAnimationFrame(tick);
      else playInfoRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return true;
  }

  useEffect(() => {
    // YC partner demo · borrow a sandbox reviewer identity so the workbench is
    // genuinely usable without an account. Its queue holds the same handful of
    // calls the public screening assignment already uses, and submit() below
    // never persists, so a partner cannot touch a real reviewer's work.
    if (isDemo()) { setEmail(DEMO_REVIEWER); setDisplay("YC demo"); return; }
    // Clients have a valid session but no business in the workbench · their
    // queue is empty anyway, so all this shows them is our internal tooling.
    if (readRole() === "client") { window.location.replace("/portal/agents"); return; }
    const e = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
    setEmail(e); setDisplay(window.localStorage.getItem("auditReviewerDisplay") || e);
  }, []);
  useEffect(() => {
    if (!email) return;
    let first = !submittedId;
    fetch(demoHref(`/api/calls?reviewer=${encodeURIComponent(email)}&audit_mode=${MODE}`))
      .then((r) => r.json()).then((d) => {
        const rows = (d.calls || []).filter((c: QueueItem) => c.execution_id);
        setQueue(rows);
        // Demo · open the first call straight away. "Select a call to start" is
        // a dead end for someone who has thirty seconds and does not yet know
        // this is a queue, so the workbench should already be showing work.
        if (isDemo() && first && !call) {
          const firstOpen = rows.find((c: QueueItem) => !c.reviewed);
          if (firstOpen) openCall(firstOpen);
        }
        // Mirror of the check on the vibe page (see app/page.tsx): this tool is
        // transcription-only, so a vibe reviewer who lands here would see an
        // empty screen and assume there is no work. Bounce them back only when
        // nothing is pending HERE and something is pending there — the same
        // rule on both sides, so the two pages can never ping-pong a reviewer.
        // Only on first load, never straight after a submit.
        if (!first || rows.some((c: QueueItem) => !c.reviewed)) return;
        fetch(`/api/calls?reviewer=${encodeURIComponent(email)}&audit_mode=response_vibe`)
          .then((r) => r.json())
          .then((v) => {
            if ((v.calls || []).some((c: QueueItem) => !c.reviewed)) window.location.replace("/");
          })
          .catch(() => {});
      })
      .catch(() => setQueue([]));
  }, [email, submittedId]);

  const st = (i: number): SegState =>
    states[i] || { status: "pending", kind: null, wrongLang: "same", roman: "", tokens: [], unclear: false };
  const patch = (i: number, p: Partial<SegState>) => setStates((s) => ({ ...s, [i]: { ...st(i), ...p } }));
  const doneCount = segs.filter((_, i) => st(i).status === "done").length;
  const allDone = segs.length > 0 && doneCount === segs.length;

  async function openCall(item: QueueItem) {
    stopSpikeAudio();
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null; bufRef.current = null;
    setCall(null); setSegs([]); setStates({}); setCur(0); setApproxMode(false); setWave(null); setPlayhead(0);
    chanRef.current = { user: null, agent: null }; setStereoOk(false); pickHear("both");
    // queue_id is shared across a person's whole batch (e.g. b4t_nabh) · track
    // the open call by composite key so exactly one card shows active.
    setCurrentQueueId(`${item.queue_id}:${item.execution_id}`);
    const d: Call = await fetch(demoHref(`/api/calls/${item.execution_id}`)).then((r) => r.json());
    setCall(d);
    setAnalyzing(true);
    const anchors = (d.turn_anchors || []).slice().sort((a, b) => a.startSec - b.startSec);
    const hasTel = anchors.length > 0;
    try {
      const buf = await fetch(`/api/audio?url=${encodeURIComponent(d.recording_url || "")}`).then((r) => r.arrayBuffer());
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audio = await ctx.decodeAudioData(buf);
      ctxRef.current = ctx; bufRef.current = audio;
      const userTurnIdx = d.turns.map((t, i) => ({ t, i })).filter((x) => x.t.role !== "assistant");
      const wc = userTurnIdx.map((x) => words(x.t.text).length);

      let envs: Array<{ env: Float32Array; hop: number }> = [];
      let userIdx = 0;
      if (audio.numberOfChannels >= 2) {
        envs = [envelope(audio.getChannelData(0), audio.sampleRate), envelope(audio.getChannelData(1), audio.sampleRate)];
        if (hasTel) {
          // user channel = the one whose spikes best overlap the official anchor times
          let best = -1;
          for (let ch = 0; ch < 2; ch++) {
            const gs = segmentsFromEnv(envs[ch].env, envs[ch].hop);
            let overlap = 0;
            for (const a of anchors) for (const g of gs) overlap += Math.max(0, Math.min(a.endSec, g.end) - Math.max(a.startSec, g.start));
            if (overlap > best) { best = overlap; userIdx = ch; }
          }
        } else {
          // These calls open with the agent greeting (first transcript turn is
          // assistant), so the channel that speaks first is the AGENT · much
          // sturdier than count-matching, which flips on backchannel-heavy calls.
          const gs0 = segmentsFromEnv(envs[0].env, envs[0].hop);
          const gs1 = segmentsFromEnv(envs[1].env, envs[1].hop);
          const first0 = gs0[0]?.start ?? 1e9;
          const first1 = gs1[0]?.start ?? 1e9;
          if (d.turns[0]?.role === "assistant" && Math.abs(first0 - first1) > 0.7) {
            userIdx = first0 < first1 ? 1 : 0;
          } else {
            let best = Infinity;
            for (let ch = 0; ch < 2; ch++) {
              const gs = ch === 0 ? gs0 : gs1;
              const matched = alignSegs(gs, wc).filter((x) => x !== null).length;
              const score = Math.abs(gs.length - wc.length) * 2 - matched * 1.5;
              if (score < best) { best = score; userIdx = ch; }
            }
          }
        }
      } else {
        setApproxMode(true);
        envs = [envelope(audio.getChannelData(0), audio.sampleRate)];
      }
      // Mono buffers per leg, for isolated playback · built once at decode so
      // the toggle costs nothing at play time.
      if (audio.numberOfChannels >= 2) {
        const mono = (data: Float32Array) => {
          const b = ctx.createBuffer(1, data.length, audio.sampleRate);
          // set() instead of copyToChannel · TS 5.7 types the latter's param as
          // Float32Array<ArrayBuffer>, which getChannelData doesn't guarantee
          b.getChannelData(0).set(data);
          return b;
        };
        chanRef.current = { user: mono(audio.getChannelData(userIdx)), agent: mono(audio.getChannelData(1 - userIdx)) };
        setStereoOk(true);
      }
      const userEnv = envs[userIdx];
      const agentEnv = envs.length > 1 ? envs[1 - userIdx] : null;
      const spikes = segmentsFromEnv(userEnv.env, userEnv.hop);

      let built: Seg[];
      if (hasTel) {
        // Official Bolna turns are authoritative. Any user spike not overlapping
        // an official turn becomes an empty "write it" segment.
        const official: Seg[] = anchors.map((a) => ({ start: a.startSec, end: a.endSec, asr: a.text, official: true }));
        const extra: Seg[] = spikes
          .filter((g) => !anchors.some((a) => Math.min(a.endSec, g.end) - Math.max(a.startSec, g.start) > 0.25))
          .filter((g) => g.end - g.start >= 0.35)
          .map((g) => ({ start: Math.max(0, g.start - 0.15), end: g.end + 0.15, asr: null, official: false }));
        built = [...official, ...extra].sort((x, y) => x.start - y.start);
      } else {
        // No telemetry: prefer role-sequence alignment (agent turns anchor the
        // order); fall back to duration matching when we lack an agent channel.
        const map = envs.length > 1
          ? alignByAgentWindows(spikes, segmentsFromEnv(envs[1 - userIdx].env, envs[1 - userIdx].hop), d.turns)
          : alignSegs(spikes, wc);
        built = spikes.map((g, gi) => ({
          start: Math.max(0, g.start - 0.2), end: g.end + 0.2, official: map[gi] !== null,
          asr: map[gi] === null ? null : d.turns[userTurnIdx[map[gi] as number].i].text
        }));
      }
      setSegs(built);
      setWave({ agent: agentEnv ? buckets(agentEnv.env) : new Array(700).fill(0), user: buckets(userEnv.env), duration: audio.duration });
      setTimeout(() => playSeg(0, built), 350);
    } catch {
      // decode failed · use official telemetry timing if we have it, else estimate
      if (hasTel) {
        setSegs(anchors.map((a) => ({ start: a.startSec, end: a.endSec, asr: a.text, official: true })));
      } else {
        setApproxMode(true);
        const dur = Number(d.duration_sec || 0);
        const uidx = d.turns.map((t, i) => ({ t, i })).filter((x) => x.t.role !== "assistant");
        const counts = d.turns.map((t) => words(t.text).length);
        const total = counts.reduce((a, b) => a + b, 0) || 1;
        let before = 0; const est: Record<number, { s: number; e: number }> = {};
        d.turns.forEach((t, i) => { est[i] = { s: (before / total) * dur, e: ((before + counts[i]) / total) * dur }; before += counts[i]; });
        setSegs(uidx.map((x) => ({ start: est[x.i].s, end: est[x.i].e, asr: x.t.text, official: false })));
      }
    } finally {
      setAnalyzing(false);
    }
  }

  function seekPlay(target: number, stopAt: number | null) {
    // Prefer sample-accurate playback from the decoded buffer.
    if (playBuffer(target, stopAt !== null ? stopAt : (bufRef.current?.duration || target + 600))) return;
    // Fallback (approx mode / decode failed): seek the element once metadata is up.
    const a = audioRef.current;
    if (!a) return;
    const go = () => {
      try { a.currentTime = target; } catch { /* not seekable yet */ }
      a.playbackRate = rateRef.current;
      stopAtRef.current = stopAt;
      a.play().catch(() => {});
    };
    if (a.readyState >= 1 && !Number.isNaN(a.duration)) go();
    else a.addEventListener("loadedmetadata", go, { once: true });
  }
  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    // apply live: to the buffer source (rescale playhead math) and native player
    if (srcRef.current && playInfoRef.current) {
      const info = playInfoRef.current;
      const nowPos = info.offset + (ctxRef.current!.currentTime - info.startedAt) * info.rate;
      try { srcRef.current.playbackRate.value = r; } catch {}
      playInfoRef.current = { ...info, startedAt: ctxRef.current!.currentTime, offset: nowPos, rate: r };
    }
    if (audioRef.current) audioRef.current.playbackRate = r;
  }
  function playSeg(i: number, list: Seg[] = segs) {
    const g = list[i];
    if (!g) return;
    setCur(i);
    setAltPick(null);
    seekPlay(Math.max(0, g.start - 0.15), g.end + 0.15);
  }
  function onTime() {
    const a = audioRef.current;
    if (!a) return;
    setPlayhead(a.currentTime);
    if (stopAtRef.current !== null && a.currentTime >= stopAtRef.current) { a.pause(); stopAtRef.current = null; }
  }
  function next(i = cur) {
    const nxt = segs.findIndex((_, k) => k > i && st(k).status === "pending");
    const target = nxt >= 0 ? nxt : Math.min(i + 1, segs.length - 1);
    playSeg(target);
  }

  /** Add a segment the detector missed, at a point the reviewer clicked.
   *
   *  Spikes are untouched · this only ever fires on a click that hit no
   *  existing segment. The window snaps to surrounding user-channel activity
   *  where there is any, so a click near real speech captures the whole
   *  utterance rather than a fixed box around the cursor. */
  function addSegAt(t: number) {
    if (!wave || wave.duration <= 0) return;
    const dur = wave.duration;
    const bars = wave.user.length;
    const per = dur / bars;                     // seconds per envelope bucket
    const loud = wave.user.reduce((m, v) => Math.max(m, v), 0);
    const floor = Math.max(0.06, loud * 0.14);  // same spirit as segmentsFromEnv
    let bi = Math.round(t / per);
    let s0 = t - 0.5, e0 = t + 1.2;
    if (bi >= 0 && bi < bars && (wave.user[bi] || 0) >= floor) {
      let a = bi, b = bi;
      while (a > 0 && (wave.user[a - 1] || 0) >= floor) a--;
      while (b < bars - 1 && (wave.user[b + 1] || 0) >= floor) b++;
      s0 = a * per - 0.15;
      e0 = (b + 1) * per + 0.15;
    }
    const start = Math.max(0, Math.min(s0, dur - 0.3));
    const end = Math.min(dur, Math.max(start + 0.3, e0));
    const seg: Seg = { start, end, asr: null, official: false, manual: true };
    const at = segs.filter((g) => g.start <= start).length;   // keep time order
    const list = [...segs.slice(0, at), seg, ...segs.slice(at)];
    // states are keyed by index · shift everything at/after the insert point
    setStates((prev) => {
      const out: Record<number, SegState> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        out[i >= at ? i + 1 : i] = v;
      });
      return out;
    });
    setSegs(list);
    setCur(at);
    setTimeout(() => playSeg(at, list), 0);
  }

  /** Remove a reviewer-added segment. Detector spikes are never removable ·
   *  "not a user turn" is the verdict for those, and it stays in the record. */
  function removeSeg(i: number) {
    if (!segs[i]?.manual) return;
    const list = segs.filter((_, k) => k !== i);
    setStates((prev) => {
      const out: Record<number, SegState> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n === i) return;
        out[n > i ? n - 1 : n] = v;
      });
      return out;
    });
    setSegs(list);
    setCur((c) => Math.max(0, Math.min(c > i ? c - 1 : c, list.length - 1)));
  }

  // Two stacked lanes · agent above, user below, each waveform mirrored around
  // its own centreline (the Label-Studio look), user-segment highlights on the
  // user lane, current segment outlined across both, playhead full height.
  // The lane that isolation has muted draws dimmed, so what you see is what
  // you hear.
  useEffect(() => {
    setTheme(currentTheme());
    const h = (e: Event) => setTheme((e as CustomEvent).detail === "dark" ? "dark" : "light");
    window.addEventListener("rl-theme", h);
    return () => window.removeEventListener("rl-theme", h);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wave) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // var() does not resolve inside canvas fillStyle · read the computed
    // token values once per draw, and redraw when the theme flips (the theme
    // dep below) or the waveform keeps the old palette until the next call.
    const css = getComputedStyle(canvas);
    const tok = (name: string) => css.getPropertyValue(name).trim();
    const W = canvas.width = canvas.offsetWidth * 2, H = canvas.height = 200;
    const laneH = 88, gap = H - laneH * 2;             // 24px between lanes
    const aMid = laneH / 2, uTop = laneH + gap, uMid = uTop + laneH / 2;
    const amp = laneH / 2 - 4;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = tok("--tx-centerline");
    ctx.fillRect(0, aMid - 0.5, W, 1);
    ctx.fillRect(0, uMid - 0.5, W, 1);
    const bars = wave.agent.length;
    const bw = W / bars;
    const aDim = hear === "user", uDim = hear === "agent";
    for (let i = 0; i < bars; i++) {
      const a = (wave.agent[i] || 0) * amp;
      const u = (wave.user[i] || 0) * amp;
      ctx.fillStyle = aDim ? tok("--tx-agent-dim") : tok("--tx-green");
      ctx.fillRect(i * bw, aMid - a, Math.max(bw - 0.5, 0.5), Math.max(a * 2, 1));
      ctx.fillStyle = uDim ? tok("--tx-user-dim") : tok("--tx-blue");
      ctx.fillRect(i * bw, uMid - u, Math.max(bw - 0.5, 0.5), Math.max(u * 2, 1));
    }
    // lane labels · drawn at 2x canvas scale
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillStyle = aDim ? tok("--tx-agent-mutlab") : tok("--tx-green");
    ctx.fillText(`AGENT${aDim ? " · muted" : ""}`, 8, 22);
    ctx.fillStyle = uDim ? tok("--tx-user-mutlab") : tok("--tx-blue");
    ctx.fillText(`USER${uDim ? " · muted" : ""}`, 8, uTop + 22);
    // user segments: highlight the user lane only (agent lane untouched)
    segs.forEach((g, i) => {
      const x1 = (g.start / wave.duration) * W, x2 = (g.end / wave.duration) * W;
      ctx.fillStyle = i === cur ? tok("--tx-spike-cur") : st(i).status === "done" ? tok("--tx-spike-done") : tok("--tx-spike-pend");
      ctx.fillRect(x1, uTop, Math.max(2, x2 - x1), laneH);
      if (i === cur) { ctx.strokeStyle = tok("--tx-amber"); ctx.lineWidth = 2; ctx.strokeRect(x1, 1, Math.max(2, x2 - x1), H - 2); }
    });
    if (wave.duration > 0) {
      const x = (playhead / wave.duration) * W;
      ctx.fillStyle = tok("--tx-playhead");
      ctx.fillRect(x - 1, 0, 2, H);
    }
  }, [wave, segs, states, cur, playhead, hear, theme]);

  function onRoman(i: number, value: string) {
    patch(i, { roman: value });
    setAltPick(null); // tokens are about to refresh · stale chooser index
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const d = await fetch("/api/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }) }).then((r) => r.json());
        setStates((s) => {
          const now = s[i]; if (!now || now.roman !== value) return s;
          return { ...s, [i]: { ...now, tokens: d.tokens || [] } };
        });
      } catch { /* keep roman */ }
    }, 450);
  }

  function resolve(i: number, kind: SegState["kind"]) {
    const s = st(i);
    if (kind === "correct" || kind === "noise" || kind === "deleted") {
      // "deleted" = the detector was wrong, this spike is not a user turn at all
      // (agent bleed / line click) · resolve it and drop it from the transcript.
      patch(i, { kind, status: "done", tokens: kind === "correct" ? s.tokens : [], roman: kind === "noise" ? "{noise}" : kind === "deleted" ? "" : s.roman });
      next(i);
    } else if (kind === "wrong") {
      // Prefill with the ASR so the reviewer edits the wrong words instead of
      // retyping the whole segment. Run conversion so the preview shows at once.
      const asr = segs[i]?.asr || "";
      patch(i, { kind });
      const isBlind = currentQueueId.startsWith("txb_");
      if (!isBlind && !s.roman.trim() && asr) onRoman(i, asr);
    } else patch(i, { kind });
  }
  function saveEdit(i: number) {
    const s = st(i);
    if (!goldOf(s.tokens, s.roman) && !s.unclear) return;
    patch(i, { status: "done" });
    next(i);
  }

  async function submit() {
    if (!call || submitting) return;
    if (!allDone && !flagReason && !flagNote.trim()) return;
    setSubmitting(true);
    try {
      const issues = segs.map((g, i) => {
        const s = st(i);
        const asr = g.asr || "";
        const gold = s.kind === "correct" ? asr : s.kind === "noise" ? "{noise}" : s.kind === "deleted" ? "(not a user turn · wrongly detected)" : goldOf(s.tokens, s.roman) || "{noise}";
        return {
          type: "transcription",
          timestamp: fmt(g.start),
          segment_start_sec: Number(g.start.toFixed(1)),
          segment_end_sec: Number(g.end.toFixed(1)),
          turn_number: g.official ? `turn ${i + 1}` : g.manual ? `added ${i + 1} (reviewer-found)` : `spike ${i + 1} (no transcript)`,
          official_bolna_turn: g.official ? "Yes" : "No",
          // Speech the detector never surfaced · this is the strongest evidence
          // of dropped user turns, so it must stay separable in the dataset.
          reviewer_added: g.manual ? "Yes" : "No",
          verdict: s.kind,
          transcripted: asr || "(missing from transcript)",
          audio_said: gold,
          raw_roman: s.roman,
          transcription_error_type:
            s.kind === "correct" ? "Correct" :
            s.kind === "noise" ? "Noise" :
            s.kind === "deleted" ? "Wrongly detected (delete turn)" :
            s.kind === "missing" ? "Missing" :
            s.wrongLang === "same" ? "Wrong Transcription same language" : "Wrong Transcription different language",
          audio_unclear: s.unclear ? "Yes" : "No",
          lint_warnings: s.kind === "wrong" || s.kind === "missing" ? lint(goldOf(s.tokens, s.roman)) : [],
          approx_timing: approxMode ? "Yes" : "No"
        };
      });
      const flagged = Boolean(flagReason || flagNote.trim());
      const flagIssues = flagged
        ? [{ type: "call_flag", timestamp: "", flag_reason: flagReason || "Unspecified", notes: flagNote.trim(), resolved_spikes: `${doneCount}/${segs.length}` }]
        : [];
      const res = await fetch(demoHref("/api/reviews"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: call.execution_id, reviewer_name: display, reviewer_email: email, review_mode: MODE,
          vibe_score: "", flow_score: "", llm_rating: "", llm_error_type: "",
          notes: `golden transcription | ${segs.length} spikes | approx=${approxMode} | blind=${blind}${flagged ? ` | FLAGGED: ${flagReason || "Unspecified"}${flagNote.trim() ? ` — ${flagNote.trim()}` : ""}` : ""}`,
          issues: [...issues, ...flagIssues], started_at: new Date().toISOString(), duration_taken_sec: 0
        })
      }).then((r) => r.json());
      if (res.error) { alert(res.error); return; }
      setSubmittedId(call.execution_id); setCall(null); setCurrentQueueId(""); setFlagOpen(false); setFlagReason(""); setFlagNote("");
      setQueueView("pending");
    } finally { setSubmitting(false); }
  }

  useEffect(() => {
    if (!call) return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); playSeg(cur); }
      if (e.code === "ArrowRight") playSeg(Math.min(cur + 1, segs.length - 1));
      if (e.code === "ArrowLeft") playSeg(Math.max(cur - 1, 0));
      // U toggles user-only isolation and replays the segment, so the effect
      // of the mute is heard immediately on the same words
      if (e.code === "KeyU" && chanRef.current.user) {
        pickHear(hearRef.current === "user" ? "both" : "user");
        playSeg(cur);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [call, cur, segs]);

  if (!email) {
    return <main style={{ maxWidth: 560, margin: "80px auto", fontFamily: "system-ui", textAlign: "center", color: "var(--tx-sec)" }}>
      <h1 style={{ color: "var(--tx-ink)" }}>Transcription</h1>
      <p>Log in on the <a href="/">main review app</a> first, then come back to /transcribe.</p>
    </main>;
  }

  // Client filter · same rule as the vibe tool: oolka work is tagged in the
  // queue id, everything else is Bolna. Hidden unless the queue mixes both.
  const clientOf = (c: QueueItem) => (String(c.queue_id || "").toLowerCase().includes("oolka") ? "oolka" : "bolna");
  const oolkaCount = queue.filter((c) => clientOf(c) === "oolka").length;
  const bolnaCount = queue.length - oolkaCount;
  const showClientFilter = oolkaCount > 0 && bolnaCount > 0;
  const scopedQueue = showClientFilter && clientView !== "all" ? queue.filter((c) => clientOf(c) === clientView) : queue;
  const pendingCount = scopedQueue.filter((c) => !c.reviewed).length;
  // Blind arm of the transcript-visibility experiment: txb_* queue rows hide
  // the ASR everywhere · the reviewer transcribes from audio alone.
  const blind = currentQueueId.startsWith("txb_");
  const g = segs[cur];
  const s = g ? st(cur) : null;
  const asrText = g?.asr || "";
  const editorOpen = s && (s.kind === "wrong" || s.kind === "missing" || (g && g.asr === null && s.kind === null));

  return (
    <div className="app-shell">
      {/* the queue is this screen's proof of life · an empty sidebar means the
          demo reviewer lost its assignment, which the shell should surface */}
      <DemoReady ready={queue.length > 0} />
      <aside className="sidebar">
        <div className="brand">
          <h1 style={{ fontSize: 18 }}>Transcription</h1>
          <p>golden dataset · {display} · <a href="/">main app</a></p>
        </div>
        <div className="queue-stats">{pendingCount} pending · {scopedQueue.length - pendingCount} submitted · {scopedQueue.length} assigned</div>
        {/* Pending / Submitted tabs · same pattern and classes as the vibe
            app. A submitted call leaves the pending list instead of sitting
            in it greyed out; counts come from the SAME rows as the list so
            the rail never shows two different pending numbers 50px apart. */}
        {showClientFilter && (
          <div className="queue-tabs" role="tablist" aria-label="Client">
            {([["all", "All", queue.length], ["oolka", "Oolka", oolkaCount], ["bolna", "Bolna", bolnaCount]] as const).map(([key, label, count]) => (
              <button key={key} role="tab" aria-selected={clientView === key} className={clientView === key ? "active" : ""}
                onClick={() => { setClientView(key); setQueueView("pending"); }}>
                {label} <span>{count}</span>
              </button>
            ))}
          </div>
        )}
        <div className="queue-tabs" role="tablist" aria-label="Transcription queue status">
          <button role="tab" aria-selected={queueView === "pending"} className={queueView === "pending" ? "active" : ""}
            onClick={() => setQueueView("pending")}>
            Pending <span>{pendingCount}</span>
          </button>
          <button role="tab" aria-selected={queueView === "submitted"} className={queueView === "submitted" ? "active" : ""}
            onClick={() => setQueueView("submitted")}>
            Submitted <span>{scopedQueue.length - pendingCount}</span>
          </button>
        </div>
        <nav className="call-list">
          {/* Experiment queues render as two labeled sections: with transcript
              (txv) first, then blind (txb). Everything else renders flat. */}
          {(() => {
            const shown = scopedQueue.filter((c) => (queueView === "pending" ? !c.reviewed : c.reviewed));
            const vis = shown.filter((c) => String(c.queue_id || "").startsWith("txv_"));
            const bl = shown.filter((c) => String(c.queue_id || "").startsWith("txb_"));
            const rest = shown.filter((c) => !String(c.queue_id || "").startsWith("txv_") && !String(c.queue_id || "").startsWith("txb_"));
            const card = (c: QueueItem) => (
              <button key={`${c.queue_id}:${c.execution_id}`}
                className={`call-card ${c.reviewed ? "reviewed submitted" : ""} ${currentQueueId === `${c.queue_id}:${c.execution_id}` ? "active" : ""}`}
                onClick={() => !c.reviewed && openCall(c)}>
                <span className="call-id">ID {c.execution_id.slice(0, 8)}</span>
                <strong>{c.agent_name || "call"}</strong>
                <span>· {fmt(Number(c.duration_sec || 0))} · {c.reviewed ? "Done ✓" : "Open"}</span>
              </button>
            );
            const header = (label: string, done: number, total: number, color: string) => (
              <div style={{ padding: "10px 6px 4px", fontSize: 12, fontWeight: 600, color, borderBottom: "1px solid var(--tx-border)", marginBottom: 6 }}>
                {label} · {done}/{total} done
              </div>
            );
            return (
              <>
                {queueView === "pending" && vis.length > 0 && header("PART 1 · transcript shown", vis.filter((c) => c.reviewed).length, vis.length, "var(--tx-green)")}
                {vis.map(card)}
                {queueView === "pending" && bl.length > 0 && header("PART 2 · no transcript (listen & write)", bl.filter((c) => c.reviewed).length, bl.length, "var(--tx-red-deep)")}
                {bl.map(card)}
                {rest.map(card)}
                {shown.length === 0 && queue.length > 0 && (
                  <div className="queue-empty"><p>{queueView === "pending" ? "All submitted · nothing pending." : "Nothing submitted yet."}</p></div>
                )}
              </>
            );
          })()}
          {queue.length === 0 && <div className="queue-empty"><p>No calls assigned yet.</p></div>}
        </nav>
      </aside>

      <main className="workspace">
        <section className="audio-bar">
          <div>
            <div style={{ fontSize: 12, color: "var(--tx-ter)" }}>{call ? `${doneCount}/${segs.length} spikes resolved` : "No call selected"}</div>
            <strong style={{ fontSize: 15 }}>{call ? (call.agent_name || call.execution_id.slice(0, 8)) : "Select a call to start"}</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <audio ref={audioRef} controls preload="auto" onTimeUpdate={onTime} onPlay={stopSpikeAudio}
                src={call ? `/api/audio?url=${encodeURIComponent(call.recording_url || "")}` : undefined} style={{ height: 32, width: "100%", maxWidth: 380 }} />
              <div style={{ display: "inline-flex", gap: 2, border: "1px solid var(--tx-border2)", borderRadius: 7, overflow: "hidden" }} title="Playback speed">
                {[0.5, 0.75, 1].map((r) => (
                  <button key={r} onClick={() => changeRate(r)}
                    style={{ fontSize: 12, padding: "5px 9px", border: "none", cursor: "pointer",
                      background: rate === r ? "var(--tx-green)" : "var(--tx-input-bg)", color: rate === r ? "var(--tx-chosen-label)" : "var(--tx-sec)" }}>
                    {r}×
                  </button>
                ))}
              </div>
              <div style={{ display: "inline-flex", gap: 2, border: "1px solid var(--tx-border2)", borderRadius: 7, overflow: "hidden", opacity: stereoOk ? 1 : 0.45 }}
                title={stereoOk ? "Which channel plays on spike playback (U to toggle user-only)" : "Mono recording · channels can't be separated"}>
                {([["both", "Both"], ["user", "User only"], ["agent", "Agent only"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => stereoOk && pickHear(k)} disabled={!stereoOk}
                    style={{ fontSize: 12, padding: "5px 9px", border: "none", cursor: stereoOk ? "pointer" : "default",
                      background: hear === k ? (k === "user" ? "var(--tx-blue)" : k === "agent" ? "var(--tx-green)" : "var(--tx-slate2)") : "var(--tx-input-bg)",
                      color: hear === k ? "var(--tx-input-bg)" : "var(--tx-sec)" }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => setRulesOpen(!rulesOpen)} style={{ fontSize: 12 }}>{rulesOpen ? "rules ▴" : "rules ▾"}</button>
              <ThemeToggle compact />
              {approxMode && <span style={{ fontSize: 11, color: "var(--tx-amber)" }}>~approx timing</span>}
            </div>
          </div>
          <div>
            {wave ? (
              <>
                <canvas ref={canvasRef} className="waveform" style={{ width: "100%", height: 100, cursor: "pointer", display: "block" }}
                  onClick={(e) => {
                    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const t = ((e.clientX - r.left) / r.width) * wave.duration;
                    const hit = segs.findIndex((gg) => t >= gg.start && t <= gg.end);
                    if (hit >= 0) playSeg(hit);
                    else seekPlay(t, null);
                  }}
                  // Double-click adds a segment the detector missed. Single
                  // click is untouched, and a double-click that lands ON a
                  // spike does nothing new · spike behaviour is unchanged.
                  onDoubleClick={(e) => {
                    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const t = ((e.clientX - r.left) / r.width) * wave.duration;
                    if (segs.some((gg) => t >= gg.start && t <= gg.end)) return;
                    addSegAt(t);
                  }} />
                <div style={{ fontSize: 10.5, color: "var(--tx-ter)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>
                    <span style={{ color: "var(--tx-green)" }}>▮ agent</span> · <span style={{ color: "var(--tx-blue)" }}>▮ user</span> · user spikes: <span style={{ color: "var(--tx-red)" }}>pending</span> / <span style={{ color: "var(--tx-green)" }}>done</span> / <span style={{ color: "var(--tx-amber)" }}>current</span> · click a spike to jump · Space replay · ←/→ · U user-only
                  </span>
                  <button onClick={() => addSegAt(playhead)}
                    title="Add a segment the detector missed, at the playhead. Or double-click anywhere on the waveform."
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px dashed var(--tx-blue)", background: "var(--tx-input-bg)", color: "var(--tx-blue-strong)", cursor: "pointer" }}>
                    + add segment at playhead
                  </button>
                  <span style={{ color: "var(--tx-dis)" }}>or double-click the waveform</span>
                </div>
              </>
            ) : call && analyzing ? <div style={{ fontSize: 12, color: "var(--tx-sec)" }}>Analyzing waveform…</div> : null}
          </div>
        </section>

        {rulesOpen && (
          <section style={{ background: "var(--tx-rules-bg)", borderBottom: "1px solid var(--tx-rules-line)", padding: "8px 18px" }}>
            <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 12.5, color: "var(--tx-rules-ink)", lineHeight: 1.7 }}>
              {RULES.map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
            </ul>
          </section>
        )}

        <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "minmax(360px,1fr) minmax(260px,0.7fr)", gap: 14, alignItems: "start" }}>
          {!call ? (
            <p style={{ color: "var(--tx-ter)", fontSize: 13 }}>{analyzing ? "Loading…" : "Pick a call from the left to start transcribing."}</p>
          ) : analyzing ? (
            <p style={{ color: "var(--tx-sec)", fontSize: 13 }}>Analyzing user-channel waveform…</p>
          ) : (
            <>
              <section>
                {g && s && (
                  <div style={{ border: "2px solid var(--tx-amber)", background: "var(--tx-input-bg)", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button onClick={() => playSeg(cur)} style={{ fontSize: 13 }}>🔁 {fmt(g.start)}-{fmt(g.end)}</button>
                      <strong style={{ fontSize: 13, color: "var(--tx-sec)" }}>spike {cur + 1} of {segs.length}</strong>
                      {s.status === "done" && <span style={{ fontSize: 11, color: "var(--tx-green)" }}>✓ {s.kind}</span>}
                      {g.manual && (
                        <span title="You added this segment · the detector did not find it"
                          style={{ fontSize: 10.5, fontWeight: 600, color: "var(--tx-blue-strong)", background: "var(--tx-added-bg)", border: "1px solid var(--tx-added-line)", borderRadius: 999, padding: "2px 8px" }}>
                          added by you
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        {g.manual && (
                          <button onClick={() => removeSeg(cur)} title="Remove this segment you added"
                            style={{ fontSize: 12, color: "var(--tx-red-strong)" }}>✕ remove</button>
                        )}
                        <button disabled={cur === 0} onClick={() => playSeg(cur - 1)} style={{ fontSize: 12 }}>← prev</button>
                        <button disabled={cur >= segs.length - 1} onClick={() => playSeg(cur + 1)} style={{ fontSize: 12 }}>next →</button>
                      </span>
                    </div>

                    {g.asr !== null && !blind ? (
                      <>
                        <div style={{ fontSize: 11.5, color: "var(--tx-ter)", marginTop: 10 }}>ASR heard {g.official ? "(official Bolna turn)" : ""}:</div>
                        <p style={{ fontSize: 16, margin: "4px 0 10px", color: "var(--tx-ink)", lineHeight: 1.6 }}>{asrText}</p>
                      </>
                    ) : g.asr !== null && blind ? (
                      <p style={{ fontSize: 13.5, margin: "10px 0", color: "var(--tx-slate)" }}>Listen and write what the user said.</p>
                    ) : (
                      <p style={{ fontSize: 13.5, margin: "10px 0", color: "var(--tx-red-deep)" }}>No official transcript for this spike · listen and write what was said.</p>
                    )}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {g.asr !== null && !blind && (
                        <>
                          <button onClick={() => resolve(cur, "correct")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--tx-green)", background: s.kind === "correct" ? "var(--tx-green)" : "var(--tx-input-bg)", color: s.kind === "correct" ? "var(--tx-input-bg)" : "var(--tx-green)", cursor: "pointer" }}>✓ Correct</button>
                          <button onClick={() => resolve(cur, "wrong")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--tx-orange)", background: s.kind === "wrong" ? "var(--tx-orange)" : "var(--tx-input-bg)", color: s.kind === "wrong" ? "var(--tx-input-bg)" : "var(--tx-orange)", cursor: "pointer" }}>✏ Edit · ASR is wrong</button>
                        </>
                      )}
                      {(g.asr === null || blind) && (
                        <button onClick={() => resolve(cur, g.asr === null ? "missing" : "wrong")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--tx-orange)", background: (s.kind === "missing" || (blind && s.kind === "wrong")) ? "var(--tx-orange)" : "var(--tx-input-bg)", color: (s.kind === "missing" || (blind && s.kind === "wrong")) ? "var(--tx-input-bg)" : "var(--tx-orange)", cursor: "pointer" }}>✏ Write it</button>
                      )}
                      <button onClick={() => resolve(cur, "noise")} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--tx-slate)", background: s.kind === "noise" ? "var(--tx-slate)" : "var(--tx-input-bg)", color: s.kind === "noise" ? "var(--tx-input-bg)" : "var(--tx-slate)", cursor: "pointer" }}>{"{noise}"}</button>
                      <button onClick={() => resolve(cur, "deleted")} title="This isn't a user turn; the detector was wrong. Removes it from the transcript." style={{ fontSize: 13, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--tx-red-strong)", background: s.kind === "deleted" ? "var(--tx-red-strong)" : "var(--tx-input-bg)", color: s.kind === "deleted" ? "var(--tx-input-bg)" : "var(--tx-red-strong)", cursor: "pointer" }}>🗑 Not a user turn</button>
                      {/* Distinct from {noise}: noise means there is no user
                          speech here at all, this means there IS speech and it
                          is hard to make out. Reviewers already use them apart
                          · only 183 of 6,512 noise segments carry this flag. */}
                      <label title="There is speech here, but it is hard to make out. Different from {noise}, which means no user speech at all."
                        style={{ fontSize: 12, color: "var(--tx-sec)", display: "flex", gap: 4, alignItems: "center", marginLeft: "auto" }}>
                        <input type="checkbox" checked={s.unclear} onChange={(e) => patch(cur, { unclear: e.target.checked })} /> audio unclear / feeble voice
                      </label>
                    </div>

                    {editorOpen && (
                      <div style={{ marginTop: 10 }}>
                        {g.asr !== null && !blind && (
                          <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--tx-sec)", marginBottom: 6 }}>
                            wrong in:
                            <label><input type="radio" checked={s.wrongLang === "same"} onChange={() => patch(cur, { wrongLang: "same" })} /> same language</label>
                            <label><input type="radio" checked={s.wrongLang === "different"} onChange={() => patch(cur, { wrongLang: "different" })} /> different language</label>
                          </div>
                        )}
                        <textarea value={s.roman} rows={2} autoFocus style={{ width: "100%", fontSize: 14.5 }}
                          placeholder="Type in Roman · hindi words convert automatically (e.g. haan didi main kaam kar rahi hoon)"
                          onChange={(e) => onRoman(cur, e.target.value)} />
                        {s.tokens.length > 0 && (
                          <div style={{ background: "var(--tx-preview-bg)", border: "1px solid var(--tx-preview-line)", borderRadius: 8, padding: "8px 10px", marginTop: 6, fontSize: 15.5, lineHeight: 1.9 }}>
                            {/* flex-wrap: adjacent spans have no whitespace between them, so
                                without this a long sentence can't break and overflows the card */}
                            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 2 }}>
                            {s.tokens.map((t, ti) => (
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
                                style={{ cursor: "pointer", padding: "1px 3px", borderRadius: 4, marginRight: 3, background: altPick?.ti === ti ? "var(--tx-token-pick)" : t.converted ? "var(--tx-token-bg)" : "transparent" }}>
                                {t.converted ? t.out : t.src}
                              </span>
                            ))}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--tx-ter)", marginTop: 2 }}>highlighted = converted to Devanagari · click any word to fix it</div>
                            {altPick && s.tokens[altPick.ti] && (() => {
                              const tk0 = s.tokens[altPick.ti];
                              const apply = (out: string | null) => { // null = keep Roman
                                const tk = [...s.tokens];
                                tk[altPick.ti] = out === null ? { ...tk[altPick.ti], converted: false } : { ...tk[altPick.ti], out, converted: true };
                                patch(cur, { tokens: tk });
                                setAltPick(null);
                              };
                              return (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderTop: "1px dashed var(--tx-preview-line)", marginTop: 6, paddingTop: 7 }}>
                                  <span style={{ fontSize: 12, color: "var(--tx-sec)" }}>“{tk0.src}” =</span>
                                  {altPick.loading && <span style={{ fontSize: 12, color: "var(--tx-ter)" }}>…</span>}
                                  {altPick.alts.map((a) => (
                                    <button key={a} onClick={() => apply(a)}
                                      style={{ fontSize: 15, padding: "2px 10px", borderRadius: 6, cursor: "pointer", border: tk0.converted && tk0.out === a ? "2px solid var(--tx-green)" : "1px solid var(--tx-preview-line)", background: "var(--tx-input-bg)" }}>
                                      {a}
                                    </button>
                                  ))}
                                  <button onClick={() => apply(null)}
                                    style={{ fontSize: 13, padding: "2px 10px", borderRadius: 6, cursor: "pointer", border: !tk0.converted ? "2px solid var(--tx-green)" : "1px solid var(--tx-border2)", background: "var(--tx-input-bg)", color: "var(--tx-slate)" }}>
                                    {tk0.src}
                                  </button>
                                  <button onClick={() => setAltPick(null)} style={{ fontSize: 12, border: "none", background: "transparent", color: "var(--tx-ter)", cursor: "pointer" }}>✕</button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {lint(goldOf(s.tokens, s.roman)).map((w) => <div key={w} style={{ fontSize: 11.5, color: "var(--tx-amber)", marginTop: 3 }}>⚠ {w}</div>)}
                        <button onClick={() => saveEdit(cur)} disabled={!goldOf(s.tokens, s.roman) && !s.unclear}
                          style={{ marginTop: 8, fontSize: 13, padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--tx-green)", color: "var(--tx-chosen-label)", cursor: "pointer" }}>
                          Save & next
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Flag the call · for audio that cannot be transcribed, wrong
                    call, or anything the reviewer is unsure about. A flagged
                    call can be submitted without resolving every spike, because
                    a broken call cannot be finished. */}
                <div style={{ marginTop: 14 }}>
                  {!flagOpen && !flagReason && (
                    <button type="button" onClick={() => setFlagOpen(true)}
                      style={{ width: "100%", padding: "9px 0", fontSize: 13, borderRadius: 9, border: "1px dashed var(--tx-border)", background: "transparent", color: "var(--tx-ter)", cursor: "pointer" }}>
                      ⚑ Flag this call — bad audio, wrong call, or unsure
                    </button>
                  )}
                  {(flagOpen || flagReason) && (
                    <div style={{ border: "1px solid var(--tx-amber)", background: "var(--wash-cream, rgba(255,200,80,.08))", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--tx-amber)" }}>⚑ Flag this call</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {["Audio unclear / inaudible", "Wrong or broken recording", "No user speech in call", "Language I cannot transcribe", "Not sure how to tag", "Other"].map((r) => (
                          <button key={r} type="button" onClick={() => setFlagReason(flagReason === r ? "" : r)}
                            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, cursor: "pointer",
                              border: flagReason === r ? "1.5px solid var(--tx-amber)" : "1px solid var(--tx-border)",
                              background: flagReason === r ? "var(--tx-amber)" : "transparent",
                              color: flagReason === r ? "var(--tx-chosen-label)" : "var(--tx-ter)" }}>{r}</button>
                        ))}
                      </div>
                      <label style={{ display: "block", fontSize: 12, color: "var(--tx-ter)", marginBottom: 4 }}>
                        Your remarks {flagReason === "Other" || flagReason === "Not sure how to tag" ? "(please describe)" : "(optional)"}
                      </label>
                      <textarea value={flagNote} onChange={(e) => setFlagNote(e.target.value)} rows={4}
                        placeholder="What exactly is wrong, or what are you unsure about? Mention a timestamp if it helps."
                        style={{ width: "100%", fontSize: 13, padding: 9, borderRadius: 7, border: "1px solid var(--tx-border)", background: "var(--tx-input-bg)", color: "inherit", resize: "vertical", lineHeight: 1.45 }} />
                      <button type="button" onClick={() => { setFlagOpen(false); setFlagReason(""); setFlagNote(""); }}
                        style={{ marginTop: 6, fontSize: 12, background: "none", border: "none", color: "var(--tx-ter)", cursor: "pointer", textDecoration: "underline" }}>
                        Cancel flag
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ position: "sticky", bottom: 10, marginTop: 10 }}>
                  <button onClick={submit} disabled={(!allDone && !flagReason && !flagNote.trim()) || submitting}
                    style={{ width: "100%", padding: "12px 0", fontSize: 15, borderRadius: 10, border: "none", cursor: (allDone || flagReason || flagNote.trim()) ? "pointer" : "not-allowed", background: (flagReason || flagNote.trim()) ? "var(--tx-amber)" : allDone ? "var(--tx-green)" : "var(--tx-submit-dis-bg)", color: "var(--tx-chosen-label)" }}>
                    {submitting ? "Submitting…" : (flagReason || flagNote.trim()) ? `Submit flagged call (${doneCount}/${segs.length} resolved)` : allDone ? "Submit golden transcription" : `Resolve all spikes to submit (${doneCount}/${segs.length})`}
                  </button>
                </div>
              </section>

              <section style={{ background: "var(--tx-input-bg)", border: "1px solid var(--tx-border)", borderRadius: 10, padding: 12, maxHeight: "72vh", overflow: "auto", position: "sticky", top: 120 }}>
                {/* User turns = the spikes themselves, so mapping is always 1:1.
                    Bolna's telemetry ASR turns don't line up with the cleaned
                    agent-context transcript, so the segment list is authoritative. */}
                <div style={{ fontSize: 12, color: "var(--tx-ter)", marginBottom: 8 }}>User turns ({segs.length}) · click to jump</div>
                {segs.map((sg, i) => {
                  const deleted = st(i).kind === "deleted";
                  const said = st(i).status === "done"
                    ? (st(i).kind === "correct" ? (sg.asr || "") : st(i).kind === "noise" ? "{noise}" : deleted ? "" : goldOf(st(i).tokens, st(i).roman))
                    : (blind ? "" : (sg.asr ?? ""));
                  return (
                    <p key={i} onClick={() => playSeg(i)}
                      style={{ fontSize: 12.5, lineHeight: 1.5, margin: "5px 0", padding: "3px 5px", borderRadius: 4, cursor: "pointer",
                        background: i === cur ? "var(--tx-turnrow)" : "transparent", opacity: deleted ? 0.5 : 1,
                        textDecoration: deleted ? "line-through" : "none",
                        borderLeft: `3px solid ${deleted ? "var(--tx-red-strong)" : st(i).status === "done" ? "var(--tx-green)" : sg.official ? "var(--tx-submit-dis-bg)" : "var(--tx-orange)"}` }}>
                      <strong style={{ color: "var(--tx-sec)" }}>{i + 1}. @{fmt(sg.start)}{sg.official ? "" : " · spike"}:</strong>{" "}
                      {deleted ? <em style={{ color: "var(--tx-red-strong)" }}>not a user turn (removed)</em>
                        : said ? <span style={{ color: "var(--tx-ink)" }}>{said}</span>
                        : <em style={{ color: "var(--tx-red-deep)" }}>needs transcription</em>}
                    </p>
                  );
                })}
                {!blind && <div style={{ fontSize: 12, color: "var(--tx-ter)", margin: "16px 0 6px", borderTop: "1px solid var(--chip)", paddingTop: 10 }}>Conversation context (agent + user, read-only)</div>}
                {!blind && call.turns.map((t, i) => (
                  <p key={i} style={{ fontSize: 12, lineHeight: 1.55, margin: "5px 0", color: t.role === "assistant" ? "var(--tx-ter)" : "var(--tx-slate)" }}>
                    <strong>{t.role === "assistant" ? "agent" : "user"}:</strong> {t.text}
                  </p>
                ))}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
