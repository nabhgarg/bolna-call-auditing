import { createHmac } from "crypto";

// Stateless OTP: the 6-digit code is an HMAC of (email, 10-minute window).
// No storage needed; verify recomputes for the current and previous window,
// so codes stay valid for 10-20 minutes. Internal tool tradeoff: a code is
// reusable within its window (no single-use burn), which is acceptable here.
const OTP_SECRET = process.env.OTP_SECRET || "bolna-call-audit-otp-v1-9f3k2m8x";
const WINDOW_MS = 10 * 60_000;

export function otpForWindow(email: string, windowIndex: number) {
  const digest = createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}|${windowIndex}`)
    .digest();
  const num = digest.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, "0");
}

export function currentOtp(email: string) {
  return otpForWindow(email, Math.floor(Date.now() / WINDOW_MS));
}

export function verifyOtp(email: string, code: string) {
  const w = Math.floor(Date.now() / WINDOW_MS);
  return code === otpForWindow(email, w) || code === otpForWindow(email, w - 1);
}
