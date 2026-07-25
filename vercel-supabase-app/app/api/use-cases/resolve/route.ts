import { NextResponse } from "next/server";
import { resolveUseCase } from "../../../../lib/resolve-use-case";

export const dynamic = "force-dynamic";

// Thin wrapper · the resolver itself lives in lib/resolve-use-case.ts so the
// MCP tools (app/api/mcp) run exactly the same logic.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const out = await resolveUseCase(body as never);
  if (!out) return NextResponse.json({ error: "too short" }, { status: 400 });
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
