import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Host-based routing for the realloop.in product subdomains.
//
//   review.realloop.in       -> the reviewer app (served at "/"), incl. /transcribe
//   portal.realloop.in       -> the enterprise dashboard (/portal)
//   marketplace.realloop.in  -> the "work with us" apply flow (/marketplace/join)
//
// Only the bare root "/" of each subdomain is remapped (see `matcher` below).
// Every deeper path — /transcribe, /portal/agents, /api/*, /_next/*, static
// assets — never reaches this function, so the app's absolute links keep
// working unchanged. The default Vercel host and localhost fall through to the
// reviewer app exactly as before, so nothing about the current deployment
// changes until these subdomains are pointed at Vercel.
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const url = req.nextUrl.clone();

  if (host.startsWith("portal.")) {
    url.pathname = "/portal";
    return NextResponse.rewrite(url);
  }
  if (host.startsWith("marketplace.")) {
    url.pathname = "/marketplace/join";
    return NextResponse.rewrite(url);
  }
  // review.* and the default host: reviewer app at "/", untouched.
  return NextResponse.next();
}

// Only the root path is host-routed; all other paths pass straight through.
export const config = { matcher: ["/"] };
