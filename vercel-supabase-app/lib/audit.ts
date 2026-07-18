export type CallRow = {
  execution_id: string;
  assigned_reviewer?: string | null;
  org_name?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  duration_sec?: number | null;
  created_at_ist?: string | null;
  to_number?: string | null;
  status?: string | null;
  transcriber_language?: string | null;
  transcript?: string | null;
  recording_url?: string | null;
  agent_interrupted_user_count?: number | null;
  audit_mode?: string | null;
  source_sheet?: string | null;
};

export type ReviewRow = {
  id: number;
  call_id: string;
  reviewer_name?: string | null;
  reviewer_email?: string | null;
  review_mode?: string | null;
  vibe_score?: string | null;
  flow_score?: string | null;
  llm_rating?: string | null;
  llm_error_type?: string | null;
  notes?: string | null;
  issues_json?: unknown;
  started_at?: string | null;
  submitted_at?: string | null;
  duration_taken_sec?: number | null;
  calls?: CallRow | null;
};

export const PRONUNCIATION_TONE_REVIEW_EXPORT_COLUMNS = [
  "review_id",
  "call_id",
  "org_name",
  "agent_name",
  "call_duration_sec",
  "call_created_at_ist",
  "reviewer_name",
  "reviewer_email",
  "review_mode",
  "issue_type",
  "issue_timestamp",
  "issue_recording_link",
  "pronunciation_correct_form",
  "pronunciation_word_heard",
  "content_tag",
  "tone_tag",
  "latency_reaction",
  "response_error_type",
  "response_error_explanation",
  "metric_rating_name",
  "metric_rating_value",
  "metric_rating_reason",
  "issue_notes",
  "review_notes",
  "started_at",
  "submitted_at",
  "duration_taken_sec",
  "turn_number",
  "after_turn",
  "insert_order",
  "deleted_turn"
] as const;

export const TIMING_TRANSCRIPTION_REVIEW_EXPORT_COLUMNS = [
  "review_id",
  "call_id",
  "org_name",
  "agent_name",
  "call_duration_sec",
  "call_created_at_ist",
  "reviewer_name",
  "reviewer_email",
  "review_mode",
  "issue_type",
  "issue_timestamp",
  "issue_recording_link",
  "latency_reaction",
  "metric_rating_name",
  "metric_rating_value",
  "metric_rating_reason",
  "transcription_error_type",
  "audio_unclear",
  "audio_said",
  "transcripted",
  "content_tag",
  "issue_notes",
  "review_notes",
  "started_at",
  "submitted_at",
  "duration_taken_sec",
  "turn_number",
  "after_turn",
  "insert_order",
  "deleted_turn"
] as const;

export const RESPONSE_VIBE_REVIEW_EXPORT_COLUMNS = [
  "review_id",
  "call_id",
  "org_name",
  "agent_name",
  "call_duration_sec",
  "call_created_at_ist",
  "reviewer_name",
  "reviewer_email",
  "review_mode",
  "vibe_score",
  "vibe_score_reason",
  "issue_type",
  "issue_timestamp",
  "issue_recording_link",
  "pronunciation_correct_form",
  "pronunciation_word_heard",
  "content_tag",
  "tone_tag",
  "latency_reaction",
  "response_error_type",
  "response_error_subtype",
  "response_error_explanation",
  "transcription_error_type",
  "audio_unclear",
  "audio_said",
  "transcripted",
  "metric_rating_name",
  "metric_rating_value",
  "metric_rating_reason",
  "issue_notes",
  "review_notes",
  "started_at",
  "submitted_at",
  "duration_taken_sec",
  "turn_number",
  "after_turn",
  "insert_order",
  "deleted_turn"
] as const;

export const REVIEW_EXPORT_COLUMNS_BY_MODE = {
  pronunciation_tone: PRONUNCIATION_TONE_REVIEW_EXPORT_COLUMNS,
  timing_transcription: TIMING_TRANSCRIPTION_REVIEW_EXPORT_COLUMNS,
  response_vibe: RESPONSE_VIBE_REVIEW_EXPORT_COLUMNS
} as const;

export const REVIEW_EXPORT_COLUMNS = PRONUNCIATION_TONE_REVIEW_EXPORT_COLUMNS;

