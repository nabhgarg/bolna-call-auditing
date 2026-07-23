"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CallSummary = {
  queue_id?: string | null;
  execution_id: string;
  assigned_reviewer?: string | null;
  org_name?: string | null;
  agent_name?: string | null;
  duration_sec?: number | null;
  created_at_ist?: string | null;
  status?: string | null;
  language?: string | null;
  audit_mode?: string | null;
  source_sheet?: string | null;
  reviewed?: boolean;
  reviewer_name?: string | null;
};

type CallDetail = CallSummary & {
  transcript?: string | null;
  recording_url?: string | null;
  turns?: Array<{ role: string; text: string }>;
  turn_anchors?: Array<{ text: string; startSec: number; endSec: number }>;
};

type Issue = Record<string, string>;
type MetricRating = { rating: string; reason: string };
type AuditMode = "pronunciation_tone" | "timing_transcription" | "response_vibe";
const RESPONSE_VIBE_MODE: AuditMode = "response_vibe";
// Full issue-type taxonomy (kept for labels/config). Transcription now lives in
// the Transcript panel; response appropriateness returns to Review later.
const combinedIssueTypes = ["transcription", "response_appropriateness", "pronunciation"];
void combinedIssueTypes;
const TRANSCRIPTION_ERROR_TYPES = ["Wrong Transcription same language", "Wrong Transcription different language", "Missing"];
// Shown when correcting an existing turn.
const CORRECTION_ERROR_TYPES = ["Wrong Transcription same language", "Wrong Transcription different language", "Missing"];
const DELETED_TURN_ERROR_TYPE = "Wrongly captured (delete turn)";
const RESPONSE_ERROR_SUBTYPES: Record<string, string[]> = {
  "Repetition": ["Same info asked again", "Same response repeated"],
  "Language errors": ["Switched language unprompted", "Responded in wrong language"]
};
const ratingMetricsByMode: Record<AuditMode, string[]> = {
  pronunciation_tone: ["pronunciation", "tone"],
  timing_transcription: ["barge_in", "latency"],
  response_vibe: []
};

const issueLabels: Record<string, string> = {
  pronunciation: "Pronunciation",
  tone: "Tone",
  barge_in: "Barge-in",
  latency: "Latency",
  response_appropriateness: "Response appropriateness",
  transcription: "Transcription",
  flag_for_review: "Flagged for discussion",
  overall: "Overall"
};

const issueConfigs: Record<string, Array<[string, string, "text" | "select", string[]?]>> = {
  pronunciation: [
    ["content_tag", "Content tag", "select", ["General", "City", "Proper Noun"]],
    ["word_heard", "Word mispronounced", "text"]
  ],
  response_appropriateness: [
    ["response_error_type", "Type of error", "select", ["Repetition", "Language errors", "User input capture errors", "Irrelevant response / others"]],
    ["error_explanation", "Explain the error", "text"]
  ],
  transcription: [
    ["transcription_error_type", "Type of transcription error", "select", ["Wrong Transcription same language", "Wrong Transcription different language", "Missing", "Wrongly captured (delete turn)"]],
    ["audio_unclear", "Audio unclear", "select", ["No", "Yes"]]
  ]
};

const emptyMetricRatings = () => Object.fromEntries(
  Object.values(ratingMetricsByMode).flat().map((metric) => [metric, { rating: "", reason: "" }])
) as Record<string, MetricRating>;

const requiredIssueFields: Record<string, string[]> = {
  pronunciation: ["word_heard"],
  response_appropriateness: ["response_error_type", "error_explanation"],
  transcription: ["transcription_error_type"]
};

function modeLabel(mode: AuditMode) {
  return mode === RESPONSE_VIBE_MODE ? "Combined audit" : "Combined audit";
}

// Issue types logged in the Review panel. Transcription is handled in the
// Transcript panel, not here; response appropriateness returns later.
const reviewIssueTypes = ["pronunciation"];

function modeIssueTypes(_mode: AuditMode) {
  return reviewIssueTypes;
}

