import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import items from "../../../../lib/merlin-items.json";
import key from "../../../../lib/merlin-key.json";

export const dynamic = "force-dynamic";

// Ops-side aggregate for the Merlin router audit. This is the ONE place the
// unblinding key is imported: ops is internal (expert login), reviewers on
// /merlin never see arm identities. Requires a select policy on
// merlin_judgments (supabase/merlin.sql).

const PROBES = new Set(["deploy-probe", "probe-direct", "testreviewer"]);

const SIDE: Record<string, "A" | "B" | "tie"> = {
  "A much better": "A", "A slightly better": "A", "Tie": "tie",
  "B slightly better": "B", "B much better": "B"
};

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("merlin_judgments")
    .select("item_id,reviewer,preference,confidence,created_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).filter((r) => !PROBES.has(String(r.reviewer).trim().toLowerCase()));
  const keyMap = key as Record<string, { A_arm: string; B_arm: string; pair_type: string; prompt_id: string }>;

  const perReviewer: Record<string, number> = {};
  // merlin = Magic vs its comparison arm; models = Haiku 4.5 vs Sonnet 5.
  const merlin = { magicWin: 0, tie: 0, magicLoss: 0 };
  const models = { haikuWin: 0, tie: 0, sonnetWin: 0 };

  for (const r of rows) {
    perReviewer[r.reviewer] = (perReviewer[r.reviewer] || 0) + 1;
    const k = keyMap[r.item_id];
    const side = SIDE[r.preference];
    if (!k || !side) continue;
    const winner = side === "tie" ? "tie" : side === "A" ? k.A_arm : k.B_arm;
    if (k.pair_type === "H45_VS_S5") {
      if (winner === "tie") models.tie++;
      else if (winner.startsWith("claude-haiku")) models.haikuWin++;
      else models.sonnetWin++;
    } else {
      if (winner === "tie") merlin.tie++;
      else if (winner === "MAGIC") merlin.magicWin++;
      else merlin.magicLoss++;
    }
  }

  const reviewers = Object.entries(perReviewer)
    .map(([name, done]) => ({ name, done }))
    .sort((a, b) => b.done - a.done);

  return NextResponse.json(
    {
      itemsLive: items.length,
      judgments: rows.length,
      reviewers,
      merlin,
      models,
      lastJudgmentAt: rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), "")
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
