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

const KEY = "rlDemo";

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
    if (q === DEMO_TOKEN) {
      try { window.sessionStorage.setItem(KEY, "1"); } catch {}
      // SameSite=None; Secure or the browser drops it as third-party. Session
      // cookie · no max-age, so it dies with the tab rather than lingering.
      try {
        if (window.location.protocol === "https:") document.cookie = `${KEY}=1; path=/; SameSite=None; Secure`;
      } catch {}
      return true;
    }
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
    if (new URL(request.url).searchParams.get("demo") === DEMO_TOKEN) return true;
  } catch {}
  return (request.headers.get("cookie") || "").includes(`${KEY}=1`);
}
