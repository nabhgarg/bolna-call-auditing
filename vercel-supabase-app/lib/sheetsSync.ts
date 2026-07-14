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

// The base sheet splits assignments by track; import merges every track tab.
// The Apps Script serves its default tab when a requested one is missing, so a
// mismatched sheet_name in the response means "tab not found" — skip it then.
const CALL_TRACK_TABS = ["Calls_Vibe", "Calls_Issues", "Calls_Experts"];

export async function importCallsFromSheets(auditMode = "response_vibe") {
  const mode = normalizeAuditMode(auditMode);
  const allCalls: Array<Record<string, unknown>> = [];
  const sheetsRead: string[] = [];
  const seenTabs = new Set<string>();

  for (const tab of CALL_TRACK_TABS) {
    const result = await postToSheets({ action: "readCalls", audit_mode: mode, sheet_name: tab });
    if (!result.ok) {
      return { ...result, imported_rows: 0, calls: [], sheet_name: sheetsRead.join("+") };
    }
    const served = String(result.data?.sheet_name || "");
    if (served !== tab || seenTabs.has(served)) continue; // tab missing (fallback served) or already read
    seenTabs.add(served);
    const calls = Array.isArray(result.data?.calls) ? result.data.calls as Array<Record<string, unknown>> : [];
    if (!calls.length) continue;
    sheetsRead.push(`${tab}(${calls.length})`);
    for (const row of normalizeCallRows(calls, mode)) {
      allCalls.push({ ...row, source_sheet: row.source_sheet || tab });
    }
  }

  return {
    ok: true,
    configured: true,
    imported_rows: allCalls.length,
    audit_mode: mode,
    sheet_name: sheetsRead.join(" + ") || "no tabs found",
    calls: allCalls
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

// Reads the three role tabs (Reviewers_Vibe / Reviewers_Issues / Reviewers_Experts,
// columns: email, name, active). The tab a person sits in decides their role.
const REVIEWER_TABS: Array<[string, string]> = [
  ["Reviewers_Vibe", "reviewer"],
  ["Reviewers_Issues", "issue_logger"],
  ["Reviewers_Experts", "expert"]
];

export async function importReviewersFromSheets() {
  const reviewers: Array<{ email: string; display_name: string; role: string; is_active: boolean }> = [];
  let found = false;

  for (const [tab, role] of REVIEWER_TABS) {
    const result = await postToSheets({ action: "readCalls", sheet_name: tab });
    if (!result.ok) continue;
    const served = String((result.data as Record<string, unknown>)?.sheet_name || "");
    if (served !== tab) continue; // tab missing — the script served its fallback
    found = true;
    const rows = Array.isArray((result.data as Record<string, unknown>)?.calls)
      ? ((result.data as Record<string, unknown>).calls as Array<Record<string, unknown>>)
      : [];
    for (const row of rows) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const header = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
        normalized[header] = String(value ?? "").trim();
      }
      const email = (normalized.email || normalized.email_id || normalized.reviewer_email || "").toLowerCase();
      if (!email || !email.includes("@")) continue;
      const displayName = normalized.display_name || normalized.name || normalized.reviewer_name || email;
      const activeRaw = (normalized.active || normalized.is_active || "yes").toLowerCase();
      const isActive = !["no", "false", "0", "inactive"].includes(activeRaw);
      reviewers.push({ email, display_name: displayName, role, is_active: isActive });
    }
  }

  return { ok: true as const, found, reviewers };
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
