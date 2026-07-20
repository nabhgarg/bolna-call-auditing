import { createHmac } from "crypto";

// Stateless OTP: the 6-digit code is an HMAC of (email, window). No storage.
// Two flavours, both verified:
//   - short window (10 min): emailed code, rotates fast. Verified for the
//     current and previous window, so an emailed code lasts 10-20 minutes.
//   - long window (30 days): a hand-out code for reviewers who can't receive
//     email. Verified for current + previous window, so it lasts 30-60 days.
// Internal tool tradeoff: a code is reusable within its window (no single-use
// burn), which is acceptable here. Deactivating a reviewer revokes both codes
// immediately because /api/verify re-checks is_active after the code matches.
const OTP_SECRET = process.env.OTP_SECRET || "bolna-call-audit-otp-v1-9f3k2m8x";
const WINDOW_MS = 10 * 60_000;
const LONG_WINDOW_MS = 30 * 24 * 60 * 60_000;

function codeForLabel(label: string) {
  const digest = createHmac("sha256", OTP_SECRET).update(label).digest();
  const num = digest.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, "0");
}

export function otpForWindow(email: string, windowIndex: number) {
  return codeForLabel(`${email.trim().toLowerCase()}|${windowIndex}`);
}

export function currentOtp(email: string) {
  return otpForWindow(email, Math.floor(Date.now() / WINDOW_MS));
}

// Long-lived hand-out code (~30-60 days). Not emailed; generated on demand.
export function longLivedOtp(email: string) {
  return codeForLabel(`${email.trim().toLowerCase()}|L${Math.floor(Date.now() / LONG_WINDOW_MS)}`);
}

export function verifyOtp(email: string, code: string) {
  const e = email.trim().toLowerCase();
  const w = Math.floor(Date.now() / WINDOW_MS);
  const lw = Math.floor(Date.now() / LONG_WINDOW_MS);
  return (
    code === otpForWindow(e, w) ||
    code === otpForWindow(e, w - 1) ||
    code === codeForLabel(`${e}|L${lw}`) ||
    code === codeForLabel(`${e}|L${lw - 1}`)
  );
}
