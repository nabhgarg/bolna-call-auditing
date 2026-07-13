import { exportRowsFromReviews, normalizeReviewMode, REVIEW_EXPORT_COLUMNS_BY_MODE, ReviewRow } from "./audit";
import { normalizeAuditMode, normalizeCallRows } from "./callImport";

// Current sheet webhook (experts phase). Not a secret - it's a public Apps Script
// endpoint. GOOGLE_SHEETS_WEBHOOK_OVERRIDE env var wins if set, so the sheet can be
// swapped without a code change when needed.
const SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwPwK8GBClvQbI7vawfXFdfZBwyRumgfWx5Z6BLlbq1YJfXCc8OrnEP-if4qsvA-hEMQg/exec";

function sheetsConfig() {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_OVERRIDE || SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || "";
  return { webhookUrl, secret };
}

async function postToSheets(payload: Record<string, unknown>) {
  const { webhookUrl, secret } = sheetsConfig();
  if (!webhookUrl) {
    return {
      ok: false,
      configured: false,
      error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured"
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, ...payload })
  });

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      configured: true,
      error: String(data.error || text || response.statusText)
    };
  }

  return { ok: true, configured: true, data };
}

export async function importCallsFromSheets(auditMode = "pronunciation_tone") {
  const mode = normalizeAuditMode(auditMode);
  const sheetNameByMode: Record<string, string> = {
    pronunciation_tone: "Calls_Pronunciation_Tone",
    timing_transcription: "Calls_Timing_Transcription",
    response_vibe: "Calls_Response_Vibe"
  };
  const sheetName = sheetNameByMode[mode] || "Calls_Pronunciation_Tone";
  const result = await postToSheets({ action: "readCalls", audit_mode: mode, sheet_name: sheetName });
  if (!result.ok) {
    return { ...result, imported_rows: 0, calls: [] };
  }

  const calls = Array.isArray(result.data?.calls) ? result.data.calls as Array<Record<string, unknown>> : [];
  const importedSheetName = String(result.data?.sheet_name || sheetName);
  return {
    ok: true,
    configured: true,
    imported_rows: calls.length,
    audit_mode: mode,
    sheet_name: importedSheetName,
    calls: normalizeCallRows(calls, mode).map((row) => ({
      ...row,
      source_sheet: row.source_sheet || importedSheetName
    }))
  };
}

// Sends a login OTP through the Apps Script webhook (MailApp on the sheet owner's
// Gmail) so no separate email service is needed.
export async function sendOtpEmail(email: string, code: string) {
  const result = await postToSheets({ action: "sendOtp", email, code });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const };
}

// Reads the optional "Reviewers" tab (columns: email, name, role, active) so the
// login allowlist can be managed from the spreadsheet instead of SQL.
export async function importReviewersFromSheets() {
  const result = await postToSheets({ action: "readCalls", sheet_name: "Reviewers" });
  if (!result.ok) {
    return { ok: false as const, found: false, error: result.error, reviewers: [] };
  }
  // The Apps Script falls back to the default Calls sheet when the requested tab
  // is missing; only trust the payload if the Reviewers tab itself came back.
  const sheetName = String((result.data as Record<string, unknown>)?.sheet_name || "");
  if (sheetName !== "Reviewers") {
    return { ok: true as const, found: false, reviewers: [] };
  }

  const rows = Array.isArray((result.data as Record<string, unknown>)?.calls)
    ? ((result.data as Record<string, unknown>).calls as Array<Record<string, unknown>>)
    : [];
  const reviewers = rows
    .map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const header = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
        normalized[header] = String(value ?? "").trim();
      }
      const email = (normalized.email || normalized.email_id || normalized.reviewer_email || "").toLowerCase();
      if (!email || !email.includes("@")) return null;
      const displayName = normalized.display_name || normalized.name || normalized.reviewer_name || email;
      const role = (normalized.role || "scorer").toLowerCase();
      const activeRaw = (normalized.active || normalized.is_active || "yes").toLowerCase();
      const isActive = !["no", "false", "0", "inactive"].includes(activeRaw);
      return { email, display_name: displayName, role, is_active: isActive };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return { ok: true as const, found: true, reviewers };
}

export async function syncReviewsToSheets(reviews: ReviewRow[]) {
  if (!reviews.length) {
    return { ok: true, configured: true, synced_reviews: 0, rows: 0 };
  }

  let totalRows = 0;
  let configured = true;
  const syncedReviewIds = new Set<number>();

  for (const mode of ["pronunciation_tone", "timing_transcription", "response_vibe"] as const) {
    const modeReviews = reviews.filter((review) => normalizeReviewMode(review.review_mode) === mode);
    if (!modeReviews.length) continue;

    const rows = exportRowsFromReviews(modeReviews, mode);
    totalRows += rows.length;
    const result = await postToSheets({
      action: "appendReviews",
      review_mode: mode,
      columns: REVIEW_EXPORT_COLUMNS_BY_MODE[mode],
      rows
    });

    if (!result.ok) {
      return {
        ok: false,
        configured: result.configured,
        synced_reviews: 0,
        rows: totalRows,
        error: result.error
      };
    }

    configured = result.configured;
    modeReviews.forEach((review) => syncedReviewIds.add(review.id));
  }

  return {
    ok: true,
    configured,
    synced_reviews: syncedReviewIds.size,
    rows: totalRows
  };
}
