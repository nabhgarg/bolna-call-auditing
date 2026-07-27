import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Host-based routing for the realloop.in product subdomains.
//
//   realloop.in / www.       -> the marketing landing (public/apex.html)
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

  // Apex (and www): serve the ported marketing landing, plus the one deeper
  // path the apex owns · the YC partner demo shell. A rewrite, not a redirect:
  // the address bar has to keep reading realloop.in/ycpartners for the whole
  // session, because the shell fakes its own URL bar per tab.
  if (host === "realloop.in" || host === "www.realloop.in") {
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    url.pathname = path === "/ycpartners" ? "/ycpartners.html" : "/apex.html";
    return NextResponse.rewrite(url);
  }
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

// Only the root path and the apex-owned /ycpartners are host-routed; every
// other path passes straight through untouched.
export const config = { matcher: ["/", "/ycpartners", "/ycpartners/"] };
