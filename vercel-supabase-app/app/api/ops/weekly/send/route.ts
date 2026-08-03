import { NextResponse } from "next/server";
import { sendReviewerMail } from "../../../../../lib/sheetsSync";
import { bodyFor, subjectFor, WeeklyRow } from "../../../../../lib/weekly-report";

export const dynamic = "force-dynamic";

// Sends the weekly report. Deliberately dumb: it does NOT recompute anything ·
// it takes the exact rows the operator previewed and mails those, so nobody
// can approve one set of numbers and have a different set go out.
//
// `dryRun` renders every message and reports what WOULD be sent without
// touching the mail transport. That is the default · a caller has to ask for
// a real send explicitly.

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
    const results: Array<{ email: string; ok: boolean; error?: string }> = [];

    for (const r of targets) {
      const subject = subjectFor(r, weekStart, weekEnd);
      const body = bodyFor(r, weekStart, weekEnd);
      if (dryRun) { results.push({ email: r.email, ok: true }); continue; }
      const sent = await sendReviewerMail(r.email, subject, body);
      results.push({ email: r.email, ok: sent.ok, error: sent.ok ? undefined : sent.error });
    }

    return NextResponse.json({
      dryRun,
      weekStart, weekEnd,
      attempted: results.length,
      sent: results.filter((x) => x.ok).length,
      failed: results.filter((x) => !x.ok),
      results
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
