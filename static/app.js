const state = {
  calls: [],
  currentCall: null,
  issues: [],
  capturedTime: "00:00",
  startedAt: null,
  hideReviewed: false,
  reviewerName: "",
};

const $ = (id) => document.getElementById(id);

const issueLabels = {
  pronunciation: "Pronunciation",
  tone: "Tone",
  interruption: "Interruption",
  latency: "Latency",
  transcription: "Transcription",
  response_appropriateness: "Response appropriateness",
};

const modeIssues = {
  technical_audio: ["pronunciation", "tone", "interruption", "latency", "response_appropriateness"],
  vibe_transcription: ["transcription"],
};

const issueConfigs = {
  pronunciation: [
    ["correct_form", "Correct form", "text"],
    ["word_heard", "Word heard", "text"],
    ["severity", "Severity", "select", ["1 - Caused confusion", "2 - Understood with effort", "3 - Minor"]],
    ["content_tag", "Content tag", "select", ["General", "City", "Proper Noun"]],
  ],
  tone: [
    ["tag", "Tag", "select", ["Too robotic", "Wrong emotion", "Too fast", "Too slow", "Other"]],
    ["notes", "Notes", "text"],
  ],
  interruption: [
    ["valid", "Validity", "select", ["User had paused/finished", "User was mid sentence"]],
    ["consequence", "Consequence", "select", ["User repeated themselves", "User showed confusion", "Others"]],
    ["notes", "Notes", "text"],
  ],
  latency: [
    ["reaction", "User reaction", "select", ["None - call continued", "Spoke again unprompted", "Said hello / are you there", "Expressed frustration", "Hung up"]],
  ],
  transcription: [
    ["transcription_error_type", "Type of transcription error", "select", ["Wrong Transcription same language", "Wrong Transcription different language", "Missing"]],
    ["audio_unclear", "Audio unclear?", "select", ["No", "Yes"]],
    ["audio_said", "What was said in audio", "text"],
    ["transcripted", "What was transcripted", "text"],
    ["content_tag", "Type of transcription content", "select", ["City", "Other Proper Noun", "General"]],
  ],
  response_appropriateness: [
    ["response_error_type", "Type of error", "select", ["Irrelevant response", "Agent stuck in loop/same info captured repeatedly", "Context not carried through", "Factual Inaccuracy/Hallucination", "Rule Navigation/Instruction Conflict", "Others"]],
    ["notes", "Notes", "text"],
  ],
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function parseDuration(seconds) {
  const value = Number(seconds || 0);
  return value ? formatTime(value) : "";
}

function shortCallId(callId) {
  return String(callId || "").slice(0, 8);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

async function loadCalls() {
  const payload = await api("/api/calls");
  state.calls = payload.calls;
  renderFilterOptions();
  renderCallList();
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function hasAssignments() {
  return state.calls.some((call) => normalize(call.assigned_reviewer));
}

function callsForReviewer() {
  const reviewer = normalize(state.reviewerName);
  const assignmentsEnabled = hasAssignments();
  return state.calls.filter((call) => {
    if (assignmentsEnabled && normalize(call.assigned_reviewer) !== reviewer) return false;
    return true;
  });
}

function renderFilterOptions() {
  const selectedClient = $("clientFilter").value;
  const selectedAgent = $("agentFilter").value;
  const baseCalls = callsForReviewer();
  const clients = [...new Set(baseCalls.map((call) => call.org_name).filter(Boolean))].sort();
  const agents = [...new Set(baseCalls.map((call) => call.agent_name).filter(Boolean))].sort();

  $("clientFilter").innerHTML = `<option value="">All clients</option>${clients
    .map((client) => `<option value="${escapeHtml(client)}">${escapeHtml(client)}</option>`)
    .join("")}`;
  $("agentFilter").innerHTML = `<option value="">All agents</option>${agents
    .map((agent) => `<option value="${escapeHtml(agent)}">${escapeHtml(agent)}</option>`)
    .join("")}`;

  $("clientFilter").value = clients.includes(selectedClient) ? selectedClient : "";
  $("agentFilter").value = agents.includes(selectedAgent) ? selectedAgent : "";
}

function filteredCalls() {
  const query = $("searchCalls").value.trim().toLowerCase();
  const client = $("clientFilter").value;
  const agent = $("agentFilter").value;
  return callsForReviewer()
    .filter((call) => {
      if (state.hideReviewed && call.reviewed) return false;
      if (client && call.org_name !== client) return false;
      if (agent && call.agent_name !== agent) return false;
      if (!query) return true;
      const callId = String(call.execution_id || "").toLowerCase();
      return callId.includes(query);
    })
    .sort((a, b) => {
      if (!query) return String(a.execution_id).localeCompare(String(b.execution_id));
      const aId = String(a.execution_id || "").toLowerCase();
      const bId = String(b.execution_id || "").toLowerCase();
      const aScore = aId.startsWith(query) ? 0 : aId.includes(query) ? 1 : 2;
      const bScore = bId.startsWith(query) ? 0 : bId.includes(query) ? 1 : 2;
      return aScore - bScore || aId.localeCompare(bId);
    });
}

function renderCallList() {
  const calls = filteredCalls();
  const assignedCalls = callsForReviewer();
  const done = assignedCalls.filter((call) => call.reviewed).length;
  const assignmentNote = hasAssignments() ? `${assignedCalls.length} assigned` : `${state.calls.length} imported`;
  $("queueStats").textContent = `${assignmentNote} · ${done} reviewed · ${calls.length} shown`;
  $("callList").innerHTML = "";

  for (const call of calls) {
    const button = document.createElement("button");
    button.className = `call-card ${call.reviewed ? "reviewed" : ""} ${state.currentCall?.execution_id === call.execution_id ? "active" : ""}`;
    button.innerHTML = `
      <span class="call-id">ID ${escapeHtml(shortCallId(call.execution_id))}</span>
      <strong>${escapeHtml(call.agent_name || "Unknown agent")}</strong>
      <span>${escapeHtml(call.org_name || "")} · ${parseDuration(call.duration_sec)} · ${escapeHtml(call.language || "")}</span>
      <span>${call.reviewed ? "Reviewed" : "Open"} · ${escapeHtml(call.created_at_ist || "")}</span>
      ${call.assigned_reviewer ? `<span>Assigned: ${escapeHtml(call.assigned_reviewer)}</span>` : ""}
    `;
    button.addEventListener("click", () => selectCall(call.execution_id));
    $("callList").appendChild(button);
  }
}

async function selectCall(id) {
  const call = await api(`/api/calls/${encodeURIComponent(id)}`);
  state.currentCall = call;
  state.issues = [];
  state.startedAt = new Date().toISOString();
  state.capturedTime = "00:00";
  resetReviewForm();
  renderCurrentCall();
  renderCallList();
}

function renderCurrentCall() {
  const call = state.currentCall;
  $("callOrg").textContent = call.org_name || "Unknown org";
  $("callAgent").textContent = call.agent_name || "Unknown agent";
  $("callMeta").textContent = `Call ID ${call.execution_id} · ${parseDuration(call.duration_sec)} · ${call.created_at_ist || ""}`;
  $("audio").src = call.recording_url || "";
  $("capturedTime").textContent = `Captured: ${state.capturedTime}`;
  $("issueTimestamp").value = state.capturedTime;
  renderTranscript(call.turns || []);
  renderIssues();
}

function renderTranscript(turns) {
  $("turnCount").textContent = `${turns.length} turns · click a turn to jump approximately`;
  if (!turns.length) {
    $("transcript").className = "transcript empty-state";
    $("transcript").textContent = "No transcript found for this call.";
    return;
  }
  $("transcript").className = "transcript";
  const duration = Number(state.currentCall?.duration_sec || $("audio").duration || 0);
  const step = turns.length > 1 && duration ? duration / turns.length : 0;
  $("transcript").innerHTML = turns.map((turn, index) => {
    const jumpTime = Math.max(0, Math.floor(step * index));
    return `
    <div class="turn ${escapeHtml(turn.role)}" data-jump-time="${jumpTime}" title="Jump to approx ${formatTime(jumpTime)}">
      <div class="turn-role">
        <span>${index + 1}. ${escapeHtml(turn.role)}</span>
        <span class="turn-time">~${formatTime(jumpTime)}</span>
      </div>
      <div>${escapeHtml(turn.text)}</div>
    </div>
  `;
  }).join("");

  document.querySelectorAll("[data-jump-time]").forEach((turn) => {
    turn.addEventListener("click", () => {
      const time = Number(turn.dataset.jumpTime || 0);
      $("audio").currentTime = time;
      $("audio").focus();
    });
  });
}

function setIssueType(type) {
  $("issueType").value = type;
  $("captureIssueType").value = type;
  renderDynamicFields();
}

function focusIssueForm() {
  $("issueForm").scrollIntoView({ behavior: "smooth", block: "start" });
  $("issueForm").classList.add("issue-form-active");
  window.setTimeout(() => $("issueForm").classList.remove("issue-form-active"), 900);
}

function currentMode() {
  return $("reviewMode").value || "technical_audio";
}

function currentIssueTypes() {
  return modeIssues[currentMode()] || modeIssues.technical_audio;
}

function renderIssueControls() {
  const types = currentIssueTypes();
  const options = types
    .map((type) => `<option value="${type}">${escapeHtml(issueLabels[type])}</option>`)
    .join("");
  $("issueType").innerHTML = options;
  $("captureIssueType").innerHTML = options;

  document.querySelector(".quick-flags").innerHTML = types
    .map((type) => `<button type="button" data-issue="${type}">${escapeHtml(issueLabels[type])}</button>`)
    .join("");

  setIssueType(types[0]);
  bindIssueButtons();
}

function bindIssueButtons() {
  document.querySelectorAll("[data-issue]").forEach((button) => {
    button.addEventListener("click", () => {
      setIssueType(button.dataset.issue);
      $("issueTimestamp").value = state.capturedTime;
      focusIssueForm();
    });
  });
}

function renderDynamicFields() {
  const type = $("issueType").value;
  const fields = issueConfigs[type] || [];
  $("dynamicFields").innerHTML = fields.map(([name, label, kind, options]) => {
    if (kind === "select") {
      return `<label>${label}<select data-field="${name}">${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select></label>`;
    }
    return `<label>${label}<input data-field="${name}" /></label>`;
  }).join("");
}

function renderIssues() {
  $("issueCount").textContent = String(state.issues.length);
  if (!state.issues.length) {
    $("issueList").className = "issue-list empty-state";
    $("issueList").textContent = "No issues yet.";
    return;
  }
  $("issueList").className = "issue-list";
  $("issueList").innerHTML = "";
  state.issues.forEach((issue, index) => {
    const item = document.createElement("div");
    item.className = "issue-item";
    const details = Object.entries(issue)
      .filter(([key]) => !["type", "timestamp"].includes(key))
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
      .join(" · ");
    item.innerHTML = `
      <header><span>${escapeHtml(issue.type)} · ${escapeHtml(issue.timestamp)}</span></header>
      <p>${escapeHtml(details || "No extra fields")}</p>
      <button type="button">Remove</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      state.issues.splice(index, 1);
      renderIssues();
    });
    $("issueList").appendChild(item);
  });
}

function resetReviewForm() {
  for (const id of ["vibeScore", "flowScore", "llmRating", "llmErrorType", "reviewNotes"]) {
    $(id).value = "";
  }
  $("primaryVibeScore").value = "";
  updateLlmErrorVisibility();
}

function addIssue(event) {
  event.preventDefault();
  if (!state.currentCall) return;
  const issue = {
    type: $("issueType").value,
    timestamp: $("issueTimestamp").value || state.capturedTime,
  };
  document.querySelectorAll("[data-field]").forEach((input) => {
    issue[input.dataset.field] = input.value;
  });
  state.issues.push(issue);
  renderIssues();
}

async function submitReview() {
  if (!state.currentCall) {
    alert("Select a call first.");
    return;
  }
  if (currentMode() === "vibe_transcription" && !$("primaryVibeScore").value) {
    alert("Please select a vibe score before submitting.");
    $("primaryVibeScore").focus();
    return;
  }
  const duration = state.startedAt ? Math.floor((Date.now() - Date.parse(state.startedAt)) / 1000) : 0;
  await api("/api/reviews", {
    method: "POST",
    body: JSON.stringify({
      call_id: state.currentCall.execution_id,
      reviewer_name: state.reviewerName,
      review_mode: $("reviewMode").value,
      vibe_score: $("primaryVibeScore").value || $("vibeScore").value,
      flow_score: $("flowScore").value,
      llm_rating: $("llmRating").value,
      llm_error_type: $("llmErrorType").value,
      notes: $("reviewNotes").value,
      issues: state.issues,
      started_at: state.startedAt,
      duration_taken_sec: duration,
    }),
  });
  await loadCalls();
  selectNextCall();
}

async function syncSheets() {
  try {
    const result = await api("/api/sync-sheets", { method: "POST", body: "{}" });
    alert(`Synced ${result.synced_reviews} review(s) to Google Sheets.`);
  } catch (error) {
    alert(`Sheets sync not complete: ${error.message}`);
  }
}

function selectNextCall() {
  const calls = filteredCalls().filter((call) => !call.reviewed);
  if (!calls.length) return;
  const currentIndex = calls.findIndex((call) => call.execution_id === state.currentCall?.execution_id);
  const next = calls[currentIndex + 1] || calls[0];
  selectCall(next.execution_id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindEvents() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    startSession($("loginName").value, $("loginMode").value);
  });
  $("switchReviewerBtn").addEventListener("click", () => {
    localStorage.removeItem("auditReviewer");
    localStorage.removeItem("auditMode");
    state.reviewerName = "";
    $("loginScreen").classList.remove("hidden-field");
  });
  $("searchCalls").addEventListener("input", renderCallList);
  $("clientFilter").addEventListener("change", renderCallList);
  $("agentFilter").addEventListener("change", renderCallList);
  $("llmRating").addEventListener("change", updateLlmErrorVisibility);
  $("reviewMode").addEventListener("change", () => {
    localStorage.setItem("auditMode", $("reviewMode").value);
    $("loginMode").value = $("reviewMode").value;
    $("activeReviewer").textContent = `${state.reviewerName} · ${$("reviewMode").selectedOptions[0].textContent}`;
    state.issues = [];
    renderIssueControls();
    updateSummaryFields();
    renderIssues();
    renderCallList();
  });
  $("hideReviewedBtn").addEventListener("click", () => {
    state.hideReviewed = !state.hideReviewed;
    $("hideReviewedBtn").dataset.active = String(state.hideReviewed);
    $("hideReviewedBtn").textContent = state.hideReviewed ? "Show reviewed" : "Hide reviewed";
    renderCallList();
  });
  $("importBtn").addEventListener("click", async () => {
    const result = await api("/api/import", { method: "POST", body: "{}" });
    alert(`Imported ${result.imported} rows from ${result.file}`);
    await loadCalls();
  });
  $("issueType").addEventListener("change", renderDynamicFields);
  $("issueType").addEventListener("change", () => {
    $("captureIssueType").value = $("issueType").value;
  });
  $("captureIssueType").addEventListener("change", () => {
    setIssueType($("captureIssueType").value);
  });
  $("issueForm").addEventListener("submit", addIssue);
  $("submitReview").addEventListener("click", submitReview);
  $("syncSheets").addEventListener("click", syncSheets);
  $("nextCallBtn").addEventListener("click", selectNextCall);

  $("audio").addEventListener("timeupdate", () => {
    $("currentTime").textContent = formatTime($("audio").currentTime);
  });
  $("captureTime").addEventListener("click", () => {
    state.capturedTime = formatTime($("audio").currentTime);
    setIssueType($("captureIssueType").value);
    $("capturedTime").textContent = `Captured: ${state.capturedTime}`;
    $("issueTimestamp").value = state.capturedTime;
    focusIssueForm();
  });
  $("back5").addEventListener("click", () => {
    $("audio").currentTime = Math.max(0, $("audio").currentTime - 5);
  });
  $("forward5").addEventListener("click", () => {
    $("audio").currentTime = $("audio").currentTime + 5;
  });
}

function startSession(name, mode) {
  state.reviewerName = String(name || "").trim();
  if (!state.reviewerName) return;
  $("reviewMode").value = mode || "technical_audio";
  $("loginMode").value = $("reviewMode").value;
  $("activeReviewer").textContent = `${state.reviewerName} · ${$("reviewMode").selectedOptions[0].textContent}`;
  $("loginScreen").classList.add("hidden-field");
  localStorage.setItem("auditReviewer", state.reviewerName);
  localStorage.setItem("auditMode", $("reviewMode").value);
  state.currentCall = null;
  state.issues = [];
  renderIssueControls();
  updateSummaryFields();
  renderFilterOptions();
  renderCallList();
}

function restoreSession() {
  const name = localStorage.getItem("auditReviewer") || "";
  const mode = localStorage.getItem("auditMode") || "technical_audio";
  $("loginName").value = name;
  $("loginMode").value = mode;
  $("reviewMode").value = mode;
  renderIssueControls();
  if (name) startSession(name, mode);
}

function updateLlmErrorVisibility() {
  const show = currentMode() !== "vibe_transcription" && $("llmRating").value === "deviated";
  $("llmErrorTypeWrap").classList.toggle("hidden-field", !show);
  if (!show) $("llmErrorType").value = "";
}

function updateSummaryFields() {
  const vibeMode = currentMode() === "vibe_transcription";
  $("vibePrimary").classList.toggle("hidden-field", !vibeMode);
  document.querySelector('[data-summary-field="vibe"]').classList.toggle("hidden-field", vibeMode);
  document.querySelector('[data-summary-field="notes"]').classList.toggle("hidden-field", false);
  document.querySelector('[data-summary-field="flow"]').classList.toggle("hidden-field", vibeMode);
  document.querySelector('[data-summary-field="llm-rating"]').classList.toggle("hidden-field", vibeMode);
  if (vibeMode) {
    $("vibeScore").value = "";
    $("flowScore").value = "";
    $("llmRating").value = "";
    $("llmErrorType").value = "";
  } else {
    $("primaryVibeScore").value = "";
  }
  updateLlmErrorVisibility();
}

bindEvents();
renderIssueControls();
updateSummaryFields();
loadCalls()
  .then(restoreSession)
  .catch((error) => alert(error.message));