function modeRatingMetrics(mode: AuditMode) {
  return ratingMetricsByMode[mode] || [];
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function shortCallId(id: string) {
  return id.slice(0, 8);
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function Page() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [currentCall, setCurrentCall] = useState<CallDetail | null>(null);
  const [currentQueueId, setCurrentQueueId] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerDisplay, setReviewerDisplay] = useState("");
  const [reviewerRole, setReviewerRole] = useState("reviewer");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginVisible, setLoginVisible] = useState(true);
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [otpCode, setOtpCode] = useState("");
  const [auditMode, setAuditMode] = useState<AuditMode>(RESPONSE_VIBE_MODE);
  const [queueView, setQueueView] = useState<"pending" | "submitted">("pending");
  // Set-4 dual assignment: vibe reviewers carry a vibe queue (s4v_*) AND an
  // issue-logging queue (s4i_*). Tabs split the two; the review panel adapts
  // to whichever kind of call is open.
  const [assignView, setAssignView] = useState<"vibe" | "issues">("vibe");
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [waveform, setWaveform] = useState<{ peaks: number[][]; duration: number } | null>(null);
  const [turnTimes, setTurnTimes] = useState<Record<number, number> | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  // inline transcription logging (in the transcript panel)
  const [editingTurn, setEditingTurn] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editErrorType, setEditErrorType] = useState(TRANSCRIPTION_ERROR_TYPES[0]);
  const [editUnclear, setEditUnclear] = useState("No");
  const [insertAt, setInsertAt] = useState<number | null>(null); // insert AFTER this turn number (0 = before first)
  const [insertSlot, setInsertSlot] = useState(0); // position within the gap's inserted turns
  const [editingInsert, setEditingInsert] = useState<Issue | null>(null); // existing inserted turn being edited
  const [insertText, setInsertText] = useState("");
  const [insertTime, setInsertTime] = useState(""); // exact mm:ss of the missing speech
  const [insertUnclear, setInsertUnclear] = useState("No"); // was the audio clear at the gap?
  const [respErrorType, setRespErrorType] = useState("");
  const [flagCall, setFlagCall] = useState<boolean | null>(null); // optional: null = not answered
  const [flagReason, setFlagReason] = useState("");
  const [currentTime, setCurrentTime] = useState("00:00");
  const [capturedTime, setCapturedTime] = useState("00:00");
  const [issueType, setIssueType] = useState(reviewIssueTypes[0]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metricRatings, setMetricRatings] = useState<Record<string, MetricRating>>(emptyMetricRatings);
  const [vibeScore, setVibeScore] = useState("");
  const [vibeReason, setVibeReason] = useState("");
  const [missingIssueFields, setMissingIssueFields] = useState<string[]>([]);
  const [missingRatingFields, setMissingRatingFields] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittedCallId, setSubmittedCallId] = useState("");

  useEffect(() => {
    const storedEmail = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
    const storedDisplay = window.localStorage.getItem("auditReviewerDisplay") || "";
    const storedRole = window.localStorage.getItem("auditReviewerRole") || "reviewer";
    const initialMode = RESPONSE_VIBE_MODE;
    setLoginEmail(storedEmail);
    setAuditMode(initialMode);
    setIssueType(modeIssueTypes(initialMode)[0] || "");
    if (storedEmail) {
      setReviewerEmail(storedEmail);
      setReviewerDisplay(storedDisplay || storedEmail);
      setReviewerRole(storedRole);
      setLoginVisible(false);
      loadCalls(storedEmail, initialMode);
      // Refresh role/display from the server so a cached session (e.g. from before
      // roles existed) self-heals instead of defaulting to the reviewer screen.
      fetch(`/api/profile?email=${encodeURIComponent(storedEmail)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (!p) return;
          setReviewerRole(p.role || "reviewer");
          setReviewerDisplay(p.display_name || storedEmail);
          window.localStorage.setItem("auditReviewerRole", p.role || "reviewer");
          window.localStorage.setItem("auditReviewerDisplay", p.display_name || storedEmail);
        })
        .catch(() => {});
    }
  }, []);

  // Issue loggers now work exclusively in the transcription workbench —
  // send them straight there once their role is known.
  useEffect(() => {
    if (!loginVisible && reviewerRole === "issue_logger") window.location.replace("/transcribe");
  }, [reviewerRole, loginVisible]);

  // Draw waveform: agent channel up (green), user channel down (blue), playhead line
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { peaks, duration } = waveform;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#e6ebe9";
    ctx.fillRect(0, mid - 0.5, W, 1);
    const bars = peaks[0].length;
    const bw = W / bars;
    for (let i = 0; i < bars; i++) {
      const up = (peaks[0][i] || 0) * (mid - 2);
      const down = (peaks[1]?.[i] || 0) * (mid - 2);
      ctx.fillStyle = "#1f7a5c";
      ctx.fillRect(i * bw, mid - up, Math.max(bw - 0.5, 0.5), up);
      ctx.fillStyle = "#5b8def";
      ctx.fillRect(i * bw, mid, Math.max(bw - 0.5, 0.5), down);
    }
    if (duration > 0) {
      const x = (playheadSec / duration) * W;
      ctx.fillStyle = "#d64545";
      ctx.fillRect(x - 1, 0, 2, H);
    }
  }, [waveform, playheadSec]);

  async function api(path: string, options?: RequestInit) {
    const response = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  async function loadCalls(reviewer = reviewerEmail, mode: AuditMode = auditMode) {
    const params = new URLSearchParams({ mode });
    if (reviewer) params.set("reviewer", reviewer);
    const payload = await api(`/api/calls?${params.toString()}`);
    setCalls(payload.calls || []);
  }

  const isPriority = (call: CallSummary) => String(call.source_sheet || "").includes("★");
  const isIssueAssignment = (id?: string | null) => /^[sb]\di_/.test(String(id || ""));
  // queue_id alone is shared across a person's whole batch (e.g. b4v_aditya),
  // so rows are identified by queue_id + call id.
  const rowKey = (call: CallSummary) => `${call.queue_id || ""}:${call.execution_id}`;
  // Vibe reviewers with an s4i_* queue get the vibe/issue-logging tab split.
  const hasIssueQueue = reviewerRole === "reviewer" && calls.some((call) => isIssueAssignment(call.queue_id));
  const tabCalls = useMemo(() => {
    if (!hasIssueQueue) return calls;
    return calls.filter((call) => isIssueAssignment(call.queue_id) === (assignView === "issues"));
  }, [calls, hasIssueQueue, assignView]);
  const filteredCalls = useMemo(() => {
    return tabCalls
      .filter((call) => {
        if (queueView === "pending" && call.reviewed) return false;
        if (queueView === "submitted" && !call.reviewed) return false;
        return true;
      })
      // priority (★) calls float to the top, then by id
      .sort((a, b) => (Number(isPriority(b)) - Number(isPriority(a))) || a.execution_id.localeCompare(b.execution_id));
  }, [tabCalls, queueView]);
  const reviewedCount = tabCalls.filter((call) => call.reviewed).length;
  const pendingCount = tabCalls.length - reviewedCount;
  const currentCallSummary = currentCall
    ? calls.find((call) => rowKey(call) === currentQueueId) || null
    : null;
  const currentCallSubmitted = Boolean(currentCallSummary?.reviewed || (currentCall && submittedCallId === currentQueueId));
  // Role decides the screen. Transcription is NOT an issue type — it lives in
  // the Transcript panel (correct text + mark audio clarity + timestamp).
  //   vibe reviewer  -> vibe score only
  //   issue logger   -> pronunciation (Review) + transcription (Transcript panel)
  //   expert (GT)    -> vibe + pronunciation + response appropriateness (Review) + transcription (Transcript panel)
  //   vibe reviewer on an s4i_* call -> issue logging (pronunciation +
  //   response appropriateness), no vibe score.
  const currentIsIssueCall = reviewerRole === "reviewer" && isIssueAssignment(currentQueueId);
  const showVibe = reviewerRole !== "issue_logger" && !currentIsIssueCall;
  const showTranscription = reviewerRole === "issue_logger" || reviewerRole === "expert";
  const visibleIssueTypes =
    reviewerRole === "expert"
      ? ["pronunciation", "response_appropriateness"]
      : reviewerRole === "issue_logger"
        ? ["pronunciation"]
        : currentIsIssueCall
          ? ["pronunciation", "response_appropriateness"]
          : [];
  const showIssues = visibleIssueTypes.length > 0;
  useEffect(() => {
    if (visibleIssueTypes.length && !visibleIssueTypes.includes(issueType)) setIssueType(visibleIssueTypes[0]);
  }, [reviewerRole, currentQueueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function switchMode(mode: AuditMode) {
    if (mode === auditMode) return;
    setAuditMode(mode);
    setIssueType(modeIssueTypes(mode)[0] || "");
    setCurrentCall(null);
    setCurrentQueueId("");
    setIssues([]);
    setMetricRatings(emptyMetricRatings());
    setVibeScore("");
    setVibeReason("");
    setMissingIssueFields([]);
    setMissingRatingFields([]);
    setStatusMessage("");
    setQueueView("pending");
    window.localStorage.setItem("auditMode", mode);
    await loadCalls(reviewerEmail, mode);
  }

  async function selectCall(id: string, queueId = id) {
    const call = await api(`/api/calls/${encodeURIComponent(id)}`);
    setCurrentCall(call);
    setCurrentQueueId(queueId);
    setIssues([]);
    setMetricRatings(emptyMetricRatings());
    setVibeScore("");
    setVibeReason("");
    setMissingIssueFields([]);
    setMissingRatingFields([]);
    setCapturedTime("00:00");
    setStartedAt(new Date().toISOString());
    setNotes("");
    setSubmittedCallId("");
    setRespErrorType("");
    setFlagCall(null);
    setFlagReason("");
    setEditingTurn(null);
    closeInsertEditor();
    setWaveform(null);
    setTurnTimes(null);
    setPlayheadSec(0);
    void analyzeAudio(call);
  }

  // Decode the recording in-browser: waveform peaks per channel + exact turn timestamps
  // (Bolna recordings are stereo with agent/user on separate channels).
  async function analyzeAudio(call: CallDetail) {
    try {
      if (!call.recording_url || !call.turns?.length) return;
      const res = await fetch(`/api/audio?url=${encodeURIComponent(call.recording_url)}`);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(buf);
      void ctx.close();
      const duration = decoded.duration;
      const chs = decoded.numberOfChannels;
      const data = [decoded.getChannelData(0), chs > 1 ? decoded.getChannelData(1) : decoded.getChannelData(0)];

      // 100ms RMS activity tracks per channel
      const win = Math.max(1, Math.floor(decoded.sampleRate * 0.1));
      const n = Math.floor(data[0].length / win);
      const rms = (ch: Float32Array) => {
        const out = new Float32Array(n);
        let max = 0;
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let j = i * win; j < (i + 1) * win; j++) s += ch[j] * ch[j];
          out[i] = Math.sqrt(s / win);
          if (out[i] > max) max = out[i];
        }
        if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
        return out;
      };
      const tracks = [rms(data[0]), rms(data[1])];

      // crosstalk suppression: where both channels are "active" simultaneously,
      // the much quieter one is usually bleed from the other — mute it there
      const TH = 0.05, DOM = 0.45;
      const active: boolean[][] = [new Array(n), new Array(n)];
      for (let i = 0; i < n; i++) {
        let a0 = tracks[0][i] > TH;
        let a1 = tracks[1][i] > TH;
        if (a0 && a1) {
          if (tracks[0][i] < DOM * tracks[1][i]) a0 = false;
          else if (tracks[1][i] < DOM * tracks[0][i]) a1 = false;
        }
        active[0][i] = a0;
        active[1][i] = a1;
      }

      // waveform peaks for drawing: ~700 buckets per channel
      const buckets = 700;
      const per = Math.max(1, Math.floor(n / buckets));
      const peaks = tracks.map((t) => {
        const p: number[] = [];
        for (let i = 0; i + per <= n; i += per) {
          let m = 0;
          for (let j = i; j < i + per; j++) if (t[j] > m) m = t[j];
          p.push(Math.round(m * 100) / 100);
        }
        return p;
      });
      setWaveform({ peaks, duration });

      // channels split? if correlated, skip turn alignment (mono/duplicated mix)
      let dot = 0, m0 = 0, m1 = 0;
      for (let i = 0; i < n; i++) { dot += tracks[0][i] * tracks[1][i]; m0 += tracks[0][i] ** 2; m1 += tracks[1][i] ** 2; }
      const corr = dot / (Math.sqrt(m0 * m1) || 1);
      if (chs < 2 || corr > 0.7) return;

      // speech segments per channel (from crosstalk-suppressed activity)
      const segs = (act: boolean[]) => {
        const out: Array<[number, number]> = [];
        let start = -1;
        for (let i = 0; i < n; i++) {
          const v = act[i];
          if (v && start < 0) start = i;
          if (!v && start >= 0) { out.push([start * 0.1, i * 0.1]); start = -1; }
        }
        if (start >= 0) out.push([start * 0.1, n * 0.1]);
        const merged: Array<[number, number]> = [];
        for (const s of out) {
          if (merged.length && s[0] - merged[merged.length - 1][1] < 0.5) merged[merged.length - 1][1] = s[1];
          else merged.push([s[0], s[1]]);
        }
        return merged.filter((s) => s[1] - s[0] >= 0.25);
      };
      const seg0 = segs(active[0]);
      const seg1 = segs(active[1]);
      const roles = call.turns.map((t) => (t.role === "assistant" ? "assistant" : "user"));
      type Seg = { start: number; end: number; role: string };

      // DP alignment of the turn sequence against one channel labeling. Returns the
      // matched start time per turn, how many turns matched, and the DP cost.
      const alignOne = (agentSeg: Array<[number, number]>, userSeg: Array<[number, number]>) => {
        const allSegs: Seg[] = [
          ...agentSeg.map(([s, e]) => ({ start: s, end: e, role: "assistant" })),
          ...userSeg.map(([s, e]) => ({ start: s, end: e, role: "user" }))
        ].sort((a, b) => a.start - b.start);
        const T = roles.length, S = allSegs.length;
        const SKIP_SEG = 0.6, SKIP_TURN = 1.0, INF = 1e9;
        const dp: number[][] = Array.from({ length: T + 1 }, () => Array(S + 1).fill(INF));
        const back: number[][] = Array.from({ length: T + 1 }, () => Array(S + 1).fill(0));
        dp[0][0] = 0;
        for (let i = 0; i <= T; i++) {
          for (let j = 0; j <= S; j++) {
            const cur = dp[i][j];
            if (cur >= INF) continue;
            if (i < T && j < S && roles[i] === allSegs[j].role && cur < dp[i + 1][j + 1]) { dp[i + 1][j + 1] = cur; back[i + 1][j + 1] = 1; }
            if (i > 0 && j < S && roles[i - 1] === allSegs[j].role && cur < dp[i][j + 1]) { dp[i][j + 1] = cur; back[i][j + 1] = 2; }
            if (j < S && cur + SKIP_SEG < dp[i][j + 1]) { dp[i][j + 1] = cur + SKIP_SEG; back[i][j + 1] = 3; }
            if (i < T && cur + SKIP_TURN < dp[i + 1][j]) { dp[i + 1][j] = cur + SKIP_TURN; back[i + 1][j] = 4; }
          }
        }
        const times: Record<number, number> = {};
        const wc = (s: string) => Math.max(s.trim().split(/\s+/).filter(Boolean).length, 1);
        const xs: number[] = []; // word counts of matched turns
        const ys: number[] = []; // matched segment durations
        let bi = T, bj = S, matched = 0;
        while (bi > 0 || bj > 0) {
          const move = back[bi][bj];
          if (move === 1) {
            const seg = allSegs[bj - 1];
            times[bi - 1] = seg.start; matched += 1;
            xs.push(wc(call.turns![bi - 1].text)); ys.push(seg.end - seg.start);
            bi -= 1; bj -= 1;
          }
          else if (move === 2 || move === 3) { bj -= 1; }
          else if (move === 4) { bi -= 1; }
          else break;
        }
        // fit = correlation between a turn's word count and its segment duration.
        // The correct channel labeling maps short turns to short segments.
        let fit = 0;
        if (xs.length > 2) {
          const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
          const mx = mean(xs), my = mean(ys);
          let cov = 0, vx = 0, vy = 0;
          for (let k = 0; k < xs.length; k++) { cov += (xs[k] - mx) * (ys[k] - my); vx += (xs[k] - mx) ** 2; vy += (ys[k] - my) ** 2; }
          fit = vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
        }
        return { times, matched, cost: dp[T][S], fit };
      };

      // --- HYBRID: pin user turns to Bolna telemetry anchors when available ---
      // Anchor spacing is exact (real-time ASR); only a constant clock offset vs the
      // recording is unknown. Solve channel+offset by maximizing speech activity at
      // anchor positions, pin matched user turns, and let DP fill agent turns.
      let times: Record<number, number> | null = null;
      const tAnchors = call.turn_anchors || [];
      if (tAnchors.length >= 2) {
        const normTokens = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
        const sim = (a: string, b: string) => {
          const A1 = new Set(normTokens(a)), B1 = new Set(normTokens(b));
          if (!A1.size || !B1.size) return 0;
          let inter = 0; A1.forEach((w) => { if (B1.has(w)) inter += 1; });
          return inter / Math.max(A1.size, B1.size);
        };
        // in-order greedy match: user turns <-> anchors
        const userTurnIdx = roles.map((r, i) => (r === "user" ? i : -1)).filter((i) => i >= 0);
        const pairs: Array<{ turn: number; anchor: number }> = [];
        let nextAnchor = 0;
        for (const ti of userTurnIdx) {
          let best = -1, bestScore = 0.34;
          for (let j = nextAnchor; j < Math.min(nextAnchor + 3, tAnchors.length); j++) {
            const s = sim(call.turns![ti].text, tAnchors[j].text);
            if (s > bestScore) { best = j; bestScore = s; }
          }
          if (best >= 0) { pairs.push({ turn: ti, anchor: best }); nextAnchor = best + 1; }
        }
        if (pairs.length >= 2) {
          // grid-search: which channel is the user, and what clock offset fits
          const activityScore = (ch: number, off: number) => {
            let sc = 0;
            for (const p of pairs) {
              const t0 = tAnchors[p.anchor].startSec + off;
              const i0 = Math.floor(t0 / 0.1);
              for (let k = i0; k < i0 + 10; k++) { if (k >= 0 && k < n && active[ch][k]) { sc += 1; break; } }
            }
            return sc;
          };
          let bestCh = 0, bestOff = 0, bestSc = -1;
          for (const ch of [0, 1]) {
            for (let off = -8; off <= 8.001; off += 0.1) {
              const sc = activityScore(ch, off);
              if (sc > bestSc) { bestSc = sc; bestCh = ch; bestOff = off; }
            }
          }
          if (bestSc >= Math.max(2, Math.floor(pairs.length * 0.6))) {
            // agent = the other channel; DP fills agent/unmatched turns, anchors override user turns
            const base = alignOne(bestCh === 0 ? seg1 : seg0, bestCh === 0 ? seg0 : seg1).times;
            for (const p of pairs) base[p.turn] = Math.max(0, tAnchors[p.anchor].startSec + bestOff);
            times = base;
          }
        }
      }
      if (!times) {
        // fallback: try both channel-as-agent assignments, keep the best fit
        // (short turns should map to short segments), then matched count, then cost.
        const A = alignOne(seg0, seg1); // agent = ch0
        const B = alignOne(seg1, seg0); // agent = ch1
        const better = (p: typeof A, q: typeof A) =>
          Math.abs(p.fit - q.fit) > 0.1 ? p.fit > q.fit
          : p.matched !== q.matched ? p.matched > q.matched
          : p.cost <= q.cost;
        times = better(B, A) ? B.times : A.times;
      }
      const T = roles.length;

      // Alignment is only trustworthy at speaker-change boundaries. Within a run of
      // consecutive same-role turns, spread the turns across the run's time span in
      // proportion to their text length (choppy audio segments make per-turn matches
      // inside a run unreliable).
      const words = (s: string) => Math.max(s.trim().split(/\s+/).filter(Boolean).length, 1);
      type Run = { start: number; end: number };
      const runs: Run[] = [];
      for (let i = 0; i < T; i++) {
        if (!runs.length || roles[i] !== roles[runs[runs.length - 1].start]) runs.push({ start: i, end: i });
        else runs[runs.length - 1].end = i;
      }
      // anchor = earliest matched time within each run
      const anchors: number[] = runs.map((r) => {
        let a = -1;
        for (let i = r.start; i <= r.end; i++) {
          if (times[i] !== undefined && (a < 0 || times[i] < a)) a = times[i];
        }
        return a;
      });
      // interpolate missing anchors across run index
      for (let r = 0; r < runs.length; r++) {
        if (anchors[r] >= 0) continue;
        let prev = r - 1; while (prev >= 0 && anchors[prev] < 0) prev -= 1;
        let next = r + 1; while (next < runs.length && anchors[next] < 0) next += 1;
        const pv = prev >= 0 ? anchors[prev] : 0;
        const nv = next < runs.length ? anchors[next] : duration;
        const span = Math.max(next - prev, 1);
        anchors[r] = pv + ((r - prev) / span) * (nv - pv);
      }
      for (let r = 1; r < runs.length; r++) if (anchors[r] < anchors[r - 1]) anchors[r] = anchors[r - 1];
      // distribute turns inside each run by cumulative word share
      const filled: number[] = new Array(T).fill(0);
      for (let r = 0; r < runs.length; r++) {
        const { start, end } = runs[r];
        const runStart = anchors[r];
        const runEnd = r + 1 < runs.length ? anchors[r + 1] : duration;
        const total = call.turns.slice(start, end + 1).reduce((a, t) => a + words(t.text), 0);
        let cum = 0;
        for (let i = start; i <= end; i++) {
          filled[i] = runStart + (cum / total) * Math.max(runEnd - runStart, 0);
          cum += words(call.turns[i].text);
        }
      }
      for (let i = 1; i < T; i++) if (filled[i] < filled[i - 1]) filled[i] = filled[i - 1];
      const finalTimes: Record<number, number> = {};
      for (let i = 0; i < T; i++) finalTimes[i] = Math.max(0, Math.min(filled[i], duration));
      setTurnTimes(finalTimes);
    } catch {
      // analysis is best-effort; player still works without it
    }
  }

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    if (!email || loggingIn) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      if (result.otp_required === false) {
        // OTP delivery not configured yet — direct allowlist login
        setReviewerEmail(result.email);
        setReviewerDisplay(result.display_name || result.email);
        setReviewerRole(result.role || "reviewer");
        setLoginVisible(false);
        window.localStorage.setItem("auditReviewerEmail", result.email);
        window.localStorage.setItem("auditReviewerDisplay", result.display_name || result.email);
        window.localStorage.setItem("auditReviewerRole", result.role || "reviewer");
        window.localStorage.setItem("auditMode", auditMode);
        await loadCalls(result.email, auditMode);
        return;
      }
      setLoginStep("code");
      setOtpCode("");
    } catch (error) {
      setLoginError((error as Error).message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    const code = otpCode.trim();
    if (!email || !code || loggingIn) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const profile = await api("/api/verify", {
        method: "POST",
        body: JSON.stringify({ email, code })
      });
      setReviewerEmail(profile.email);
      setReviewerDisplay(profile.display_name || profile.email);
      setReviewerRole(profile.role || "reviewer");
      setLoginVisible(false);
      window.localStorage.setItem("auditReviewerEmail", profile.email);
      window.localStorage.setItem("auditReviewerDisplay", profile.display_name || profile.email);
      window.localStorage.setItem("auditReviewerRole", profile.role || "reviewer");
      window.localStorage.setItem("auditMode", auditMode);
      await loadCalls(profile.email, auditMode);
    } catch (error) {
      setLoginError((error as Error).message);
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("auditReviewerEmail");
    window.localStorage.removeItem("auditReviewerDisplay");
    window.localStorage.removeItem("auditReviewerRole");
    setReviewerEmail("");
    setReviewerDisplay("");
    setLoginEmail("");
    setLoginError("");
    setLoginStep("email");
    setOtpCode("");
    setCalls([]);
    setCurrentCall(null);
    setCurrentQueueId("");
    setLoginVisible(true);
  }

  function captureTimestamp() {
    audioRef.current?.pause();
    const value = formatTime(audioRef.current?.currentTime || 0);
    setCapturedTime(value);
    setCurrentTime(value);
  }

  function addIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCall) return;
    const formData = new FormData(event.currentTarget);
    const issue: Issue = {
      type: issueType,
      timestamp: String(formData.get("timestamp") || capturedTime)
    };
    for (const [key, value] of formData.entries()) {
      if (key !== "timestamp") issue[key] = String(value);
    }
    const missing = (requiredIssueFields[issueType] || []).filter((field) => !String(issue[field] || "").trim());
    if (issueType === "response_appropriateness" && RESPONSE_ERROR_SUBTYPES[String(issue.response_error_type || "")] && !String(issue.response_error_subtype || "").trim()) {
      missing.push("response_error_subtype");
    }
    if (missing.length) {
      setMissingIssueFields(missing);
      return;
    }
    setMissingIssueFields([]);
    setIssues((existing) => [...existing, issue]);
    setRespErrorType("");
  }

  // ---- inline transcription logging ----
  function turnTimestamp(index: number) {
    const exact = turnTimes?.[index];
    if (exact !== undefined) return formatTime(exact);
    const duration = Number(currentCall?.duration_sec || 0);
    const turns = currentCall?.turns || [];
    const counts = turns.map((t) => wordCount(t.text));
    const total = counts.reduce((a, b) => a + b, 0) || turns.length || 1;
    const before = counts.slice(0, index).reduce((a, b) => a + b, 0);
    return formatTime(Math.floor((before / total) * duration));
  }

  function turnIssueAt(index: number) {
    return issues.find((i) => i.type === "transcription" && i.turn_number === String(index + 1) && i.after_turn === undefined);
  }

  function startEditTurn(index: number) {
    const existing = turnIssueAt(index);
    const hasCorrection = existing && existing.deleted_turn === undefined;
    closeInsertEditor();
    setEditingTurn(index);
    setEditText(hasCorrection ? existing.audio_said : (currentCall?.turns?.[index]?.text || ""));
    setEditErrorType(hasCorrection && CORRECTION_ERROR_TYPES.includes(existing.transcription_error_type) ? existing.transcription_error_type : CORRECTION_ERROR_TYPES[0]);
    setEditUnclear(hasCorrection ? existing.audio_unclear : "No");
  }

  function saveEditTurn() {
    if (editingTurn === null || !currentCall) return;
    const original = currentCall.turns?.[editingTurn]?.text || "";
    const corrected = editText.trim();
    const unclear = editUnclear === "Yes";
    const turnNumber = String(editingTurn + 1);
    const withoutTurnIssue = (list: Issue[]) => list.filter((i) => !(i.type === "transcription" && i.turn_number === turnNumber && i.after_turn === undefined));
    // Nothing to log only when the audio is clear AND the text is unchanged.
    // If the audio is unclear, we still save (no transcription required).
    if (!unclear && (!corrected || corrected === original.trim())) {
      setIssues(withoutTurnIssue);
      setEditingTurn(null);
      return;
    }
    const issue: Issue = {
      type: "transcription",
      timestamp: turnTimestamp(editingTurn),
      turn_number: turnNumber,
      transcripted: original,
      audio_said: corrected || "(audio unclear — not transcribed)",
      transcription_error_type: unclear && !corrected ? "Audio unclear" : editErrorType,
      audio_unclear: editUnclear
    };
    setIssues((existing) => [...withoutTurnIssue(existing), issue]);
    setEditingTurn(null);
  }

  function deleteTurn(index: number) {
    if (!currentCall) return;
    const turnNumber = String(index + 1);
    const issue: Issue = {
      type: "transcription",
      timestamp: turnTimestamp(index),
      turn_number: turnNumber,
      transcripted: currentCall.turns?.[index]?.text || "",
      audio_said: "(not said — turn wrongly captured)",
      transcription_error_type: DELETED_TURN_ERROR_TYPE,
      deleted_turn: "true",
      audio_unclear: "No"
    };
    setIssues((existing) => [
      ...existing.filter((i) => !(i.type === "transcription" && i.turn_number === turnNumber && i.after_turn === undefined)),
      issue
    ]);
    setEditingTurn((current) => (current === index ? null : current));
  }

  function removeIssue(issue: Issue) {
    setIssues((existing) => existing.filter((i) => i !== issue));
  }

  function insertsAt(list: Issue[], pos: number) {
    return list
      .filter((i) => i.type === "transcription" && i.after_turn === String(pos))
      .sort((a, b) => Number(a.insert_order || 1) - Number(b.insert_order || 1));
  }

  function renumberInserts(list: Issue[], pos: number) {
    return list.map((issue, index) => ({
      ...issue,
      insert_order: String(index + 1),
      turn_number: list.length > 1 ? `missing after turn ${pos} (#${index + 1})` : `missing after turn ${pos}`
    }));
  }

  // Accepts "95" (seconds), "1:35" or "01:35" and returns mm:ss; "" if unparseable.
  function normalizeClock(value: string) {
    const v = value.trim();
    if (!v) return "";
    if (/^\d+$/.test(v)) return formatTime(Number(v));
    const m = v.match(/^(\d{1,3}):(\d{1,2})$/);
    if (m) return formatTime(Number(m[1]) * 60 + Number(m[2]));
    return "";
  }

  function openInsertEditor(pos: number, slot: number, existing: Issue | null) {
    setEditingTurn(null);
    setInsertAt(pos);
    setInsertSlot(slot);
    setEditingInsert(existing);
    setInsertText(existing ? existing.audio_said.replace(/^user:\s*/, "") : "");
    setInsertUnclear(existing?.audio_unclear || "No");
    // Pin the exact moment: prefill from the issue being edited, else freeze the
    // audio where it is and start from that playhead position.
    if (existing) {
      setInsertTime(existing.timestamp || "");
    } else {
      audioRef.current?.pause();
      setInsertTime(formatTime(audioRef.current?.currentTime || 0));
    }
  }

  function closeInsertEditor() {
    setInsertAt(null);
    setInsertSlot(0);
    setEditingInsert(null);
    setInsertText("");
    setInsertTime("");
    setInsertUnclear("No");
  }

  function saveInsertTurn() {
    if (insertAt === null || !currentCall) return;
    const text = insertText.trim();
    const unclear = insertUnclear === "Yes";
    // Empty is fine when the audio is unclear (nothing to transcribe); otherwise
    // an empty box means "cancel".
    if (!text && !unclear) { closeInsertEditor(); return; }
    const pos = insertAt;
    const anchorIndex = Math.max(pos - 1, 0);
    const exactTime = normalizeClock(insertTime);
    setIssues((existing) => {
      const others = existing.filter((i) => !(i.type === "transcription" && i.after_turn === String(pos)));
      let list = insertsAt(existing, pos);
      if (editingInsert) {
        list = list.map((i) => (i === editingInsert
          ? { ...i, audio_said: `user: ${text}`, audio_unclear: insertUnclear, ...(exactTime ? { timestamp: exactTime } : {}) }
          : i));
      } else {
        const issue: Issue = {
          type: "transcription",
          timestamp: exactTime || turnTimestamp(pos === 0 ? 0 : anchorIndex),
          after_turn: String(pos),
          turn_number: `missing after turn ${pos}`,
          transcripted: "(missing from transcript)",
          audio_said: `user: ${text}`,
          transcription_error_type: unclear && !text ? "Audio unclear" : "Missing",
          audio_unclear: insertUnclear
        };
        const slot = Math.min(insertSlot, list.length);
        list = [...list.slice(0, slot), issue, ...list.slice(slot)];
      }
      return [...others, ...renumberInserts(list, pos)];
    });
    closeInsertEditor();
  }

  function removeInsert(issue: Issue) {
    const pos = Number(issue.after_turn);
    setIssues((existing) => {
      const others = existing.filter((i) => !(i.type === "transcription" && i.after_turn === issue.after_turn));
      const list = insertsAt(existing, pos).filter((i) => i !== issue);
      return [...others, ...renumberInserts(list, pos)];
    });
  }

  function updateMetricRating(metric: string, key: keyof MetricRating, value: string) {
    const missingKey = `${metric}.${key}`;
    if (value.trim()) {
      setMissingRatingFields((existing) => existing.filter((item) => (
        item !== missingKey && !(key === "rating" && value !== "1" && item === `${metric}.reason`)
      )));
    }
    setMetricRatings((existing) => ({
      ...existing,
      [metric]: {
        ...existing[metric],
        [key]: value
      }
    }));
  }

  async function submitReview() {
    if (!currentCall) {
      alert("Select a call first.");
      return;
    }
    if (submittingReview) return;
    if (currentCallSubmitted) {
      alert("This call is already submitted for your reviewer name.");
      return;
    }
    const activeRatingMetrics = modeRatingMetrics(auditMode);
    const missingRatings = activeRatingMetrics.flatMap((metric) => {
        const fields: string[] = [];
        if (!metricRatings[metric]?.rating) fields.push(`${metric}.rating`);
        if (metricRatings[metric]?.rating === "1" && !metricRatings[metric]?.reason.trim()) fields.push(`${metric}.reason`);
        return fields;
      });
    if (missingRatings.length) {
      setMissingRatingFields(missingRatings);
      alert("Please complete all call ratings. Reason is required when a rating is 1.");
      return;
    }
    if (auditMode === RESPONSE_VIBE_MODE && showVibe) {
      if (!vibeScore || !vibeReason.trim()) {
        alert("Please fill vibe score and reason before submitting.");
        return;
      }
    }
    setMissingRatingFields([]);
    const durationTaken = startedAt ? Math.floor((Date.now() - Date.parse(startedAt)) / 1000) : 0;
    const flagIssues = flagCall === true
      ? [{ type: "flag_for_review", timestamp: "", notes: flagReason.trim() || "Flagged for further discussion" }]
      : [];
    const ratingIssues = activeRatingMetrics.length
      ? activeRatingMetrics
          .filter((metric) => metricRatings[metric]?.rating || metricRatings[metric]?.reason)
          .map((metric) => ({
            type: "metric_rating",
            metric,
            metric_label: issueLabels[metric],
            rating: metricRatings[metric]?.rating || "",
            reason: metricRatings[metric]?.reason || ""
          }))
      : [];
    setSubmittingReview(true);
    try {
      const result = await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          call_id: currentCall.execution_id,
          reviewer_name: reviewerDisplay,
          reviewer_email: reviewerEmail,
          review_mode: auditMode,
          vibe_score: auditMode === RESPONSE_VIBE_MODE ? vibeScore : "",
          flow_score: "",
          llm_rating: "",
          llm_error_type: "",
          notes: auditMode === RESPONSE_VIBE_MODE ? vibeReason : notes,
          issues: [...issues, ...ratingIssues, ...flagIssues],
          started_at: startedAt,
          duration_taken_sec: durationTaken
        })
      });
      setSubmittedCallId(currentQueueId);
      setCalls((existing) => existing.map((call) => (
        rowKey(call) === currentQueueId
          ? { ...call, reviewed: true, reviewer_name: reviewerDisplay }
          : call
      )));
      setCurrentCall((existing) => existing ? { ...existing, reviewed: true, reviewer_name: reviewerDisplay } : existing);
      setStatusMessage(result.sheets_sync?.ok ? "Submitted and synced to Sheets." : "Submitted locally. Sheets sync pending.");
      setQueueView("pending");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function syncSheets() {
    try {
      const result = await api("/api/sync-sheets", { method: "POST", body: JSON.stringify({ audit_mode: auditMode }) });
      alert(`Synced ${result.synced_reviews} ${modeLabel(auditMode).toLowerCase()} review(s) to Google Sheets.`);
    } catch (error) {
      alert(`Sheets sync not complete: ${(error as Error).message}`);
    }
  }


  return (
    <>
      {loginVisible && (
        <section className="login-screen">
          <form className="login-card" onSubmit={loginStep === "email" ? requestOtp : verifyOtp}>
            <div>
              <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 600, fontSize: 15, color: "var(--accent)", marginBottom: 6 }}>realloop</div>
              <h1>Call Audit</h1>
              <p>
                {loginStep === "email"
                  ? "Sign in with your email and the 6-digit code you were given."
                  : `Enter the 6-digit code for ${loginEmail.trim().toLowerCase()}.`}
              </p>
            </div>
            {loginStep === "email" ? (
              <label>
                Email
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => { setLoginEmail(event.target.value); setLoginError(""); }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </label>
            ) : (
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => { setOtpCode(event.target.value.replace(/\D/g, "")); setLoginError(""); }}
                  placeholder="6-digit code"
                  autoFocus
                  required
                />
              </label>
            )}
            {loginError && <p className="validation-message">{loginError}</p>}
            <button className="primary" type="submit" disabled={loggingIn}>
              {loggingIn ? "Please wait..." : loginStep === "email" ? "Send code" : "Verify & start reviewing"}
            </button>
            {loginStep === "code" && (
              <button
                className="ghost"
                type="button"
                disabled={loggingIn}
                onClick={(event) => { setLoginStep("email"); setLoginError(""); }}
              >
                Use a different email / resend code
              </button>
            )}
          </form>
        </section>
      )}

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div>
              <h1>Call Audit</h1>
              <p>{reviewerEmail ? `${reviewerDisplay} · ${modeLabel(auditMode)}` : "Internal review cockpit"}</p>
            </div>
            <div className="brand-actions">
              <button className="ghost" onClick={logout}>Switch</button>
            </div>
          </div>
          <div className="single-mode-pill sidebar-mode">Combined audit</div>
          {/* Sheet import is retired: calls are loaded directly into Supabase;
              the sheet only receives review syncs (one-way, DB -> sheet). */}

          {hasIssueQueue && (
            <div className="queue-tabs" role="tablist" aria-label="Assignment type" style={{ marginBottom: 6 }}>
              <button
                type="button"
                className={assignView === "vibe" ? "active" : ""}
                onClick={() => { setAssignView("vibe"); setQueueView("pending"); }}
              >
                Vibe score <span>{calls.filter((c) => !isIssueAssignment(c.queue_id)).length}</span>
              </button>
              <button
                type="button"
                className={assignView === "issues" ? "active" : ""}
                onClick={() => { setAssignView("issues"); setQueueView("pending"); }}
              >
                Issue logging <span>{calls.filter((c) => isIssueAssignment(c.queue_id)).length}</span>
              </button>
            </div>
          )}
          <div className="queue-tabs" role="tablist" aria-label="Review queue status">
            <button
              type="button"
              className={queueView === "pending" ? "active" : ""}
              onClick={() => setQueueView("pending")}
            >
              Pending <span>{pendingCount}</span>
            </button>
            <button
              type="button"
              className={queueView === "submitted" ? "active" : ""}
              onClick={() => setQueueView("submitted")}
            >
              Submitted <span>{reviewedCount}</span>
            </button>
          </div>
          <div className="queue-stats">{pendingCount} pending · {reviewedCount} submitted · {tabCalls.length} assigned{hasIssueQueue ? (assignView === "issues" ? " · issue logging" : " · vibe") : ""}</div>
          <nav className="call-list">
            {filteredCalls.map((call) => (
              <button key={rowKey(call)} className={`call-card ${call.reviewed ? "reviewed submitted" : ""} ${currentQueueId === rowKey(call) ? "active" : ""}`} onClick={() => selectCall(call.execution_id, rowKey(call))}>
                <span className="call-id">
                  ID {shortCallId(call.execution_id)}
                  {isPriority(call) && <span style={{ marginLeft: 6, color: "#b7791f", fontWeight: 700 }}>★ priority</span>}
                </span>
                <strong>{call.agent_name || "Unknown agent"}</strong>
                <span>{call.org_name || ""} · {formatTime(Number(call.duration_sec || 0))} · {call.language || ""}</span>
                <span>{call.reviewed ? "Submitted by you" : "Open"} · {call.created_at_ist || ""}</span>
              </button>
            ))}
            {!filteredCalls.length && (
              <div className="queue-empty">
                {queueView === "pending" ? "No pending calls. Nice, this queue is clear." : "No submitted calls yet."}
              </div>
            )}
          </nav>
        </aside>

        <main className="workspace">
          <section className="audio-bar">
            <div className="call-heading">
              <span>{currentCall?.org_name || "No call selected"}</span>
              <strong>{currentCall?.agent_name || "Select a call to start"}</strong>
              <span>{currentCall ? `Call ID ${currentCall.execution_id}` : ""}</span>
            </div>
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              src={currentCall?.recording_url || ""}
              onTimeUpdate={() => {
                const t = audioRef.current?.currentTime || 0;
                setCurrentTime(formatTime(t));
                setPlayheadSec(t);
              }}
            />
            {waveform && (
              <canvas
                ref={waveCanvasRef}
                className="waveform"
                width={1400}
                height={96}
                style={{ width: "100%", height: 48, cursor: "pointer", display: "block", borderRadius: 8, background: "#f2f5f4" }}
                onClick={(event) => {
                  if (!audioRef.current || !waveform) return;
                  const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
                  const frac = (event.clientX - rect.left) / rect.width;
                  audioRef.current.currentTime = frac * waveform.duration;
                }}
              />
            )}
            <div className="audio-actions">
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5); }}>-5s</button>
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime += 5; }}>+5s</button>
              {showIssues && visibleIssueTypes.length > 0 && (
                <>
                  <label className="capture-select">
                    Issue
                    <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
                      {visibleIssueTypes.map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
                    </select>
                  </label>
                  <button className="primary" onClick={captureTimestamp}>Capture {currentTime}</button>
                  <span className="captured">Captured: {capturedTime}</span>
                </>
              )}
            </div>
          </section>

          <section className="content-grid">
            <aside className="audit-panel">
              <div className="panel-title">
                <h2>Review</h2>
                <button className="ghost" onClick={() => {
                  const next = filteredCalls.find((call) => !call.reviewed && rowKey(call) !== currentQueueId);
                  if (next) selectCall(next.execution_id, rowKey(next));
                }}>Next</button>
              </div>

              {showIssues && visibleIssueTypes.length > 0 && (
                <>
                  {visibleIssueTypes.length > 1 && (
                    <div className="quick-flags">
                      {visibleIssueTypes.map((type) => (
                        <button
                          key={type}
                          className={issueType === type ? "selected" : ""}
                          onClick={() => setIssueType(type)}
                        >
                          {issueLabels[type]}
                        </button>
                      ))}
                    </div>
                  )}

                  <form className="issue-form issue-form-active" onSubmit={addIssue} noValidate>
                    <div className="form-row">
                      <label>
                        Issue type
                        <select value={issueType} onChange={(event) => {
                          setIssueType(event.target.value);
                          setMissingIssueFields([]);
                        }}>
                          {visibleIssueTypes.map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
                        </select>
                      </label>
                      <label>
                        Timestamp
                        <input name="timestamp" defaultValue={capturedTime} key={capturedTime} />
                      </label>
                    </div>

                    <div className="dynamic-fields">
                      {(issueConfigs[issueType] || []).map(([name, label, kind, options]) => {
                        const required = (requiredIssueFields[issueType] || []).includes(name);
                        const missing = missingIssueFields.includes(name);
                        return (
                        <React.Fragment key={name}>
                        <label className={missing ? "field-missing" : ""}>
                          {label}
                          {kind === "select" ? (
                            name === "response_error_type" && issueType === "response_appropriateness" ? (
                              <select
                                name={name}
                                required={required}
                                value={respErrorType}
                                onChange={(event) => { setRespErrorType(event.target.value); setMissingIssueFields([]); }}
                              >
                                <option value="">Select {label.toLowerCase()}</option>
                                {(options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            ) : (
                              <select name={name} required={required} defaultValue={required ? "" : options?.[0]}>
                                {required && <option value="">Select {label.toLowerCase()}</option>}
                                {(options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            )
                          ) : (
                            <input name={name} required={required} />
                          )}
                        </label>
                        {name === "response_error_type" && issueType === "response_appropriateness" && RESPONSE_ERROR_SUBTYPES[respErrorType] && (
                          <label className={missingIssueFields.includes("response_error_subtype") ? "field-missing" : ""}>
                            {respErrorType} — which kind?
                            <select name="response_error_subtype" defaultValue="" key={respErrorType}>
                              <option value="">Select</option>
                              {RESPONSE_ERROR_SUBTYPES[respErrorType].map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </label>
                        )}
                        </React.Fragment>
                        );
                      })}
                    </div>

                    {missingIssueFields.length > 0 && <p className="validation-message">Fill the highlighted required field before adding the issue.</p>}
                    <button className="primary" type="submit">Add Issue</button>
                  </form>

                  <section className="issue-list-wrap">
                    <div className="panel-title small">
                      <h3>Logged issues</h3>
                      <span>{issues.length}</span>
                    </div>
                    <div className={`issue-list ${issues.length ? "" : "empty-state"}`}>
                      {issues.length ? issues.map((issue, index) => (
                        <div className="issue-item" key={`${issue.type}-${issue.timestamp}-${index}`}>
                          <header><span>{issueLabels[issue.type] || issue.type} · {issue.timestamp}</span></header>
                          <p>{Object.entries(issue).filter(([key]) => !["type", "timestamp"].includes(key)).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`).join(" · ")}</p>
                          <button type="button" onClick={() => removeIssue(issue)}>Remove</button>
                        </div>
                      )) : "No issues yet."}
                    </div>
                  </section>
                </>
              )}

              {showVibe && auditMode === RESPONSE_VIBE_MODE && (
                <section className="vibe-calibration">
                  <div className="panel-title small">
                    <h3>Overall vibe score</h3>
                    <span>1-4</span>
                  </div>
                  <p className="helper-copy">
                    Give one overall rating for the call, then add a short remark explaining what drove the score.
                  </p>
                  <div className={`rating-card vibe-card ${!vibeScore || !vibeReason.trim() ? "missing" : ""}`}>
                    <div className={`vibe-buttons ${!vibeScore ? "field-missing" : ""}`} style={{ display: "flex", gap: 8 }}>
                      {[["1", "Major failure"], ["2", "Noticeably broken"], ["3", "Mostly okay"], ["4", "Clean call"]].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVibeScore(value)}
                          style={{
                            flex: 1,
                            padding: "12px 4px",
                            borderRadius: 10,
                            border: vibeScore === value ? "2px solid #1f7a5c" : "1px solid #d5ddda",
                            background: vibeScore === value ? "#1f7a5c" : "#fff",
                            color: vibeScore === value ? "#fff" : "#2b3a35",
                            cursor: "pointer",
                            textAlign: "center"
                          }}
                        >
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
                          <div style={{ fontSize: 11 }}>{label}</div>
                        </button>
                      ))}
                    </div>
                    <label className={!vibeReason.trim() ? "field-missing" : ""}>
                      Remark
                      <textarea
                        value={vibeReason}
                        onChange={(event) => setVibeReason(event.target.value)}
                        rows={3}
                        placeholder="One line: what drove this score?"
                      />
                    </label>
                  </div>
                </section>
              )}

              {auditMode !== RESPONSE_VIBE_MODE && (
                <label className="notes-field">
                  Notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Only capture what helps Bolna act." />
                </label>
              )}

              {modeRatingMetrics(auditMode).length > 0 && (
                <section className="metric-ratings">
                  <div className="panel-title small">
                    <h3>Call ratings</h3>
                    <span>1-4</span>
                  </div>
                  {modeRatingMetrics(auditMode).map((metric) => (
                    <div className={`rating-card ${issueType === metric ? "selected" : ""} ${missingRatingFields.some((field) => field.startsWith(`${metric}.`)) ? "missing" : ""}`} key={metric}>
                      <label className={missingRatingFields.includes(`${metric}.rating`) ? "field-missing" : ""}>
                        {issueLabels[metric]}
                        <select
                          value={metricRatings[metric]?.rating || ""}
                          onChange={(event) => updateMetricRating(metric, "rating", event.target.value)}
                        >
                          <option value="">Not rated</option>
                          <option value="1">1 - Major issue</option>
                          <option value="2">2 - Noticeable issue</option>
                          <option value="3">3 - Minor issue</option>
                          <option value="4">4 - Good</option>
                        </select>
                      </label>
                      <label className={missingRatingFields.includes(`${metric}.reason`) ? "field-missing" : ""}>
                        Reason
                        <textarea
                          value={metricRatings[metric]?.reason || ""}
                          onChange={(event) => updateMetricRating(metric, "reason", event.target.value)}
                          rows={2}
                          placeholder={`Why this ${issueLabels[metric].toLowerCase()} rating?`}
                        />
                      </label>
                    </div>
                  ))}
                </section>
              )}

              <section className="rating-card" style={{ borderColor: flagCall === true ? "#b7791f" : undefined, background: flagCall === true ? "#fffaf0" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>Flag this call for further discussion? <span style={{ color: "#647084", fontWeight: 500 }}>(optional)</span></strong>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={flagCall === false ? "primary" : ""}
                      style={{ minWidth: 64 }}
                      onClick={() => { setFlagCall(flagCall === false ? null : false); setFlagReason(""); }}
                    >No</button>
                    <button
                      type="button"
                      className=""
                      style={flagCall === true ? { minWidth: 64, background: "#b7791f", borderColor: "#b7791f", color: "#fff" } : { minWidth: 64 }}
                      onClick={() => setFlagCall(flagCall === true ? null : true)}
                    >Yes</button>
                  </div>
                </div>
                {flagCall === true && (
                  <label style={{ marginTop: 8 }}>
                    What's the doubt? (optional)
                    <textarea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} rows={2} placeholder="e.g. can't decide between 2 and 3 — user audio unclear" />
                  </label>
                )}
              </section>

              <div className="submit-row">
                <a className="ghost export" href={`/api/reviews.csv?mode=${encodeURIComponent(auditMode)}&reviewer=${encodeURIComponent(reviewerEmail)}`}>Download my reviews</a>
                <button className="ghost" type="button" onClick={syncSheets}>Sync Sheets</button>
                <button className="primary" type="button" onClick={submitReview} disabled={submittingReview || currentCallSubmitted}>
                  {submittingReview ? "Submitting..." : currentCallSubmitted ? "Submitted" : "Submit Review"}
                </button>
              </div>
              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </aside>

            <article className="transcript-panel">
              <div className="panel-title">
                <h2>Transcript</h2>
                <span>
                  {currentCall?.turns?.length || 0} turns · click a turn to jump
                  {turnTimes ? " (exact)" : " (approx)"}
                </span>
              </div>
              {showTranscription && currentCall && (
                <p className="helper-copy" style={{ marginTop: 0 }}>
                  Fix transcription here: <strong>✎</strong> correct a user turn, <strong>🗑</strong> delete a
                  wrongly captured turn, <strong>＋ add missing speech</strong> between turns. Each correction
                  lets you mark the audio <em>clear / not clear</em> and carries its timestamp.
                </p>
              )}
              <div className={`transcript ${currentCall ? "" : "empty-state"}`}>
                {currentCall?.turns?.length ? (() => {
                  const duration = Number(currentCall.duration_sec || 0);
                  const turnWordCounts = currentCall.turns.map((turn) => wordCount(turn.text));
                  const totalWords = turnWordCounts.reduce((sum, count) => sum + count, 0) || currentCall.turns.length;
                  let cumulativeWords = 0;
                  const editByTurn = new Map(issues.filter((i) => i.type === "transcription" && i.after_turn === undefined).map((i) => [Number(i.turn_number) - 1, i]));
                  const insertsByPos = new Map<number, Issue[]>();
                  issues.filter((i) => i.type === "transcription" && i.after_turn !== undefined).forEach((i) => {
                    const pos = Number(i.after_turn);
                    insertsByPos.set(pos, [...(insertsByPos.get(pos) || []), i]);
                  });
                  insertsByPos.forEach((list) => list.sort((a, b) => Number(a.insert_order || 1) - Number(b.insert_order || 1)));

                  const insertUi = (pos: number) => {
                    if (!showTranscription) return null;
                    const inserts = insertsByPos.get(pos) || [];
                    const editorOpenHere = insertAt === pos;

                    const editorBox = (key: string) => (
                      <div key={key} style={{ border: "1px dashed #1f7a5c", borderRadius: 8, padding: 10, margin: "6px 0", background: "#f2faf7" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 12 }}>Missing user speech</strong>
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
                            <label style={{ fontSize: 12, color: "#2b3a35" }}>at</label>
                            <input
                              value={insertTime}
                              onChange={(e) => setInsertTime(e.target.value)}
                              placeholder="mm:ss"
                              style={{ width: 64, fontSize: 13, padding: "3px 6px", textAlign: "center" }}
                            />
                            <button
                              type="button"
                              className="ghost"
                              style={{ fontSize: 12 }}
                              title="Pause the audio at the missing speech, then press this"
                              onClick={() => { audioRef.current?.pause(); setInsertTime(formatTime(audioRef.current?.currentTime || 0)); }}
                            >⏸ use audio position</button>
                          </span>
                        </div>
                        <textarea autoFocus value={insertText} onChange={(e) => setInsertText(e.target.value)} rows={2} placeholder={insertUnclear === "Yes" ? "Optional — leave blank if you can't make it out" : "What was said in the audio but missing from the transcript"} style={{ width: "100%" }} />
                        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div style={{ fontSize: 12, color: "#5b6b64", display: "flex", flexDirection: "column", gap: 4 }}>
                            Was the audio clear?
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className={insertUnclear === "No" ? "primary" : "ghost"} style={{ fontSize: 13, minWidth: 52 }} onClick={() => setInsertUnclear("No")}>Yes</button>
                              <button type="button" className="ghost" style={insertUnclear === "Yes" ? { fontSize: 13, minWidth: 52, background: "#b7791f", borderColor: "#b7791f", color: "#fff" } : { fontSize: 13, minWidth: 52 }} onClick={() => setInsertUnclear("Yes")}>No</button>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                            <button className="primary" type="button" onClick={saveInsertTurn}>Save missing turn</button>
                            <button className="ghost" type="button" onClick={closeInsertEditor}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    );

                    const addButton = (slot: number, key: string) => (
                      <div key={key} style={{ textAlign: "center", margin: "-2px 0" }}>
                        <button
                          type="button"
                          className="add-missing-btn"
                          onClick={() => openInsertEditor(pos, slot, null)}
                          title="Pause at the missing speech, then add what was said"
                          style={{ border: "none", background: "transparent", color: "#9ab0a8", cursor: "pointer", fontSize: 12, padding: "0 6px", lineHeight: "16px" }}
                        >＋ add missing speech</button>
                      </div>
                    );

                    if (!inserts.length) {
                      return editorOpenHere ? editorBox(`ins-${pos}`) : addButton(0, `ins-${pos}`);
                    }

                    const parts: React.ReactNode[] = [];
                    inserts.forEach((insert, slot) => {
                      // add-slot before this inserted turn (shows the editor when adding here)
                      if (editorOpenHere && !editingInsert && insertSlot === slot) parts.push(editorBox(`ins-${pos}-editor`));
                      else parts.push(addButton(slot, `ins-${pos}-add-${slot}`));
                      if (editorOpenHere && editingInsert === insert) {
                        parts.push(editorBox(`ins-${pos}-editor`));
                      } else {
                        parts.push(
                          <div key={`ins-${pos}-${slot}`} style={{ border: "1px dashed #b7791f", borderRadius: 8, padding: 8, margin: "6px 0", background: "#fffaf0", fontSize: 13 }}>
                            <strong>＋ missing (added by you){insert.timestamp ? ` @ ${insert.timestamp}` : ""}{insert.audio_unclear === "Yes" ? " · audio unclear" : ""}:</strong> {insert.audio_said.replace(/^user:\s*/, "").trim() || "(audio unclear — not transcribed)"}
                            <button type="button" className="ghost" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => openInsertEditor(pos, slot, insert)}>Edit</button>
                            <button type="button" className="ghost" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => removeInsert(insert)}>Remove</button>
                          </div>
                        );
                      }
                    });
                    // add-slot after the last inserted turn
                    if (editorOpenHere && !editingInsert && insertSlot >= inserts.length) parts.push(editorBox(`ins-${pos}-editor`));
                    else parts.push(addButton(inserts.length, `ins-${pos}-add-end`));

                    return <React.Fragment key={`ins-${pos}`}>{parts}</React.Fragment>;
                  };

                  const nodes: React.ReactNode[] = [insertUi(0)];
                  currentCall.turns.forEach((turn, index) => {
                    const estimate = Math.floor((cumulativeWords / totalWords) * duration);
                    cumulativeWords += turnWordCounts[index] || 1;
                    const exact = turnTimes?.[index];
                    const jumpTime = exact !== undefined ? exact : estimate;
                    const edit = editByTurn.get(index);

                    if (editingTurn === index) {
                      nodes.push(
                        <div className={`turn ${turn.role}`} key={`e-${index}`} style={{ border: "1px solid #1f7a5c", background: "#f2faf7" }}>
                          <div className="turn-role">
                            <span>{index + 1}. {turn.role} — correcting</span>
                            <span className="turn-time">{exact !== undefined ? formatTime(exact) : `~${formatTime(estimate)}`}</span>
                          </div>
                          {/* single wrapper so the .turn grid treats the editor as one content cell */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} style={{ width: "100%" }} placeholder={editUnclear === "Yes" ? "Optional — leave blank if you can't make it out" : "Corrected transcript for this turn"} />
                            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                              <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                                <label style={{ fontSize: 12, color: "#5b6b64", display: "flex", flexDirection: "column", gap: 4 }}>
                                  Transcription error
                                  <select value={editErrorType} onChange={(e) => setEditErrorType(e.target.value)} style={{ fontSize: 13, padding: "6px 8px", width: "100%", maxWidth: 340 }}>
                                    {CORRECTION_ERROR_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </label>
                                <div style={{ fontSize: 12, color: "#5b6b64", display: "flex", flexDirection: "column", gap: 4 }}>
                                  Was the audio clear?
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button type="button" className={editUnclear === "No" ? "primary" : "ghost"} style={{ fontSize: 13, minWidth: 52 }} onClick={() => setEditUnclear("No")}>Yes</button>
                                    <button type="button" className="ghost" style={editUnclear === "Yes" ? { fontSize: 13, minWidth: 52, background: "#b7791f", borderColor: "#b7791f", color: "#fff" } : { fontSize: 13, minWidth: 52 }} onClick={() => setEditUnclear("Yes")}>No</button>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                                <button className="primary" type="button" onClick={saveEditTurn}>Save correction</button>
                                <button className="ghost" type="button" onClick={() => setEditingTurn(null)}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const deleted = edit?.deleted_turn === "true";
                      nodes.push(
                        <div
                          className={`turn ${turn.role}`}
                          key={`${turn.role}-${index}`}
                          style={deleted
                            ? { background: "#fff5f5", borderLeft: "3px solid #c53030", opacity: 0.75 }
                            : edit ? { background: "#fffaf0", borderLeft: "3px solid #b7791f" } : undefined}
                          onClick={() => { if (audioRef.current) audioRef.current.currentTime = jumpTime; }}
                        >
                          <div className="turn-role">
                            <span>{index + 1}. {turn.role}{deleted ? " · deleted" : edit ? " · corrected" : ""}</span>
                            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span className="turn-time">{exact !== undefined ? formatTime(exact) : `~${formatTime(estimate)}`}</span>
                              {showTranscription && turn.role === "user" && !deleted && (
                                <>
                                  <button
                                    type="button"
                                    className="turn-edit-btn"
                                    title="Correct this turn's transcription"
                                    onClick={(e) => { e.stopPropagation(); startEditTurn(index); }}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, padding: 0 }}
                                  >✎</button>
                                  <button
                                    type="button"
                                    className="turn-delete-btn"
                                    title="Delete this turn — wrongly captured, nothing was said"
                                    onClick={(e) => { e.stopPropagation(); deleteTurn(index); }}
                                    style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14, padding: 0 }}
                                  >🗑</button>
                                </>
                              )}
                            </span>
                          </div>
                          {deleted && edit ? (
                            <div>
                              <div style={{ textDecoration: "line-through", color: "#c53030" }}>{turn.text}</div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                                <span style={{ fontSize: 12, fontStyle: "italic", color: "#c53030" }}>Deleted — wrongly captured</span>
                                <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); removeIssue(edit); }}>Undo delete</button>
                              </div>
                            </div>
                          ) : edit ? (
                            <div>
                              <div style={{ textDecoration: "line-through", color: "#b0784a" }}>{turn.text}</div>
                              <div>{edit.audio_said}{edit.audio_unclear === "Yes" ? <span style={{ color: "#b7791f", fontSize: 12 }}> · audio unclear</span> : null}</div>
                              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); startEditTurn(index); }}>Edit correction</button>
                                <button type="button" className="ghost" style={{ fontSize: 12 }} onClick={(e) => { e.stopPropagation(); removeIssue(edit); }}>Undo correction</button>
                              </div>
                            </div>
                          ) : (
                            <div>{turn.text}</div>
                          )}
                        </div>
                      );
                    }
                    nodes.push(insertUi(index + 1));
                  });
                  return nodes;
                })() : "Select a call from the queue."}
              </div>
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
