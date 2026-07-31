// Who is signed in, readable from every realloop.in subdomain.
//
// The role used to live only in localStorage, which is per-origin: logging in
// on review.realloop.in set it there, and portal.realloop.in · a different
// origin · could never see it, so the portal was unreachable on its own
// subdomain. The role is now mirrored into a cookie scoped to .realloop.in so
// one login covers review., portal. and marketplace. localStorage stays the
// source of truth on a single origin (and on localhost / the vercel.app host,
// where a dotted domain cookie does not apply).

import { isDemo, clearDemo } from "./demo";

const KEY = "auditReviewerRole";
const COOKIE = "rl_role";
const YEAR = 60 * 60 * 24 * 365;

/** ".realloop.in" when we are on a realloop.in host, otherwise no domain
 *  attribute · localhost and *.vercel.app get a plain host cookie. */
function cookieDomain(): string {
  try {
    const h = window.location.hostname;
    return /(^|\.)realloop\.in$/.test(h) ? "; domain=.realloop.in" : "";
  } catch { return ""; }
}

function readCookie(name: string): string {
  try {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch { return ""; }
}

/** The signed-in role, or "" · checks this origin first, then the shared cookie. */
export function readRole(): string {
  try {
    const local = window.localStorage.getItem(KEY) || "";
    if (local) return local;
  } catch {}
  const shared = readCookie(COOKIE);
  if (shared) {
    // adopt it locally so the rest of the app's localStorage reads work
    try { window.localStorage.setItem(KEY, shared); } catch {}
  }
  return shared;
}

export function isExpert(): boolean {
  return readRole() === "expert";
}

/** Who may open the portal.
 *
 *  "expert" is an INTERNAL role: in the reviewer app it unlocks the vibe form,
 *  the transcript panel and the ground-truth issue types. Granting it to a
 *  client so they could see their dashboard would also hand them our audit
 *  cockpit. "client" opens the portal and nothing else. */
export function isPortalUser(): boolean {
  // The YC partner demo is a read-only client session with no account behind
  // it. It sees exactly what a client sees · the same anonymised program data
  // · and every write path checks isDemoRequest() separately before persisting.
  if (isDemo()) return true;
  const role = readRole();
  return role === "expert" || role === "client" || role === "viewer";
}

export function isClient(): boolean {
  return readRole() === "client";
}

/** "viewer" is a numbers-only portal seat · dashboards and reliability figures,
 *  but no call-level detail: no recording playback, no evidence drill-down, no
 *  transcripts. Everything sensitive on a call is gated behind this. NOTE: this
 *  is a UI gate only. The portal APIs are unauthenticated, so it hides every
 *  in-product path to audio, not the raw endpoint · true enforcement needs the
 *  server-side auth from the schema migration. */
export function canSeeCallDetail(): boolean {
  if (isDemo()) return true;
  const role = readRole();
  return role === "expert" || role === "client";
}

/** Called on login · writes both stores. */
export function writeRole(role: string) {
  // Signing in ends any demo session outright · see clearDemo() for why a
  // leftover flag is dangerous rather than merely untidy.
  clearDemo();
  try { window.localStorage.setItem(KEY, role); } catch {}
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${encodeURIComponent(role)}; path=/; max-age=${YEAR}; SameSite=Lax${cookieDomain()}${secure}`;
  } catch {}
}

/** Called on logout · clears both, including the shared cookie. */
export function clearRole() {
  try { window.localStorage.removeItem(KEY); } catch {}
  try {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax${cookieDomain()}`;
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
}
