"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import { INK, MUT, LINE, GREEN, RED, card } from "../../../lib/ui";
import { writeRole, isPortalUser } from "../../../lib/role";

// Client login for the portal.
//
// Before this existed, every gated portal screen sent a client to
// review.realloop.in — the REVIEWER app. A client landing there sees a call
// audit cockpit that is not theirs and has no way back. The portal now owns
// its own front door, and the gates point here with ?next= so a login returns
// you to the screen you actually asked for.
//
// Same credentials as everywhere else (email -> 6-digit code). Portal access
// is the `expert` role; anyone else who signs in correctly is told so plainly
// instead of being bounced back to a gate that just says "log in" again.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 9, border: `1px solid ${LINE}`, padding: "11px 12px",
  fontSize: 14, color: INK, background: "#fff", outline: "none"
};
const btnStyle: React.CSSProperties = {
  width: "100%", borderRadius: 9, border: "none", background: GREEN, color: "#fff",
  padding: "11px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer"
};

export default function PortalLogin() {
  const [step, setStep] = useState<"email" | "code" | "no_access">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [next, setNext] = useState("/portal/agents");

  useEffect(() => {
    // Where to land after signing in · only same-site paths, so a crafted
    // ?next=https://evil.example can't turn this into an open redirect.
    let target = "/portal/agents";
    try {
      const raw = new URLSearchParams(window.location.search).get("next") || "";
      if (raw.startsWith("/") && !raw.startsWith("//")) { target = raw; setNext(raw); }
    } catch {}
    // Already signed in · don't make them do it twice. Uses the local `target`,
    // not the `next` state, which has not applied yet on this first pass.
    try { if (isPortalUser()) window.location.replace(target); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(path: string, body: Record<string, string>) {
    const r = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(payload.error || "Something went wrong. Try again.");
    return payload;
  }

  function land(profile: { email: string; display_name?: string; role?: string }) {
    const role = profile.role || "reviewer";
    writeRole(role);
    try {
      window.localStorage.setItem("auditReviewerEmail", profile.email);
      window.localStorage.setItem("auditReviewerDisplay", profile.display_name || profile.email);
    } catch {}
    // "client" is the outside-facing role, "expert" is ours. A reviewer's
    // account is valid but belongs in the audit tool, so say that rather than
    // looping them through a gate that just repeats "log in".
    if (role !== "expert" && role !== "client" && role !== "viewer") { setStep("no_access"); return; }
    window.location.replace(next);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await post("/api/login", { email });
      // Email delivery down · /api/login falls back to a direct session.
      if (r.otp_required === false && r.email) { land(r); return; }
      setStep("code");
    } catch (error) {
      // /api/login is shared with the reviewer app and answers an unknown
      // address with "ask Nabh or Manavi to add you as a reviewer" — the wrong
      // words for a client standing at the portal door.
      const raw = (error as Error).message;
      setErr(/not recognised/i.test(raw)
        ? "We don't recognise that email. Use the address your program was set up with, or start a use case below."
        : raw);
    }
    finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { land(await post("/api/verify", { email, code })); }
    catch (error) { setErr((error as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: GREEN }} />
          <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 700 }}>realloop</span>
        </div>

        <div style={{ ...card, padding: 22 }}>
          {step === "no_access" ? (
            <>
              <h1 className={grotesk.className} style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>This account isn&apos;t on the portal</h1>
              <p style={{ fontSize: 13.5, color: MUT, lineHeight: 1.5, margin: "0 0 16px" }}>
                You&apos;re signed in, but the portal is for client accounts. If you review calls, your work is in the audit tool.
              </p>
              <a href="https://review.realloop.in/" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>Open the audit tool</a>
              <a href="/portal/new-use-case" style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 13, color: GREEN, textDecoration: "none" }}>Or start a use case →</a>
            </>
          ) : (
            <>
              <h1 className={grotesk.className} style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Log in to your portal</h1>
              <p style={{ fontSize: 13.5, color: MUT, lineHeight: 1.5, margin: "0 0 16px" }}>
                {step === "email"
                  ? "Use your work email. We'll send a 6-digit code."
                  : `Enter the code we sent to ${email}.`}
              </p>

              {step === "email" ? (
                <form onSubmit={sendCode}>
                  <input style={inputStyle} type="email" required autoFocus value={email} placeholder="you@company.com"
                    onChange={(e) => setEmail(e.target.value)} />
                  <button style={{ ...btnStyle, marginTop: 10, opacity: busy ? 0.6 : 1 }} disabled={busy} type="submit">
                    {busy ? "Sending…" : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={verify}>
                  <input style={{ ...inputStyle, letterSpacing: 4, fontSize: 17 }} inputMode="numeric" pattern="[0-9]{6}"
                    maxLength={6} required autoFocus value={code} placeholder="······"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                  <button style={{ ...btnStyle, marginTop: 10, opacity: busy ? 0.6 : 1 }} disabled={busy} type="submit">
                    {busy ? "Checking…" : "Log in"}
                  </button>
                  <button type="button" onClick={() => { setStep("email"); setCode(""); setErr(""); }}
                    style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: MUT, fontSize: 12.5, cursor: "pointer" }}>
                    Use a different email
                  </button>
                </form>
              )}

              {err && <p style={{ color: RED, fontSize: 12.5, margin: "10px 0 0" }}>{err}</p>}
            </>
          )}
        </div>

        {step !== "no_access" && (
          <p style={{ fontSize: 12.5, color: MUT, textAlign: "center", margin: "14px 0 0" }}>
            New here? <a href="/portal/new-use-case" style={{ color: GREEN, textDecoration: "none" }}>Start a use case</a> · no login needed.
          </p>
        )}
      </div>
    </main>
  );
}
