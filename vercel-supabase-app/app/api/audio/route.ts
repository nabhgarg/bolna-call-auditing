import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy call recordings so the browser can decode them with Web Audio
// (the recording hosts don't send CORS headers). Host-allowlisted.
const ALLOWED_HOSTS = [
  "api.bolna.ai",
  "bolna-recordings-india.s3.ap-south-1.amazonaws.com"
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url") || "";
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.some((h) => parsed.hostname === h)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const upstream = await fetch(parsed.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, max-age=3600"
    }
  });
}
