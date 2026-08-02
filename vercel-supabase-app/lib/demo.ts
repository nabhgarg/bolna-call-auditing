// Demo session for the YC partner shell (public/ycpartners.html).
//
// Partners have no accounts and must never meet a login wall inside an iframe,
// so four screens accept a shared token instead: ?demo=YCPARTNER2026.
//
// The token is in the shell's HTML source, so treat it as public. It buys
// exactly two things and nothing else:
//   - READ access to the same anonymised program data a client already sees
//     (agent archetype labels, no real brand or reviewer names)
//   - WRITES that are deliberately dead-ended · see isDemoRequest() callers,
//     which drop the write rather than let a partner enqueue reviewer work,
//     notifications or billing.
// It grants no reviewer identity, no expert role, no ground truth and no admin
// route. Rotate by setting DEMO_TOKEN in the environment and editing the shell.
export const DEMO_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN || "YCPARTNER2026";

// One demo session, several front doors. Each partner shell carries its own
// token (public/ycpartners.html, public/spcpartners.html) so a link can be
// revoked for one audience without killing the other · the session it buys is
// identical: same anonymised reads, same dead-ended writes.
const DEMO_TOKENS = new Set([DEMO_TOKEN, "SPCPARTNER2026"]);

const KEY = "rlDemo";

/** Names for the demo transcription queue.
 *
 *  The real `agent_name` on these rows is the client's own campaign handle, so
 *  it is blanked for demo requests · but "call, call, call" down the sidebar
 *  tells a partner nothing about what they are picking. These are archetype
 *  labels in the same vocabulary the client portal uses, describing what the
 *  call actually is. The audio and transcript are untouched and still carry
 *  real brand names · that is the reviewer's job and cannot be anonymised
 *  without destroying the work itself. */
export const DEMO_CALL_LABELS: Record<string, string> = {
  "250f1855-8fd4-4f91-b4f7-1ea54a2885ad": "Seller Activation · B2B Marketplace",
  "5a8a4036-3a4f-4b64-a6b5-d636e62da06f": "Seasonal Sale Outreach · D2C Fashion",
  "b97580b3-9346-430e-8cf2-bb0b5e193555": "Cart Recovery · D2C Jewellery"
};

/** Is somebody actually signed in? Read straight from storage rather than
 *  importing lib/role · role.ts already imports this file, and the cycle would
 *  leave one of the two undefined at module-eval time. */
function hasRealRole(): boolean {
  try { if (window.localStorage.getItem("auditReviewerRole")) return true; } catch {}
  try { return /(^|; )rl_role=[^;]/.test(document.cookie); } catch { return false; }
}

/** Drop the demo session. Called on any real login, and whenever a signed-in
 *  account is found while the flag is still lying around. */
export function clearDemo() {
  try { window.sessionStorage.removeItem(KEY); } catch {}
  try { document.cookie = `${KEY}=; path=/; max-age=0; SameSite=None; Secure`; } catch {}
  try { document.cookie = `${KEY}=; path=/; max-age=0`; } catch {}
}

/** True when this page is running inside the YC partner demo.
 *
 *  The URL is the source of truth · the shell re-appends ?demo= on every load
 *  and on "Reload tab", which is what makes the session survive a reload and
 *  never expire. Storage is only a best-effort carry for in-app navigation,
 *  and is expected to fail in a third-party frame under Safari's storage
 *  partitioning, which is why nothing depends on it. */
export function isDemo(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q && DEMO_TOKENS.has(q)) {
      try { window.sessionStorage.setItem(KEY, "1"); } catch {}
      // SameSite=None; Secure or the browser drops it as third-party. Session
      // cookie · no max-age, so it dies with the tab rather than lingering.
      try {
        if (window.location.protocol === "https:") document.cookie = `${KEY}=1; path=/; SameSite=None; Secure`;
      } catch {}
      return true;
    }
    // A signed-in account always beats a leftover demo flag.
    //
    // The flag is a host cookie on portal.realloop.in with no max-age, so it
    // outlives the demo tab and follows the browser into a real session. A
    // client who had opened the YC link would then get the partner tour, blanked
    // agent names, and · far worse · every write silently dropped, because the
    // API routes honour the same flag. Whoever has a role is a real user.
    if (hasRealRole()) { clearDemo(); return false; }
    if (window.sessionStorage.getItem(KEY) === "1") return true;
    return document.cookie.includes(`${KEY}=1`);
  } catch { return false; }
}

/** Append the demo token to an in-app URL, so navigating inside a framed
 *  screen keeps the session even where third-party storage is blocked. */
export function demoHref(href: string): string {
  if (!isDemo()) return href;
  return href + (href.includes("?") ? "&" : "?") + "demo=" + DEMO_TOKEN;
}

/** Server-side twin. A request is a demo request when it carries the token in
 *  the query string or the cookie the client set from it. */
export function isDemoRequest(request: Request): boolean {
  try {
    const q = new URL(request.url).searchParams.get("demo");
    if (q && DEMO_TOKENS.has(q)) return true;
  } catch {}
  return (request.headers.get("cookie") || "").includes(`${KEY}=1`);
}
