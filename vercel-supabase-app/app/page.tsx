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
const AUDIT_MODE = "technical_audio";
const issueTypes = ["pronunciation", "tone", "barge_in", "latency", "response_appropriateness"];
const ratingMetrics = ["pronunciation", "tone", "barge_in", "latency", "response_appropriateness", "overall"];

const issueLabels: Record<string, string> = {
  pronunciation: "Pronunciation",
  tone: "Tone",
  barge_in: "Barge-in",
  latency: "Latency",
  response_appropriateness: "Response appropriateness",
  overall: "Overall"
};

const issueConfigs: Record<string, Array<[string, string, "text" | "select", string[]?]>> = {
  pronunciation: [
    ["correct_form", "Correct form", "text"],
    ["word_heard", "Word heard", "text"],
    ["content_tag", "Content tag", "select", ["General", "City", "Proper Noun"]],
    ["notes", "Notes", "text"]
  ],
  tone: [
    ["tag", "Tag", "select", ["Too robotic", "Wrong emotion", "Too fast", "Too slow", "Other"]],
    ["notes", "Notes", "text"]
  ],
  barge_in: [
    ["notes", "Notes", "text"]
  ],
  latency: [
    ["reaction", "User reaction", "select", ["None - call continued", "Spoke again unprompted", "Said hello / are you there", "Expressed frustration", "Call ended"]],
    ["notes", "Notes", "text"]
  ],
  response_appropriateness: [
    ["response_error_type", "Type of error", "select", ["Irrelevant response", "Agent stuck in loop/same info captured repeatedly", "Context not carried through", "Factual Inaccuracy/Hallucination", "Rule Navigation/Instruction Conflict", "Others"]],
    ["error_explanation", "Explain the error", "text"]
  ]
};

const emptyMetricRatings = () => Object.fromEntries(
  ratingMetrics.map((metric) => [metric, { rating: "", reason: "" }])
) as Record<string, MetricRating>;

