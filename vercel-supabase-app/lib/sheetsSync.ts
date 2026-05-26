import { exportRowsFromReviews, normalizeReviewMode, REVIEW_EXPORT_COLUMNS_BY_MODE, ReviewRow } from "./audit";
import { normalizeAuditMode, normalizeCallRows } from "./callImport";

function sheetsConfig() {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
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

export async function importCallsFromSheets(auditMode = "technical_audio") {
  const mode = normalizeAuditMode(auditMode);
  const sheetName = mode === "vibe_transcription" ? "Calls_Vibe_Transcription" : "Calls_Technical_Audio";
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

export async function syncReviewsToSheets(reviews: ReviewRow[]) {
  if (!reviews.length) {
    return { ok: true, configured: true, synced_reviews: 0, rows: 0 };
  }

  let totalRows = 0;
  let configured = true;
  const syncedReviewIds = new Set<number>();

  for (const mode of ["technical_audio", "vibe_transcription"] as const) {
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
