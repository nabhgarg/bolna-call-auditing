import {
  exportRowsByTab, normalizeReviewMode, ReviewRow,
  VIBE_TAB, ISSUE_TAB, TRANSCRIPTION_TAB,
  VIBE_TAB_COLUMNS, ISSUE_TAB_COLUMNS, TRANSCRIPTION_TAB_COLUMNS
} from "./audit";
import { applyEmailAlias, normalizeAuditMode, normalizeCallRows } from "./callImport";

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

// Apps Script answers over a 302 to a one-shot googleusercontent URL, and that
// second hop fails intermittently · measured 2 of 5 identical requests coming
// back as a 3KB HTML error page instead of JSON, same payload, same second.
// The script itself never ran in those cases, so the call is safe to repeat.
//
// A retry is only safe because of that distinction, so it is drawn carefully:
//   - transport failure (HTML, empty body, 5xx, network throw) -> the script
//     did not run, retry
//   - a real JSON {ok:false} -> the script DID run and rejected us, never retry
// Retrying a genuine rejection is how you double-send an email.
const SHEETS_ATTEMPTS = 3;
const looksLikeHtml = (s: string) => /^\s*</.test(s);

async function postToSheets(payload: Record<string, unknown>) {
  const { webhookUrl, secret } = sheetsConfig();
  if (!webhookUrl) {
    return {
      ok: false,
      configured: false,
      error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured"
    };
  }

  let lastError = "";
  for (let attempt = 1; attempt <= SHEETS_ATTEMPTS; attempt++) {
    let text = "";
    let status = 0;
    let statusText = "";
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret, ...payload })
      });
      status = response.status;
      statusText = response.statusText;
      text = await response.text();
    } catch (e) {
      lastError = `network: ${String((e as Error)?.message || e)}`;
      if (attempt < SHEETS_ATTEMPTS) { await wait(attempt); continue; }
      return { ok: false, configured: true, error: lastError };
    }

    // Parsed JSON means the script ran · its answer is final either way.
    let data: Record<string, unknown> | null = null;
    if (text && !looksLikeHtml(text)) {
      try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = null; }
    }
    if (data) {
      if (status >= 200 && status < 300 && data.ok !== false) {
        return { ok: true, configured: true, data };
      }
      return {
        ok: false,
        configured: true,
        error: String(data.error || statusText || `HTTP ${status}`)
      };
    }

    // No usable JSON · the redirect hop dropped it. The script did not run.
    lastError = looksLikeHtml(text)
      ? `Apps Script redirect returned HTML instead of JSON (HTTP ${status})`
      : `Empty response from Apps Script (HTTP ${status})`;
    if (attempt < SHEETS_ATTEMPTS) { await wait(attempt); continue; }
  }

  return { ok: false, configured: true, error: `${lastError} after ${SHEETS_ATTEMPTS} attempts` };
}

/** 400ms, then 1200ms · the hop either works immediately or needs a moment. */
function wait(attempt: number) {
  return new Promise((r) => setTimeout(r, attempt === 1 ? 400 : 1200));
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

// General reviewer mail (the weekly report), through the same Apps Script
// MailApp the OTP already uses. Requires a `sendMail` case in the script:
//
//   if (payload.action === "sendMail") return jsonOutput(sendMail(payload));
//
//   function sendMail(payload) {
//     const email = String(payload.email || "").trim();
//     const subject = String(payload.subject || "").trim();
//     const text = String(payload.text || "");
//     if (!email || !subject || !text) return { ok: false, error: "email, subject and text required" };
//     MailApp.sendEmail({ to: email, subject: subject, body: text });
//     return { ok: true };
//   }
//
// Until it is added AND redeployed, doPost answers {ok:false,"Unknown action"},
// which postToSheets already surfaces as an error · so a send can never
// silently no-op.
// Who the weekly report comes from.
//
// MailApp sends as the account that owns the Apps Script. `from` is only
// honoured when the address is that account or one of its verified "send mail
// as" aliases · Google silently falls back to the owner otherwise, so this is
// a request, not a guarantee. Overridable without a deploy.
const REPORT_FROM = process.env.REPORT_FROM_EMAIL || "nabh@realloop.in";
const REPORT_FROM_NAME = process.env.REPORT_FROM_NAME || "RealLoop";

export async function sendReviewerMail(email: string, subject: string, text: string) {
  const result = await postToSheets({
    action: "sendMail",
    email, subject, text,
    from: REPORT_FROM,
    fromName: REPORT_FROM_NAME,
    replyTo: REPORT_FROM
  });
  if (!result.ok) {
    const hint = /unknown action/i.test(String(result.error))
      ? "Apps Script has no 'sendMail' case yet — add it and redeploy a new version"
      : String(result.error);
    return { ok: false as const, error: hint };
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
      const email = applyEmailAlias((normalized.email || normalized.email_id || normalized.reviewer_email || "").toLowerCase());
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
  const syncedReviewIds = new Set<string>();

  // One tab per kind of work · vibe scores, issue findings, transcription
  // segments. Each carries only its own columns, and the two grains inside a
  // quality review (one scored call, n findings) are kept apart.
  const split = exportRowsByTab(reviews);
  const targets: Array<[string, readonly string[], Array<Record<string, unknown>>, string]> = [
    [VIBE_TAB, VIBE_TAB_COLUMNS, split.vibe, "response_vibe"],
    [ISSUE_TAB, ISSUE_TAB_COLUMNS, split.issues, "response_vibe"],
    [TRANSCRIPTION_TAB, TRANSCRIPTION_TAB_COLUMNS, split.transcription, "timing_transcription"]
  ];

  for (const [tab, columns, rows, mode] of targets) {
    if (!rows.length) continue;
    totalRows += rows.length;
    const result = await postToSheets({
      action: "appendReviews",
      sheet_name: tab,
      review_mode: mode,
      columns,
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
    rows.forEach((r) => syncedReviewIds.add(String(r.review_id)));
  }

  return {
    ok: true,
    configured,
    synced_reviews: syncedReviewIds.size,
    rows: totalRows
  };
}
