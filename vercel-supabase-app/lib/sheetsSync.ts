import { exportRowsFromReviews, REVIEW_EXPORT_COLUMNS, ReviewRow } from "./audit";

export async function syncReviewsToSheets(reviews: ReviewRow[]) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      ok: false,
      configured: false,
      synced_reviews: 0,
      rows: 0,
      error: "GOOGLE_SHEETS_WEBHOOK_URL is not configured"
    };
  }

  const rows = exportRowsFromReviews(reviews);
  if (!rows.length) {
    return { ok: true, configured: true, synced_reviews: 0, rows: 0 };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columns: REVIEW_EXPORT_COLUMNS, rows })
  });

  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      synced_reviews: 0,
      rows: rows.length,
      error: await response.text()
    };
  }

  return {
    ok: true,
    configured: true,
    synced_reviews: new Set(reviews.map((review) => review.id)).size,
    rows: rows.length
  };
}

