import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Roster management · add a reviewer, or take one off the panel.
//
// The rule that shapes this whole file: **a reviewer's completed work is
// never touched.** Their reviews are the asset — they sit in the golden
// dataset and in every agreement number that has already been reported.
// Removing someone means two things only:
//
//   1. they can no longer sign in            (is_active = false)
//   2. their unfinished queue goes back      (audit_mode -> base__removed)
//
// Step 2 is what makes a removal safe to do mid-batch: calls sitting in a
// departed reviewer's queue are invisible work that nobody will ever do, and
// they keep showing up as "pending" forever. Releasing them puts them back in
// the pool where the next batch can pick them up.

const PAGE = 1000;

// Every paged read below orders by a UNIQUE key before slicing into pages.
// Ordering by a non-unique column (audit_mode, say) lets Postgres return rows
// in a different order per page, so the same row arrives twice and another is
// never seen at all. That is not theoretical: it hid 8 assigned calls from a
// reviewer's screen while the ops count still counted them as pending.
async function selectAll(build: () => any, orderBy?: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const q = build();
    const { data, error } = await (orderBy ? q.order(orderBy, { ascending: true }) : q)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const baseMode = (m: string) => String(m || "").split("::")[0];
const isActive = (m: string) => !baseMode(m).includes("__");
const tagOf = (m: string) => { const s = String(m || ""); return s.includes("::") ? s.slice(s.indexOf("::") + 2) : ""; };

const ROLES = new Set(["reviewer", "expert", "client", "viewer"]);

export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const [people, queue, reviews] = await Promise.all([
      selectAll(() => supabase.from("reviewers").select("email,display_name,role,is_active,created_at"), "email"),
      selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode,assigned_reviewer").order("audit_mode", { ascending: true }), "call_id"),
      selectAll(() => supabase.from("reviews").select("call_id,reviewer_email,review_mode"), "id")
    ]);

    const done = new Set<string>();
    const reviewed: Record<string, number> = {};
    for (const r of reviews) {
      const who = String(r.reviewer_email || "").toLowerCase();
      done.add(`${r.call_id}|${who}|${r.review_mode}`);
      reviewed[who] = (reviewed[who] || 0) + 1;
    }
    const open: Record<string, number> = {};
    for (const q of queue) {
      if (!isActive(q.audit_mode)) continue;
      const who = String(q.assigned_reviewer || "").toLowerCase();
      if (!done.has(`${q.call_id}|${who}|${baseMode(q.audit_mode)}`)) open[who] = (open[who] || 0) + 1;
    }

    return NextResponse.json({
      people: people
        .map((p: any) => ({
          email: p.email,
          name: p.display_name || p.email,
          role: p.role,
          active: p.is_active !== false,
          open: open[String(p.email).toLowerCase()] || 0,
          reviews: reviewed[String(p.email).toLowerCase()] || 0
        }))
        .sort((a: any, b: any) =>
          Number(b.active) - Number(a.active) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

/** Add someone to the panel. */
export async function POST(request: Request) {
  try {
    const p = await request.json();
    const email = String(p.email || "").trim().toLowerCase();
    const name = String(p.name || "").trim();
    const role = String(p.role || "reviewer");

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: "A display name is required · it is what the panel and every report call them." }, { status: 400 });
    if (!ROLES.has(role)) return NextResponse.json({ error: `Role must be one of ${[...ROLES].join(", ")}.` }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: existing } = await supabase.from("reviewers").select("email,is_active,display_name").eq("email", email).maybeSingle();

    if (existing) {
      // Re-adding someone who was removed is a reactivation, not a new row ·
      // their history stays attached to the same address.
      const { error } = await supabase
        .from("reviewers")
        .update({ is_active: true, display_name: name, role })
        .eq("email", email);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, reactivated: true, email, note: "This address was already on the panel and has been switched back on. Their past reviews were never removed." });
    }

    const { error } = await supabase.from("reviewers").insert({ email, display_name: name, role, is_active: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, added: true, email });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

/** Remove from / restore to the panel. Never deletes anything. */
export async function PATCH(request: Request) {
  try {
    const p = await request.json();
    const email = String(p.email || "").trim().toLowerCase();
    const active = p.active === true;
    const release = p.release !== false;   // release open work by default

    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data: who } = await supabase.from("reviewers").select("email,display_name,role").eq("email", email).maybeSingle();
    if (!who) return NextResponse.json({ error: "No such reviewer." }, { status: 404 });

    const { error } = await supabase.from("reviewers").update({ is_active: active }).eq("email", email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let released = 0;
    const stuck: string[] = [];

    if (!active && release) {
      // Their open rows, grouped by audit_mode so each becomes one PATCH.
      const queue = await selectAll(() =>
        supabase.from("call_audit_queue").select("call_id,audit_mode").eq("assigned_reviewer", email));
      const reviews = await selectAll(() =>
        supabase.from("reviews").select("call_id,review_mode").eq("reviewer_email", email), "id");
      const done = new Set(reviews.map((r: any) => `${r.call_id}|${r.review_mode}`));

      const byMode = new Map<string, string[]>();
      for (const q of queue) {
        if (!isActive(q.audit_mode)) continue;
        if (done.has(`${q.call_id}|${baseMode(q.audit_mode)}`)) continue;   // finished work stays as it is
        const list = byMode.get(q.audit_mode) || [];
        list.push(q.call_id);
        byMode.set(q.audit_mode, list);
      }

      const dup = (e: any) => String(e?.code) === "23505" || /duplicate|conflict/i.test(String(e?.message || ""));

      /** Retire one row. The queue is unique on (call_id, audit_mode), and a
       *  call can already carry a __removed row under the same tag — usually
       *  because an earlier release was interrupted. Colliding rows still have
       *  to leave the active set or they show as "open" forever, so they get a
       *  numbered variant of the same retired mode. */
      async function retire(callId: string, mode: string): Promise<boolean> {
        const target = `${baseMode(mode)}__removed::${tagOf(mode)}`;
        for (let n = 0; n < 6; n++) {
          const { data, error: e } = await supabase
            .from("call_audit_queue")
            .update({ audit_mode: n === 0 ? target : `${target}-${n}` })
            .eq("assigned_reviewer", email).eq("audit_mode", mode).eq("call_id", callId)
            .select("call_id");
          if (!e) return (data || []).length > 0;
          if (!dup(e)) throw new Error(e.message);
        }
        return false;
      }

      for (const [mode, ids] of byMode) {
        const target = `${baseMode(mode)}__removed::${tagOf(mode)}`;
        for (let i = 0; i < ids.length; i += 120) {
          const chunk = ids.slice(i, i + 120);
          const { data, error: pErr } = await supabase
            .from("call_audit_queue")
            .update({ audit_mode: target })
            .eq("assigned_reviewer", email).eq("audit_mode", mode).in("call_id", chunk)
            .select("call_id");
          if (!pErr) { released += (data || []).length; continue; }
          if (!dup(pErr)) {
            return NextResponse.json({ error: `Signed out, but releasing their queue failed after ${released} calls: ${pErr.message}`, released }, { status: 500 });
          }
          // One bad row fails the whole chunk, so fall back to row at a time.
          for (const id of chunk) {
            try { (await retire(id, mode)) ? released++ : stuck.push(id); }
            catch (e: any) {
              return NextResponse.json({ error: `Signed out, but releasing their queue failed after ${released} calls: ${e.message}`, released }, { status: 500 });
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true, email, active, released,
      stuck: stuck.length,
      note: active
        ? `${who.display_name || email} can sign in again. Any work released earlier stays released.`
        : `${who.display_name || email} can no longer sign in. ${released} unfinished call${released === 1 ? "" : "s"} went back to the pool.`
        + (stuck.length ? ` ${stuck.length} could not be released and are still in their queue.` : "")
        + " Their completed reviews are untouched."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
