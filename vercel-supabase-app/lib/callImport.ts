export const CALL_IMPORT_COLUMNS = [
  "execution_id",
  "assigned_reviewer",
  "org_name",
  "agent_id",
  "agent_name",
  "duration_sec",
  "created_at_ist",
  "to_number",
  "status",
  "transcriber_language",
  "transcript",
  "recording_url",
  "agent_interrupted_user_count",
  "audit_mode",
  "source_sheet",
  "telemetry_json"
] as const;

const headerAliases: Record<string, string> = {
  row_id: "queue_id",
  queue_id: "queue_id",
  id: "execution_id",
  call_id: "execution_id",
  execution_ic: "execution_id",
  executionid: "execution_id",
  execution_id: "execution_id",
  assigned_re: "assigned_reviewer",
  assigned_to: "assigned_reviewer",
  assignee: "assigned_reviewer",
  reviewer: "assigned_reviewer",
  reviewer_name: "assigned_reviewer",
  assigned_reviewer: "assigned_reviewer",
  client: "org_name",
  client_name: "org_name",
  org: "org_name",
  org_name: "org_name",
  organization: "org_name",
  agent: "agent_name",
  agent_name: "agent_name",
  agend_id: "agent_id",
  agent_id: "agent_id",
  duration: "duration_sec",
  duration_sec: "duration_sec",
  created_at: "created_at_ist",
  created_at_ist: "created_at_ist",
  phone_number: "to_number",
  to_number: "to_number",
  status: "status",
  language: "transcriber_language",
  transcriber_language: "transcriber_language",
  transcript: "transcript",
  recording: "recording_url",
  recording_u: "recording_url",
  recording_ur: "recording_url",
  recording_url: "recording_url",
  audio_url: "recording_url",
  agent_interrupted_user_count: "agent_interrupted_user_count",
  audit_mode: "audit_mode",
  review_mode: "audit_mode",
  import_mode: "audit_mode",
  source: "source_sheet",
  source_sheet: "source_sheet",
  data: "telemetry_json",
  telemetry: "telemetry_json",
  telemetry_json: "telemetry_json"
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function normalizeAuditMode(value?: unknown) {
  const normalized = normalizeHeader(String(value || ""));
  if ([
    "pronunciation_tone",
    "pronunciation_and_tone",
    "pronunciation",
    "tone",
    "technical_audio"
  ].includes(normalized)) {
    return "pronunciation_tone";
  }
  if ([
    "timing_transcription",
    "latency_barge_in_transcription",
    "latency_bargein_transcription",
    "latency_barge_in",
    "latency_bargein",
    "timing",
    "transcription",
    "vibe_transcription",
    "vibe_and_transcription",
    "vibe_transcript"
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

export function normalizeCallRows(calls: Array<Record<string, unknown>>, auditMode = "pronunciation_tone") {
  const mode = normalizeAuditMode(auditMode);
  return calls
    .map((call) => {
      const row: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(call)) {
        const normalized = normalizeHeader(key);
        const target = headerAliases[normalized];
        if (target) row[target] = normalizeCell(value);
      }
      for (const column of CALL_IMPORT_COLUMNS) row[column] = row[column] ?? "";
      if (String(row.duration_sec || "").trim() === "") {
        row.duration_sec = null;
      } else {
        const duration = Number(row.duration_sec);
        row.duration_sec = Number.isFinite(duration) ? duration : null;
      }
      if (String(row.agent_interrupted_user_count || "").trim() === "") {
        row.agent_interrupted_user_count = null;
      } else {
        const interruptions = Number(row.agent_interrupted_user_count);
        row.agent_interrupted_user_count = Number.isFinite(interruptions) ? interruptions : null;
      }
      row.audit_mode = normalizeAuditMode(row.audit_mode || mode);
      // keep only parseable telemetry blobs (sheet cells can truncate large JSON)
      if (row.telemetry_json) {
        try { JSON.parse(String(row.telemetry_json)); } catch { row.telemetry_json = null; }
      } else {
        row.telemetry_json = null;
      }
      row.imported_at = new Date().toISOString();
      return row;
    })
    .filter((row) => String(row.execution_id || "").trim());
}
