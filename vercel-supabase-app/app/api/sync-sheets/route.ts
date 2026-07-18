import { NextResponse } from "next/server";
import { ReviewRow } from "../../../lib/audit";
import { normalizeAuditMode } from "../../../lib/callImport";
import { syncReviewsToSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const mode = payload.audit_mode || payload.review_mode;
  // resync_all re-exports already-synced reviews too (e.g. to backfill newly
  // added export columns). Paged via limit/offset so each request stays within
  // function and Apps Script execution limits.
  const resyncAll = payload.resync_all === true;
  const limit = Math.max(0, Math.min(Number(payload.limit) || 0, 200));
  const offset = Math.max(0, Number(payload.offset) || 0);
  const supabase = supabaseAdmin();
  let query = supabase
    .from("reviews")
    .select("*, calls(*)")
    .order("submitted_at", { ascending: true });

  if (!resyncAll) {
    query = query.is("sheets_synced_at", null);
  }
  if (limit) {
    query = query.range(offset, offset + limit - 1);
  }

  if (mode) {
    query = query.eq("review_mode", normalizeAuditMode(mode));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reviews = (data || []) as ReviewRow[];
  const result = await syncReviewsToSheets(reviews);
  if (result.ok && reviews.length) {
    const ids = reviews.map((review) => review.id);
    await supabase
      .from("reviews")
      .update({ sheets_synced_at: new Date().toISOString(), sheets_sync_error: null })
      .in("id", ids);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
