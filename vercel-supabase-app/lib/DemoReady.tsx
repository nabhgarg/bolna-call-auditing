"use client";

import { useEffect } from "react";

// The ready handshake for the YC partner shell (public/ycpartners.html).
//
// A cross-origin iframe fires `load` even when the response was a login
// redirect, an error page or a CSP refusal, so the shell cannot tell a working
// screen from a silently blank one. It assumes nothing until the embedded app
// says so itself. Render this with ready={true} only once the screen has real
// content on it · mounting is not enough, because an empty shell mounts fine.
const PARENTS = ["https://realloop.in", "https://www.realloop.in"];

export default function DemoReady({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (!ready) return;
    try {
      if (window.parent === window) return;   // not framed · nothing to tell
      // Both apex forms · we do not know which one the partner opened, and
      // postMessage silently drops on a targetOrigin mismatch.
      PARENTS.forEach((origin) => {
        try { window.parent.postMessage({ realloopDemoReady: true }, origin); } catch {}
      });
    } catch {}
  }, [ready]);
  return null;
}
