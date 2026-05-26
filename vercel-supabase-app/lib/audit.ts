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
  source_sheet?: string | null;
};

export type ReviewRow = {
  id: number;
  call_id: string;
  reviewer_name?: string | null;
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

export const REVIEW_EXPORT_COLUMNS = [
  "review_id",
  "call_id",
  "org_name",
  "agent_name",
  "call_duration_sec",
  "call_created_at_ist",
  "reviewer_name",
  "review_mode",
  "vibe_score",
  "flow_score",
  "llm_rating",
  "llm_error_type",
  "notes",
  "issue_type",
  "issue_timestamp",
  "issue_recording_link",
  "issue_payload_json",
  "started_at",
  "submitted_at",
  "duration_taken_sec"
] as const;

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

export function exportRowsFromReviews(reviews: ReviewRow[]) {
  const rows: Array<Record<string, unknown>> = [];

  for (const review of reviews) {
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
        review_mode: review.review_mode || "",
        vibe_score: review.vibe_score || "",
        flow_score: review.flow_score || "",
        llm_rating: review.llm_rating || "",
        llm_error_type: review.llm_error_type || "",
        notes: review.notes || "",
        issue_type: issue.type || "",
        issue_timestamp: timestamp,
        issue_recording_link: recordingLinkAt(call.recording_url, timestamp),
        issue_payload_json: JSON.stringify(issue),
        started_at: review.started_at || "",
        submitted_at: review.submitted_at || "",
        duration_taken_sec: review.duration_taken_sec || ""
      });
    }
  }

  return rows;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  const escapeCell = (value: unknown) => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  return [
    REVIEW_EXPORT_COLUMNS.join(","),
    ...rows.map((row) => REVIEW_EXPORT_COLUMNS.map((column) => escapeCell(row[column])).join(","))
  ].join("\n");
}