const requiredIssueFields: Record<string, string[]> = {
  pronunciation: ["word_heard"],
  tone: ["tag"],
  response_appropriateness: ["response_error_type", "error_explanation"]
};

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
  const [reviewerName, setReviewerName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginVisible, setLoginVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [queueView, setQueueView] = useState<"pending" | "submitted">("pending");
  const [currentTime, setCurrentTime] = useState("00:00");
  const [capturedTime, setCapturedTime] = useState("00:00");
  const [issueType, setIssueType] = useState("pronunciation");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [metricRatings, setMetricRatings] = useState<Record<string, MetricRating>>(emptyMetricRatings);
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
    const storedName = window.localStorage.getItem("auditReviewer") || "";
    setLoginName(storedName);
    setIssueType(issueTypes[0]);
    loadCalls(storedName);
    if (storedName) {
      setReviewerName(storedName);
      setLoginVisible(false);
    }
  }, []);

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

  async function loadCalls(reviewer = reviewerName) {
    const params = new URLSearchParams({ mode: AUDIT_MODE });
    if (reviewer) params.set("reviewer", reviewer);
    const payload = await api(`/api/calls?${params.toString()}`);
    setCalls(payload.calls || []);
  }

  const clients = useMemo(() => [...new Set(calls.map((call) => call.org_name).filter(Boolean))].sort() as string[], [calls]);
  const agents = useMemo(() => [...new Set(calls.map((call) => call.agent_name).filter(Boolean))].sort() as string[], [calls]);

  const filteredCalls = useMemo(() => {
    const query = search.trim().toLowerCase();
    return calls
      .filter((call) => {
        if (queueView === "pending" && call.reviewed) return false;
        if (queueView === "submitted" && !call.reviewed) return false;
        if (clientFilter && call.org_name !== clientFilter) return false;
        if (agentFilter && call.agent_name !== agentFilter) return false;
        if (!query) return true;
        return call.execution_id.toLowerCase().includes(query);
      })
      .sort((a, b) => a.execution_id.localeCompare(b.execution_id));
  }, [agentFilter, calls, clientFilter, queueView, search]);
  const reviewedCount = calls.filter((call) => call.reviewed).length;
  const pendingCount = calls.length - reviewedCount;
  const currentCallSummary = currentCall ? calls.find((call) => call.execution_id === currentCall.execution_id) : null;
  const currentCallSubmitted = Boolean(currentCallSummary?.reviewed || (currentCall && submittedCallId === currentCall.execution_id));

  async function selectCall(id: string) {
    const call = await api(`/api/calls/${encodeURIComponent(id)}`);
    setCurrentCall(call);
    setIssues([]);
    setMetricRatings(emptyMetricRatings());
    setMissingIssueFields([]);
    setMissingRatingFields([]);
    setCapturedTime("00:00");
    setStartedAt(new Date().toISOString());
    setNotes("");
    setSubmittedCallId("");
  }

  function startSession(event: FormEvent) {
    event.preventDefault();
    const name = loginName.trim();
    if (!name) return;
    setReviewerName(name);
    setLoginVisible(false);
    window.localStorage.setItem("auditReviewer", name);
    loadCalls(name);
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
    const missing = (requiredIssueFields[issueType] || []).filter((field) => !String(issue[field] || "").trim());
    if (missing.length) {
      setMissingIssueFields(missing);
      return;
    }
    setMissingIssueFields([]);
    setIssues((existing) => [...existing, issue]);
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
    const missingRatings = ratingMetrics.flatMap((metric) => {
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
    setMissingRatingFields([]);
    const durationTaken = startedAt ? Math.floor((Date.now() - Date.parse(startedAt)) / 1000) : 0;
    const ratingIssues = ratingMetrics
      .filter((metric) => metricRatings[metric]?.rating || metricRatings[metric]?.reason)
      .map((metric) => ({
        type: "metric_rating",
        metric,
        metric_label: issueLabels[metric],
        rating: metricRatings[metric]?.rating || "",
        reason: metricRatings[metric]?.reason || ""
      }));
    setSubmittingReview(true);
    try {
      const result = await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          call_id: currentCall.execution_id,
          reviewer_name: reviewerName,
          review_mode: AUDIT_MODE,
          vibe_score: "",
          flow_score: "",
          llm_rating: "",
          llm_error_type: "",
          notes,
          issues: [...issues, ...ratingIssues],
          started_at: startedAt,
          duration_taken_sec: durationTaken
        })
      });
      setSubmittedCallId(currentCall.execution_id);
      setCalls((existing) => existing.map((call) => (
        call.execution_id === currentCall.execution_id
          ? { ...call, reviewed: true, reviewer_name: reviewerName }
          : call
      )));
      setCurrentCall((existing) => existing ? { ...existing, reviewed: true, reviewer_name: reviewerName } : existing);
      setStatusMessage(result.sheets_sync?.ok ? "Submitted and synced to Sheets." : "Submitted locally. Sheets sync pending.");
      setQueueView("pending");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function syncSheets() {
    try {
      const result = await api("/api/sync-sheets", { method: "POST", body: JSON.stringify({ audit_mode: AUDIT_MODE }) });
      alert(`Synced ${result.synced_reviews} technical audio review(s) to Google Sheets.`);
    } catch (error) {
      alert(`Sheets sync not complete: ${(error as Error).message}`);
    }
  }

  async function importSheets() {
    if (importingCalls) return;
    try {
      setImportingCalls(true);
      setImportStatus("Importing technical audio calls from Google Sheets...");
      const result = await api("/api/import-sheets", { method: "POST", body: JSON.stringify({ audit_mode: AUDIT_MODE }) });
      await loadCalls();
      setImportStatus(`Imported ${result.imported} technical audio call(s) from ${result.sheet_name || "Google Sheets"}.`);
      setStatusMessage(`Imported ${result.imported} technical audio call(s).`);
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
              <p>Enter your name to start the technical audio audit.</p>
            </div>
            <label>
              Reviewer name
              <input value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="Type your name" required />
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
              <p>{reviewerName ? `${reviewerName} · Technical audio audit` : "Internal review cockpit"}</p>
            </div>
            <div className="brand-actions">
              <button className="ghost" onClick={() => setLoginVisible(true)}>Switch</button>
            </div>
          </div>
          <div className="import-actions">
            <button className="ghost" onClick={importSheets} disabled={importingCalls}>
              {importingCalls ? "Importing..." : "Import calls"}
            </button>
          </div>
          {importStatus && <div className="import-status">{importStatus}</div>}

          <div className="queue-toolbar">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search call ID" />
          </div>
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
          <div className="queue-stats">{pendingCount} pending · {reviewedCount} submitted · {calls.length} assigned</div>
          <nav className="call-list">
            {filteredCalls.map((call) => (
              <button key={call.execution_id} className={`call-card ${call.reviewed ? "reviewed submitted" : ""} ${currentCall?.execution_id === call.execution_id ? "active" : ""}`} onClick={() => selectCall(call.execution_id)}>
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

              <div className="quick-flags">
                {issueTypes.map((type) => (
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
                      {issueTypes.map((type) => <option key={type} value={type}>{issueLabels[type]}</option>)}
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

              <label className="notes-field">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Only capture what helps Bolna act." />
              </label>

              <section className="metric-ratings">
                <div className="panel-title small">
                  <h3>Call ratings</h3>
                  <span>1-4</span>
                </div>
                {ratingMetrics.map((metric) => (
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

              <div className="submit-row">
                <a className="ghost export" href={`/api/reviews.csv?mode=${encodeURIComponent(AUDIT_MODE)}`}>Export CSV</a>
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
