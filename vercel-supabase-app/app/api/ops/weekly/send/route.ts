import { NextResponse } from "next/server";
import { sendReviewerMail } from "../../../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { bodyFor, subjectFor, WeeklyRow } from "../../../../../lib/weekly-report";

export const dynamic = "force-dynamic";

// Sends the weekly report. Deliberately dumb: it does NOT recompute anything ·
// it takes the exact rows the operator previewed and mails those, so nobody
// can approve one set of numbers and have a different set go out.
//
// `dryRun` renders every message and reports what WOULD be sent without
// touching the mail transport. That is the default · a caller has to ask for
// a real send explicitly.

// Where "already sent" is remembered.
//
// There is no table for this yet, so it rides in `reviews` as a marker row:
// review_mode "weekly_report_sent", call_id the week, reviewer_email the
// recipient. Ugly, and deliberately so · it is one row per person per week,
// it is excluded everywhere real reviews are counted (every query filters on
// review_mode), and it moves to the events table with the new schema.
const SENT_MODE = "weekly_report_sent";

async function sentThisWeek(weekStart: string): Promise<Set<string>> {
  try {
    const { data } = await supabaseAdmin()
      .from("reviews")
      .select("reviewer_email")
      .eq("review_mode", SENT_MODE)
      .eq("call_id", weekStart);
    return new Set((data || []).map((r: any) => String(r.reviewer_email || "").toLowerCase()));
  } catch {
    // Never let bookkeeping block a send · worst case is the guard is absent
    // for this run, which is exactly where we were before.
    return new Set<string>();
  }
}

async function markSent(weekStart: string, email: string) {
  try {
    await supabaseAdmin().from("reviews").insert({
      call_id: weekStart,
      reviewer_name: "system",
      reviewer_email: email,
      review_mode: SENT_MODE,
      notes: `weekly report sent ${new Date().toISOString()}`,
      issues_json: [],
      submitted_at: new Date().toISOString()
    });
  } catch { /* the mail already went · a missing marker is not worth failing on */ }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const rows: WeeklyRow[] = Array.isArray(payload.rows) ? payload.rows : [];
    const weekStart = String(payload.weekStart || "");
    const weekEnd = String(payload.weekEnd || "");
    const dryRun = payload.dryRun !== false;
    const only: string[] = Array.isArray(payload.only) ? payload.only.map((s: string) => String(s).toLowerCase()) : [];

    if (!rows.length || !weekStart || !weekEnd) {
      return NextResponse.json({ error: "rows, weekStart and weekEnd are required" }, { status: 400 });
    }

    const targets = rows.filter((r) => r.active !== false && (!only.length || only.includes(String(r.email).toLowerCase())));
    const results: Array<{ email: string; ok: boolean; error?: string; skipped?: boolean }> = [];

    // Already-sent guard. The webhook's redirect hop is flaky, so a partly
    // failed run WILL be re-run · without this, everyone who succeeded the
    // first time gets a second copy. Keyed on week + recipient, so re-running
    // only retries the people who actually failed.
    const already = dryRun ? new Set<string>() : await sentThisWeek(weekStart);

    for (const r of targets) {
      const key = String(r.email).toLowerCase();
      if (already.has(key)) { results.push({ email: r.email, ok: true, skipped: true }); continue; }
      const subject = subjectFor(r, weekStart, weekEnd);
      const body = bodyFor(r, weekStart, weekEnd);
      if (dryRun) { results.push({ email: r.email, ok: true }); continue; }
      const sent = await sendReviewerMail(r.email, subject, body);
      results.push({ email: r.email, ok: sent.ok, error: sent.ok ? undefined : sent.error });
      if (sent.ok) await markSent(weekStart, key);
    }

    return NextResponse.json({
      dryRun,
      weekStart, weekEnd,
      attempted: results.length,
      sent: results.filter((x) => x.ok && !x.skipped).length,
      skipped: results.filter((x) => x.skipped).length,
      failed: results.filter((x) => !x.ok),
      results
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
