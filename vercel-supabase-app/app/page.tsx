"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CallSummary = {
  execution_id: string;
  assigned_reviewer?: string | null;
  org_name?: string | null;
  agent_name?: string | null;
  duration_sec?: number | null;
  created_at_ist?: string | null;
  status?: string | null;
  language?: string | null;
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

const issueLabels: Record<string, string> = {
  pronunciation: "Pronunciation",
  tone: "Tone",
  interruption: "Interruption",
  latency: "Latency",
  transcription: "Transcription",
  response_appropriateness: "Response appropriateness"
};

const modeIssues: Record<string, string[]> = {
  technical_audio: ["pronunciation", "tone", "interruption", "latency", "response_appropriateness"],
  vibe_transcription: ["transcription"]
};

const issueConfigs: Record<string, Array<[string, string, "text" | "select", string[]?]>> = {
  pronunciation: [
    ["correct_form", "Correct form", "text"],
    ["word_heard", "Word heard", "text"],
    ["severity", "Severity", "select", ["1 - Caused confusion", "2 - Understood with effort", "3 - Minor"]],
    ["content_tag", "Content tag", "select", ["General", "City", "Proper Noun"]]
  ],
  tone: [
    ["tag", "Tag", "select", ["Too robotic", "Wrong emotion", "Too fast", "Too slow", "Other"]],
    ["notes", "Notes", "text"]
  ],
  interruption: [
    ["valid", "Validity", "select", ["User had paused/finished", "User was mid sentence"]],
    ["consequence", "Consequence", "select", ["User repeated themselves", "User showed confusion", "Others"]],
    ["notes", "Notes", "text"]
  ],
  latency: [
    ["reaction", "User reaction", "select", ["None - call continued", "Spoke again unprompted", "Said hello / are you there", "Expressed frustration", "Hung up"]]
  ],
  transcription: [
    ["transcription_error_type", "Type of transcription error", "select", ["Wrong Transcription same language", "Wrong Transcription different language", "Missing"]],
    ["audio_unclear", "Audio unclear?", "select", ["No", "Yes"]],
    ["audio_said", "What was said in audio", "text"],
    ["transcripted", "What was transcripted", "text"],
    ["content_tag", "Type of transcription content", "select", ["City", "Other Proper Noun", "General"]]
  ],
  response_appropriateness: [
    ["response_error_type", "Type of error", "select", ["Irrelevant response", "Agent stuck in loop/same info captured repeatedly", "Context not carried through", "Factual Inaccuracy/Hallucination", "Rule Navigation/Instruction Conflict", "Others"]],
    ["notes", "Notes", "text"]
  ]
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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
  const [reviewerName, setReviewerName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [mode, setMode] = useState("technical_audio");
  const [loginVisible, setLoginVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [hideReviewed, setHideReviewed] = useState(false);
  const [currentTime, setCurrentTime] = useState("00:00");
  const [capturedTime, setCapturedTime] = useState("00:00");
  const [issueType, setIssueType] = useState("pronunciation");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [primaryVibeScore, setPrimaryVibeScore] = useState("");
  const [vibeScore, setVibeScore] = useState("");
  const [flowScore, setFlowScore] = useState("");
  const [llmRating, setLlmRating] = useState("");
  const [llmErrorType, setLlmErrorType] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importingCalls, setImportingCalls] = useState(false);

  const issueTypes = modeIssues[mode] || modeIssues.technical_audio;
  const vibeMode = mode === "vibe_transcription";

  useEffect(() => {
    loadCalls();
    const storedName = window.localStorage.getItem("auditReviewer") || "";
    const storedMode = window.localStorage.getItem("auditMode") || "technical_audio";
    setLoginName(storedName);
    setMode(storedMode);
    setIssueType(modeIssues[storedMode]?.[0] || "pronunciation");
    if (storedName) {
      setReviewerName(storedName);
      setLoginVisible(false);
    }
  }, []);

  useEffect(() => {
    setIssueType(issueTypes[0]);
    setIssues([]);
    setPrimaryVibeScore("");
    setVibeScore("");
    setFlowScore("");
    setLlmRating("");
    setLlmErrorType("");
  }, [mode]);

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

  async function loadCalls() {
    const payload = await api("/api/calls");
    setCalls(payload.calls || []);
  }

  const assignmentsEnabled = calls.some((call) => normalize(call.assigned_reviewer));
  const reviewerCalls = useMemo(() => {
    return calls.filter((call) => {
      if (!assignmentsEnabled) return true;
      return normalize(call.assigned_reviewer) === normalize(reviewerName);
    });
  }, [assignmentsEnabled, calls, reviewerName]);

  const clients = useMemo(() => [...new Set(reviewerCalls.map((call) => call.org_name).filter(Boolean))].sort() as string[], [reviewerCalls]);
  const agents = useMemo(() => [...new Set(reviewerCalls.map((call) => call.agent_name).filter(Boolean))].sort() as string[], [reviewerCalls]);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reviewerCalls
      .filter((call) => {
        if (hideReviewed && call.reviewed) return false;
        if (clientFilter && call.org_name !== clientFilter) return false;
        if (agentFilter && call.agent_name !== agentFilter) return false;
        if (!query) return true;
        return call.execution_id.toLowerCase().includes(query);
      })
      .sort((a, b) => a.execution_id.localeCompare(b.execution_id));
  }, [agentFilter, clientFilter, hideReviewed, reviewerCalls, search]);

  async function selectCall(id: string) {
    const call = await api(`/api/calls/${encodeURIComponent(id)}`);
    setCurrentCall(call);
    setIssues([]);
    setCapturedTime("00:00");
    setStartedAt(new Date().toISOString());
    setPrimaryVibeScore("");
    setVibeScore("");
    setFlowScore("");
    setLlmRating("");
    setLlmErrorType("");
    setNotes("");
  }

  function startSession(event: FormEvent) {
    event.preventDefault();
    const name = loginName.trim();
    if (!name) return;
    setReviewerName(name);
    setLoginVisible(false);
    window.localStorage.setItem("auditReviewer", name);
    window.localStorage.setItem("auditMode", mode);
  }

  function captureTimestamp() {
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
    setIssues((existing) => [...existing, issue]);
  }

  async function submitReview() {
    if (!currentCall) {
      alert("Select a call first.");
      return;
    }
    if (vibeMode && !primaryVibeScore) {
      alert("Please select a vibe score before submitting.");
      return;
    }

    const durationTaken = startedAt ? Math.floor((Date.now() - Date.parse(startedAt)) / 1000) : 0;
    const result = await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        call_id: currentCall.execution_id,
        reviewer_name: reviewerName,
        review_mode: mode,
        vibe_score: primaryVibeScore || vibeScore,
        flow_score: vibeMode ? "" : flowScore,
        llm_rating: vibeMode ? "" : llmRating,
        llm_error_type: vibeMode ? "" : llmErrorType,
        notes,
        issues,
        started_at: startedAt,
        duration_taken_sec: durationTaken
      })
    });
    setStatusMessage(result.sheets_sync?.ok ? "Saved and synced to Sheets." : "Saved locally. Sheets sync pending.");
    await loadCalls();
    const openCalls = filteredCalls.filter((call) => !call.reviewed && call.execution_id !== currentCall.execution_id);
    if (openCalls[0]) await selectCall(openCalls[0].execution_id);
  }

  async function syncSheets() {
    try {
      const result = await api("/api/sync-sheets", { method: "POST", body: "{}" });
      alert(`Synced ${result.synced_reviews} review(s) to Google Sheets.`);
    } catch (error) {
      alert(`Sheets sync not complete: ${(error as Error).message}`);
    }
  }

  async function importSheets() {
    if (importingCalls) return;
    try {
      setImportingCalls(true);
      setImportStatus("Importing calls from Google Sheets...");
      const result = await api("/api/import-sheets", { method: "POST", body: "{}" });
      await loadCalls();
      setImportStatus(`Imported ${result.imported} call(s) from Google Sheets.`);
      setStatusMessage(`Imported ${result.imported} call(s) from Google Sheets.`);
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
          <form className="login-card" onSubmit={startSession}>
            <div>
              <h1>Call Audit</h1>
              <p>Choose your queue and audit mode.</p>
            </div>
            <label>
              Reviewer name
              <input value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="Type your name" required />
            </label>
            <label>
              Audit mode
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="technical_audio">Technical audio audit</option>
                <option value="vibe_transcription">Vibe + transcription</option>
              </select>
            </label>
            <button className="primary" type="submit">Start reviewing</button>
          </form>
        </section>
      )}

      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div>
              <h1>Call Audit</h1>
              <p>{reviewerName ? `${reviewerName} · ${mode === "technical_audio" ? "Technical audio audit" : "Vibe + transcription"}` : "Internal review cockpit"}</p>
            </div>
            <div className="brand-actions">
              <button className="ghost" onClick={importSheets} disabled={importingCalls}>{importingCalls ? "Importing..." : "Import Calls"}</button>
              <button className="ghost" onClick={() => setLoginVisible(true)}>Switch</button>
            </div>
          </div>
          {importStatus && <div className="import-status">{importStatus}</div>}

          <div className="reviewer-box">
            <label>
              Audit mode
              <select value={mode} onChange={(event) => {
                setMode(event.target.value);
                window.localStorage.setItem("auditMode", event.target.value);
              }}>
                <option value="technical_audio">Technical audio audit</option>
                <option value="vibe_transcription">Vibe + transcription</option>
              </select>
            </label>
          </div>

          <div className="queue-toolbar">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search call ID" />
            <button className="ghost" onClick={() => setHideReviewed((value) => !value)}>{hideReviewed ? "Show reviewed" : "Hide reviewed"}</button>
          </div>
          <div className="queue-filters">
            <label>
              Client
              <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="">All clients</option>
                {clients.map((client) => <option key={client} value={client}>{client}</option>)}
              </select>
            </label>
            <label>
              Agent
              <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)}>
                <option value="">All agents</option>
                {agents.map((agent) => <option key={agent} value={agent}>{agent}</option>)}
              </select>
            </label>
          </div>
          <div className="queue-stats">{assignmentsEnabled ? `${reviewerCalls.length} assigned` : `${calls.length} imported`} · {reviewerCalls.filter((call) => call.reviewed).length} reviewed · {filteredCalls.length} shown</div>
          <nav className="call-list">
            {filteredCalls.map((call) => (
              <button key={call.execution_id} className={`call-card ${call.reviewed ? "reviewed" : ""} ${currentCall?.execution_id === call.execution_id ? "active" : ""}`} onClick={() => selectCall(call.execution_id)}>
                <span className="call-id">ID {shortCallId(call.execution_id)}</span>
                <strong>{call.agent_name || "Unknown agent"}</strong>
                <span>{call.org_name || ""} · {formatTime(Number(call.duration_sec || 0))} · {call.language || ""}</span>
                <span>{call.reviewed ? "Reviewed" : "Open"} · {call.created_at_ist || ""}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="workspace">
          <section className="audio-bar">
            <div className="call-heading">
              <span>{currentCall?.org_name || "No call selected"}</span>
              <strong>{currentCall?.agent_name || "Select a call to start"}</strong>
              <span>{currentCall ? `Call ID ${currentCall.execution_id}` : ""}</span>
            </div>
            <audio ref={audioRef} controls preload="metadata" src={currentCall?.recording_url || ""} onTimeUpdate={() => setCurrentTime(formatTime(audioRef.current?.currentTime || 0))} />
            <div className="audio-actions">
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5); }}>-5s</button>
              <button onClick={() => { if (audioRef.current) audioRef.current.currentTime += 5; }}>+5s</button>
              <label className="capture-select">
                Issue
                <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
                  {issueTypes.map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
                </select>
              </label>
              <button className="primary" onClick={captureTimestamp}>Capture {currentTime}</button>
              <span className="captured">Captured: {capturedTime}</span>
            </div>
          </section>

          <section className="content-grid">
            <aside className="audit-panel">
              <div className="panel-title">
                <h2>Review</h2>
                <button className="ghost" onClick={() => {
                  const next = filteredCalls.find((call) => !call.reviewed && call.execution_id !== currentCall?.execution_id);
                  if (next) selectCall(next.execution_id);
                }}>Next</button>
              </div>

              {vibeMode && (
                <section className="vibe-primary">
                  <label>
                    Vibe score
                    <select value={primaryVibeScore} onChange={(event) => setPrimaryVibeScore(event.target.value)}>
                      <option value="">Select vibe score</option>
                      <option value="1">1 - Very poor</option>
                      <option value="2">2 - Poor</option>
                      <option value="3">3 - Acceptable</option>
                      <option value="4">4 - Good</option>
                    </select>
                  </label>
                </section>
              )}

              <div className="quick-flags">
                {issueTypes.map((type) => <button key={type} onClick={() => setIssueType(type)}>{issueLabels[type]}</button>)}
              </div>

              <form className="issue-form" onSubmit={addIssue}>
                <div className="form-row">
                  <label>
                    Issue type
                    <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
                      {issueTypes.map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
                    </select>
                  </label>
                  <label>
                    Timestamp
                    <input name="timestamp" defaultValue={capturedTime} key={capturedTime} />
                  </label>
                </div>

                <div className="dynamic-fields">
                  {(issueConfigs[issueType] || []).map(([name, label, kind, options]) => (
                    <label key={name}>
                      {label}
                      {kind === "select" ? (
                        <select name={name}>{(options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                      ) : (
                        <input name={name} />
                      )}
                    </label>
                  ))}
                </div>
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
                      <header><span>{issue.type} · {issue.timestamp}</span></header>
                      <p>{Object.entries(issue).filter(([key]) => !["type", "timestamp"].includes(key)).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`).join(" · ")}</p>
                      <button type="button" onClick={() => setIssues((existing) => existing.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                    </div>
                  )) : "No issues yet."}
                </div>
              </section>

              <details className="scores">
                <summary>Optional call summary</summary>
                {!vibeMode && (
                  <>
                    <label>Vibe score<select value={vibeScore} onChange={(event) => setVibeScore(event.target.value)}><option value="">Skip</option><option value="1">1 - Very poor</option><option value="2">2 - Poor</option><option value="3">3 - Acceptable</option><option value="4">4 - Good</option></select></label>
                    <label>Flow score<select value={flowScore} onChange={(event) => setFlowScore(event.target.value)}><option value="">Skip</option><option value="1">1 - Nonsensical</option><option value="2">2 - Broken</option><option value="3">3 - Mostly completed</option><option value="4">4 - Smooth conclusion</option></select></label>
                    <label>LLM call-level rating<select value={llmRating} onChange={(event) => setLlmRating(event.target.value)}><option value="">Skip</option><option value="as_expected">As expected</option><option value="not_perfect">Correct but not perfect</option><option value="deviated">Deviated</option></select></label>
                    {llmRating === "deviated" && <label>LLM error type<select value={llmErrorType} onChange={(event) => setLlmErrorType(event.target.value)}><option value="">None</option><option value="irrelevant_response">Irrelevant response</option><option value="loop">Agent stuck in loop / same info captured repeatedly</option><option value="context_not_carried">Context not carried through</option><option value="factual_inaccuracy">Factual Inaccuracy / Hallucination</option><option value="rule_conflict">Rule Navigation / Instruction Conflict</option><option value="other">Others</option></select></label>}
                  </>
                )}
                <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Only capture what helps Bolna act." /></label>
              </details>

              <div className="submit-row">
                <a className="ghost export" href="/api/reviews.csv">Export CSV</a>
                <button className="ghost" type="button" onClick={syncSheets}>Sync Sheets</button>
                <button className="primary" type="button" onClick={submitReview}>Submit Review</button>
              </div>
              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </aside>

            <article className="transcript-panel">
              <div className="panel-title">
                <h2>Transcript</h2>
                <span>{currentCall?.turns?.length || 0} turns · click a turn to jump approximately</span>
              </div>
              <div className={`transcript ${currentCall ? "" : "empty-state"}`}>
                {currentCall?.turns?.length ? (() => {
                  const duration = Number(currentCall.duration_sec || 0);
                  const turnWordCounts = currentCall.turns.map((turn) => wordCount(turn.text));
                  const totalWords = turnWordCounts.reduce((sum, count) => sum + count, 0) || currentCall.turns.length;
                  let cumulativeWords = 0;

                  return currentCall.turns.map((turn, index) => {
                    const jumpTime = Math.floor((cumulativeWords / totalWords) * duration);
                    cumulativeWords += turnWordCounts[index] || 1;
                    return (
                      <div className={`turn ${turn.role}`} key={`${turn.role}-${index}`} onClick={() => { if (audioRef.current) audioRef.current.currentTime = jumpTime; }}>
                        <div className="turn-role"><span>{index + 1}. {turn.role}</span><span className="turn-time">~{formatTime(jumpTime)}</span></div>
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
