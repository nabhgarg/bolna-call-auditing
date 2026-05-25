import { exportRowsFromReviews, REVIEW_EXPORT_COLUMNS, ReviewRow } from "./audit";
import { normalizeCallRows } from "./callImport";

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

export async function importCallsFromSheets() {
  const result = await postToSheets({ action: "readCalls" });
  if (!result.ok) {
    return { ...result, imported_rows: 0, calls: [] };
  }

  const calls = Array.isArray(result.data?.calls) ? result.data.calls as Array<Record<string, unknown>> : [];
  return {
    ok: true,
    configured: true,
    imported_rows: calls.length,
    calls: normalizeCallRows(calls)
  };
}

export async function syncReviewsToSheets(reviews: ReviewRow[]) {
  const rows = exportRowsFromReviews(reviews);
  if (!rows.length) {
    return { ok: true, configured: true, synced_reviews: 0, rows: 0 };
  }

  const result = await postToSheets({ action: "appendReviews", columns: REVIEW_EXPORT_COLUMNS, rows });
  if (!result.ok) {
    return {
      ok: false,
      configured: result.configured,
      synced_reviews: 0,
      rows: rows.length,
      error: result.error
    };
  }

  return {
    ok: true,
    configured: true,
    synced_reviews: new Set(reviews.map((review) => review.id)).size,
    rows: rows.length
  };
}
