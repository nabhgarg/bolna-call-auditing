"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
};

type Issue = Record<string, string>;
type MetricRating = { rating: string; reason: string };
type AuditMode = "pronunciation_tone" | "timing_transcription" | "response_vibe";
const RESPONSE_VIBE_MODE: AuditMode = "response_vibe";
const combinedIssueTypes = ["transcription", "response_appropriateness", "pronunciation"];
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
  overall: "Overall"
};

const issueConfigs: Record<string, Array<[string, string, "text" | "select", string[]?]>> = {
  pronunciation: [
    ["content_tag", "Content tag", "select", ["General", "City", "Proper Noun"]],
    ["word_heard", "Word mispronounced", "text"]
  ],
  response_appropriateness: [
    ["response_error_type", "Type of error", "select", ["Irrelevant response", "Agent repeating same thing / stuck in loop", "Context not carried through", "Language switch", "Others"]],
    ["error_explanation", "Explain the error", "text"]
  ],
  transcription: [
    ["transcription_error_type", "Type of transcription error", "select", ["Wrong Transcription same language", "Wrong Transcription different language", "Missing"]],
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

function modeIssueTypes(_mode: AuditMode) {
  return combinedIssueTypes;
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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginVisible, setLoginVisible] = useState(true);
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [otpCode, setOtpCode] = useState("");
  const [auditMode, setAuditMode] = useState<AuditMode>(RESPONSE_VIBE_MODE);
  const [queueView, setQueueView] = useState<"pending" | "submitted">("pending");
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [waveform, setWaveform] = useState<{ peaks: number[][]; duration: number } | null>(null);
  const [turnTimes, setTurnTimes] = useState<Record<number, number> | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [transcriptionTurn, setTranscriptionTurn] = useState("");
  const [audioSaid, setAudioSaid] = useState("");
  const [currentTime, setCurrentTime] = useState("00:00");
  const [capturedTime, setCapturedTime] = useState("00:00");
  const [issueType, setIssueType] = useState(combinedIssueTypes[0]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metricRatings, setMetricRatings] = useState<Record<string, MetricRating>>(emptyMetricRatings);
  const [vibeScore, setVibeScore] = useState("");
  const [vibeReason, setVibeReason] = useState("");
  const [missingIssueFields, setMissingIssueFields] = useState<string[]>([]);
  const [missingRatingFields, setMissingRatingFields] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importingCalls, setImportingCalls] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittedCallId, setSubmittedCallId] = useState("");

  useEffect(() => {
    const storedEmail = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
    const storedDisplay = window.localStorage.getItem("auditReviewerDisplay") || "";
    const initialMode = RESPONSE_VIBE_MODE;
    setLoginEmail(storedEmail);
    setAuditMode(initialMode);
    setIssueType(modeIssueTypes(initialMode)[0] || "");
    if (storedEmail) {
      setReviewerEmail(storedEmail);
      setReviewerDisplay(storedDisplay || storedEmail);
      setLoginVisible(false);
      loadCalls(storedEmail, initialMode);
    }
  }, []);

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

  const filteredCalls = useMemo(() => {
    return calls
      .filter((call) => {
        if (queueView === "pending" && call.reviewed) return false;
        if (queueView === "submitted" && !call.reviewed) return false;
        return true;
      })
      .sort((a, b) => a.execution_id.localeCompare(b.execution_id));
  }, [calls, queueView]);
  const reviewedCount = calls.filter((call) => call.reviewed).length;
  const pendingCount = calls.length - reviewedCount;
  const currentCallSummary = currentCall
    ? calls.find((call) => (call.queue_id || call.execution_id) === currentQueueId) || null
    : null;
  const currentCallSubmitted = Boolean(currentCallSummary?.reviewed || (currentCall && submittedCallId === currentQueueId));

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
    setTranscriptionTurn("");
    setAudioSaid("");
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
      const talk = (ss: Array<[number, number]>) => ss.reduce((a, s) => a + (s[1] - s[0]), 0);
      const agentFirst = talk(seg0) >= talk(seg1);

      // one chronological list of speech segments with speaker labels
      type Seg = { start: number; end: number; role: string };
      const allSegs: Seg[] = [
        ...(agentFirst ? seg0 : seg1).map(([s, e]) => ({ start: s, end: e, role: "assistant" })),
        ...(agentFirst ? seg1 : seg0).map(([s, e]) => ({ start: s, end: e, role: "user" }))
      ].sort((a, b) => a.start - b.start);

      // DP sequence alignment: turns (by role) vs segments (by speaker).
      // Moves: match turn↔segment, extend a turn across another same-role segment,
      // skip a noise segment, or skip an unalignable turn.
      const roles = call.turns.map((t) => (t.role === "assistant" ? "assistant" : "user"));
      const T = roles.length, S = allSegs.length;
      const SKIP_SEG = 0.6, SKIP_TURN = 1.0;
      const INF = 1e9;
      const dp: number[][] = Array.from({ length: T + 1 }, () => Array(S + 1).fill(INF));
      const back: number[][] = Array.from({ length: T + 1 }, () => Array(S + 1).fill(0)); // 1=match,2=extend,3=skipSeg,4=skipTurn
      dp[0][0] = 0;
      for (let i = 0; i <= T; i++) {
        for (let j = 0; j <= S; j++) {
          const cur = dp[i][j];
          if (cur >= INF) continue;
          if (i < T && j < S && roles[i] === allSegs[j].role && cur < dp[i + 1][j + 1]) {
            dp[i + 1][j + 1] = cur; back[i + 1][j + 1] = 1;
          }
          if (i > 0 && j < S && roles[i - 1] === allSegs[j].role && cur < dp[i][j + 1]) {
            dp[i][j + 1] = cur; back[i][j + 1] = 2;
          }
          if (j < S && cur + SKIP_SEG < dp[i][j + 1] ) {
            if (back[i][j + 1] !== 2 || cur + SKIP_SEG < dp[i][j + 1]) {
              dp[i][j + 1] = cur + SKIP_SEG; back[i][j + 1] = 3;
            }
          }
          if (i < T && cur + SKIP_TURN < dp[i + 1][j]) {
            dp[i + 1][j] = cur + SKIP_TURN; back[i + 1][j] = 4;
          }
        }
      }
      // backtrack: record the FIRST segment matched to each turn
      const times: Record<number, number> = {};
      let bi = T, bj = S;
      while (bi > 0 || bj > 0) {
        const move = back[bi][bj];
        if (move === 1) { times[bi - 1] = allSegs[bj - 1].start; bi -= 1; bj -= 1; }
        else if (move === 2 || move === 3) { bj -= 1; }
        else if (move === 4) { bi -= 1; }
        else break;
      }

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
        setLoginVisible(false);
        window.localStorage.setItem("auditReviewerEmail", result.email);
        window.localStorage.setItem("auditReviewerDisplay", result.display_name || result.email);
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
      setLoginVisible(false);
      window.localStorage.setItem("auditReviewerEmail", profile.email);
      window.localStorage.setItem("auditReviewerDisplay", profile.display_name || profile.email);
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
    if (issueType === "transcription") {
      const turnIndex = Number(transcriptionTurn);
      const turn = Number.isInteger(turnIndex) ? currentCall.turns?.[turnIndex] : undefined;
      if (!turn) {
        setMissingIssueFields(["turn"]);
        return;
      }
      issue.turn_number = String(turnIndex + 1);
      issue.transcripted = turn.text;
      issue.audio_said = audioSaid;
      if (!audioSaid.trim()) {
        setMissingIssueFields(["audio_said"]);
        return;
      }
    }
    const missing = (requiredIssueFields[issueType] || []).filter((field) => !String(issue[field] || "").trim());
    if (missing.length) {
      setMissingIssueFields(missing);
      return;
    }
    setMissingIssueFields([]);
    setIssues((existing) => [...existing, issue]);
    if (issueType === "transcription") {
      setTranscriptionTurn("");
      setAudioSaid("");
    }
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
    if (auditMode === RESPONSE_VIBE_MODE) {
      if (!vibeScore || !vibeReason.trim()) {
        alert("Please fill vibe score and reason before submitting.");
        return;
      }
    }
    setMissingRatingFields([]);
    const durationTaken = startedAt ? Math.floor((Date.now() - Date.parse(startedAt)) / 1000) : 0;
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
          issues: [...issues, ...ratingIssues],
          started_at: startedAt,
          duration_taken_sec: durationTaken
        })
      });
      setSubmittedCallId(currentQueueId);
      setCalls((existing) => existing.map((call) => (
        (call.queue_id || call.execution_id) === currentQueueId
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

  async function importSheets() {
    if (importingCalls) return;
    try {
      setImportingCalls(true);
      setImportStatus(`Importing ${modeLabel(auditMode).toLowerCase()} calls from Google Sheets...`);
      const result = await api("/api/import-sheets", { method: "POST", body: JSON.stringify({ audit_mode: auditMode }) });
      await loadCalls(reviewerEmail, auditMode);
      setImportStatus(`Imported ${result.imported} ${modeLabel(auditMode).toLowerCase()} call(s) from ${result.sheet_name || "Google Sheets"}.`);
      setStatusMessage(`Imported ${result.imported} ${modeLabel(auditMode).toLowerCase()} call(s).`);
    } catch (error) {
      setImportStatus(`Sheet import failed: ${(error as Error).message}`);
      setStatusMessage(`Sheet import failed: ${(error as Error).message}`);
    } finally {
      setImportingCalls(false);
    }
  }

  return (
    <>
      {loginVisible && (
        <section className="login-screen">
          <form className="login-card" onSubmit={loginStep === "email" ? requestOtp : verifyOtp}>
            <div>
              <h1>Call Audit</h1>
              <p>
                {loginStep === "email"
                  ? "Sign in with your email — we'll send you a one-time code."
                  : `Enter the 6-digit code sent to ${loginEmail.trim().toLowerCase()}.`}
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
          <div className="import-actions">
            <button className="ghost" onClick={importSheets} disabled={importingCalls}>
              {importingCalls ? "Importing..." : "Import calls"}
            </button>
          </div>
          {importStatus && <div className="import-status">{importStatus}</div>}

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
          <div className="queue-stats">{pendingCount} pending · {reviewedCount} submitted · {calls.length} assigned</div>
          <nav className="call-list">
            {filteredCalls.map((call) => (
              <button key={call.queue_id || call.execution_id} className={`call-card ${call.reviewed ? "reviewed submitted" : ""} ${(currentQueueId || currentCall?.execution_id) === (call.queue_id || call.execution_id) ? "active" : ""}`} onClick={() => selectCall(call.execution_id, call.queue_id || call.execution_id)}>
                <span className="call-id">ID {shortCallId(call.execution_id)}</span>
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
              {modeIssueTypes(auditMode).length > 0 && (
                <>
                  <label className="capture-select">
                    Issue
                    <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
                      {modeIssueTypes(auditMode).map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
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
                  const next = filteredCalls.find((call) => !call.reviewed && (call.queue_id || call.execution_id) !== currentQueueId);
                  if (next) selectCall(next.execution_id, next.queue_id || next.execution_id);
                }}>Next</button>
              </div>

              {modeIssueTypes(auditMode).length > 0 && (
                <>
                  <div className="quick-flags">
                    {modeIssueTypes(auditMode).map((type) => (
                      <button
                        key={type}
                        className={issueType === type ? "selected" : ""}
                        onClick={() => setIssueType(type)}
                      >
                        {issueLabels[type]}
                      </button>
                    ))}
                  </div>

                  <form className="issue-form issue-form-active" onSubmit={addIssue} noValidate>
                    <div className="form-row">
                      <label>
                        Issue type
                        <select value={issueType} onChange={(event) => {
                          setIssueType(event.target.value);
                          setMissingIssueFields([]);
                        }}>
                          {modeIssueTypes(auditMode).map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
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
                        <label key={name} className={missing ? "field-missing" : ""}>
                          {label}
                          {kind === "select" ? (
                            <select name={name} required={required} defaultValue={required ? "" : options?.[0]}>
                              {required && <option value="">Select {label.toLowerCase()}</option>}
                              {(options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          ) : (
                            <input name={name} required={required} />
                          )}
                        </label>
                        );
                      })}
                    </div>

                    {issueType === "transcription" && (
                      <div className="dynamic-fields">
                        <label className={missingIssueFields.includes("turn") ? "field-missing" : ""}>
                          Turn with the error
                          <select
                            value={transcriptionTurn}
                            onChange={(event) => {
                              const value = event.target.value;
                              setTranscriptionTurn(value);
                              const turn = currentCall?.turns?.[Number(value)];
                              setAudioSaid(turn ? turn.text : "");
                              setMissingIssueFields([]);
                            }}
                          >
                            <option value="">Select the transcript turn</option>
                            {(currentCall?.turns || []).map((turn, index) => (
                              <option key={index} value={index}>
                                {index + 1}. {turn.role}: {turn.text.slice(0, 60)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {transcriptionTurn !== "" && (
                          <>
                            <label>
                              What was transcripted (from transcript)
                              <textarea value={currentCall?.turns?.[Number(transcriptionTurn)]?.text || ""} readOnly rows={2} />
                            </label>
                            <label className={missingIssueFields.includes("audio_said") ? "field-missing" : ""}>
                              What was said in audio (edit to correct)
                              <textarea
                                value={audioSaid}
                                onChange={(event) => setAudioSaid(event.target.value)}
                                rows={2}
                              />
                            </label>
                          </>
                        )}
                      </div>
                    )}
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
                          <button type="button" onClick={() => setIssues((existing) => existing.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                        </div>
                      )) : "No issues yet."}
                    </div>
                  </section>
                </>
              )}

              {auditMode === RESPONSE_VIBE_MODE && (
                <section className="vibe-calibration">
                  <div className="panel-title small">
                    <h3>Overall vibe score</h3>
                    <span>1-4</span>
                  </div>
                  <p className="helper-copy">
                    Give one overall rating for the call, then add a short remark explaining what drove the score.
                  </p>
                  <div className={`rating-card vibe-card ${!vibeScore || !vibeReason.trim() ? "missing" : ""}`}>
                    <label className={!vibeScore ? "field-missing" : ""}>
                      Overall rating
                      <select value={vibeScore} onChange={(event) => setVibeScore(event.target.value)}>
                        <option value="">Not rated</option>
                        <option value="1">1 - Major failure</option>
                        <option value="2">2 - Noticeably broken</option>
                        <option value="3">3 - Mostly okay</option>
                        <option value="4">4 - Clean call</option>
                      </select>
                    </label>
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
              <div className={`transcript ${currentCall ? "" : "empty-state"}`}>
                {currentCall?.turns?.length ? (() => {
                  const duration = Number(currentCall.duration_sec || 0);
                  const turnWordCounts = currentCall.turns.map((turn) => wordCount(turn.text));
                  const totalWords = turnWordCounts.reduce((sum, count) => sum + count, 0) || currentCall.turns.length;
                  let cumulativeWords = 0;

                  return currentCall.turns.map((turn, index) => {
                    const estimate = Math.floor((cumulativeWords / totalWords) * duration);
                    cumulativeWords += turnWordCounts[index] || 1;
                    const exact = turnTimes?.[index];
                    const jumpTime = exact !== undefined ? exact : estimate;
                    return (
                      <div className={`turn ${turn.role}`} key={`${turn.role}-${index}`} onClick={() => { if (audioRef.current) audioRef.current.currentTime = jumpTime; }}>
                        <div className="turn-role">
                          <span>{index + 1}. {turn.role}</span>
                          <span className="turn-time">{exact !== undefined ? formatTime(exact) : `~${formatTime(estimate)}`}</span>
                        </div>
                        <div>{turn.text}</div>
                      </div>
                    );
                  });
                })() : "Select a call from the queue."}
              </div>
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