export function parseTurns(transcript = "") {
  const turns: Array<{ role: string; text: string }> = [];
  const text = transcript.replace(/\r/g, "\n").trim();
  if (!text) return turns;

  const markerPattern = /\b(assistant|user)\s*:/gi;
  const markers = [...text.matchAll(markerPattern)];
  if (!markers.length) {
    return [{ role: "assistant", text }];
  }

  const prefix = text.slice(0, markers[0].index).trim();
  if (prefix) {
    turns.push({ role: "assistant", text: prefix });
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const nextMarker = markers[index + 1];
    const role = String(marker[1]).toLowerCase();
    const start = marker.index + marker[0].length;
    const end = nextMarker ? nextMarker.index : text.length;
    const turnText = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (turnText) {
      turns.push({ role, text: turnText });
    }
  }

  return turns;
}

export function timestampToSeconds(timestamp?: string | null) {
  if (!timestamp) return null;
  const parts = timestamp.split(":").map((part) => part.trim());
  if (!parts.length || parts.some((part) => !/^\d+$/.test(part))) return null;
  const values = parts.map(Number);
  if (values.length === 2) return values[0] * 60 + values[1];
  if (values.length === 3) return values[0] * 3600 + values[1] * 60 + values[2];
  return null;
}

export function recordingLinkAt(recordingUrl?: string | null, timestamp?: string | null) {
  const seconds = timestampToSeconds(timestamp);
  if (!recordingUrl || seconds === null) return "";
  return `${recordingUrl}#t=${seconds}`;
}

function normalizeIssues(issues: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(issues)) return issues as Array<Record<string, unknown>>;
  if (typeof issues === "string") {
    try {
      const parsed = JSON.parse(issues);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeReviewMode(mode?: string | null) {
  const normalized = String(mode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if ([
    "timing_transcription",
    "latency_barge_in_transcription",
    "latency_bargein_transcription",
    "latency_barge_in",
    "latency_bargein",
    "timing",
    "transcription",
    "vibe_transcription"
  ].includes(normalized)) {
    return "timing_transcription";
  }
  if ([
    "response_vibe",
    "response_appropriateness_vibe",
    "response_appropriateness",
    "overall_vibe",
    "vibe"
  ].includes(normalized)) {
    return "response_vibe";
  }
  return "pronunciation_tone";
}

export function exportRowsFromReviews(reviews: ReviewRow[], mode?: string | null) {
  const rows: Array<Record<string, unknown>> = [];
  const requestedMode = mode ? normalizeReviewMode(mode) : "";

  for (const review of reviews) {
    const reviewMode = normalizeReviewMode(review.review_mode);
    if (requestedMode && reviewMode !== requestedMode) continue;

    const call = (review.calls || {}) as Partial<CallRow>;
    const issues = normalizeIssues(review.issues_json);
    const issueRows = issues.length ? issues : [{}];

    for (const issue of issueRows) {
      const timestamp = String(issue.timestamp || "");
      rows.push({
        review_id: review.id,
        call_id: review.call_id,
        org_name: call.org_name || "",
        agent_name: call.agent_name || "",
        call_duration_sec: call.duration_sec || "",
        call_created_at_ist: call.created_at_ist || "",
        reviewer_name: review.reviewer_name || "",
        reviewer_email: review.reviewer_email || "",
        review_mode: review.review_mode || "",
        vibe_score: review.vibe_score || "",
        vibe_score_reason: review.notes || "",
        issue_type: issue.type === "interruption" ? "barge_in" : issue.type || "",
        issue_timestamp: timestamp,
        issue_recording_link: recordingLinkAt(call.recording_url, timestamp),
        pronunciation_correct_form: issue.correct_form || "",
        pronunciation_word_heard: issue.word_heard || "",
        content_tag: issue.content_tag || "",
        tone_tag: issue.tag || "",
        latency_reaction: issue.reaction || "",
        response_error_type: issue.response_error_type || "",
        response_error_subtype: issue.response_error_subtype || "",
        response_error_explanation: issue.error_explanation || "",
        metric_rating_name: issue.metric_label || "",
        metric_rating_value: issue.rating || "",
        metric_rating_reason: issue.reason || "",
        transcription_error_type: issue.transcription_error_type || "",
        audio_unclear: issue.audio_unclear || "",
        audio_said: issue.audio_said || "",
        transcripted: issue.transcripted || "",
        issue_notes: issue.notes || "",
        review_notes: review.notes || "",
        started_at: review.started_at || "",
        submitted_at: review.submitted_at || "",
        duration_taken_sec: review.duration_taken_sec || "",
        turn_number: issue.turn_number || "",
        after_turn: issue.after_turn || "",
        insert_order: issue.insert_order || "",
        deleted_turn: issue.deleted_turn || ""
      });
    }
  }

  return rows;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: readonly string[] = REVIEW_EXPORT_COLUMNS) {
  const escapeCell = (value: unknown) => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(","))
  ].join("\n");
}
