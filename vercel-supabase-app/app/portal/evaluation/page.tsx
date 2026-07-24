"use client";

import React, { useEffect, useRef, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import PortalShell from "../shell";
import { INK } from "../../../lib/ui";

// Evaluation design · first tab of the portal. Port of the claude.ai/design
// "RealLoop Evaluation Flow (Animated)" wireframe: n8n-circuit swimlane flow,
// three lanes (Machines / Human panel / Experts), orthogonal traces with
// travelling pulses, counters ramping to the REAL pipeline numbers
// (/api/portal/pipeline). 13s loop.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

const C = {
  bg: "#f5f7f9", card: "#fff", ink: "#10181f", mut: "#6b7885", line: "#e2e8ee",
  green: "#0e8a5f", greenBg: "#e7f4ee", purple: "#7c5cbf", purpleBg: "#fbf9ff", purpleLine: "#ece5f7",
  red: "#d6484f", greenLaneBg: "#f7fbf9", greenLaneLine: "#dcefe5", grey: "#aab4bd"
};
const NODE_H = 56, STAGE_W = 1400, STAGE_H = 556;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const eo = (t: number) => 1 - Math.pow(1 - t, 3);

type Pt = [number, number];
function route(sx: number, sy: number, tx: number, ty: number, cx: number): Pt[] {
  if (sy === ty) return [[sx, sy], [tx, ty]];
  return [[sx, sy], [cx, sy], [cx, ty], [tx, ty]];
}
function d(pts: Pt[]) { return "M" + pts.map((p) => p[0] + "," + p[1]).join(" L"); }
function ptAt(pts: Pt[], p: number): Pt {
  const L: number[] = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); L.push(l); tot += l; }
  let dist = clamp(p, 0, 1) * tot;
  for (let i = 0; i < L.length; i++) {
    if (dist <= L[i] || i === L.length - 1) {
      const t = L[i] ? dist / L[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    dist -= L[i];
  }
  return pts[pts.length - 1];
}

function Node({ x, y, w, accent, titleColor, title, sub, bg, lit }: {
  x: number; y: number; w: number; accent?: string; titleColor?: string; title: string; sub?: string; bg?: string; lit?: boolean;
}) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: NODE_H, boxSizing: "border-box",
      display: "flex", flexDirection: "column", justifyContent: "center",
      background: bg || C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent || C.green}`,
      borderRadius: 12, padding: "0 13px", zIndex: 2,
      boxShadow: lit ? `0 0 0 3px ${accent || C.green}30, 0 6px 16px rgba(16,24,31,.12)` : "0 1px 3px rgba(16,24,31,.06)",
      transition: "box-shadow .25s" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: titleColor || accent || C.ink }}>{title}</div>
      {sub ? <div style={{ fontSize: 10.5, color: C.mut, marginTop: 2, lineHeight: 1.35 }}>{sub}</div> : null}
    </div>
  );
}

type Pipeline = { funnel: { id: string; n: number }[]; taxonomy: { occurrences: number }[]; routing: any; reliability: any };

function Flow({ lt, pipe }: { lt: number; pipe: Pipeline | null }) {
  const totalReal = pipe?.funnel?.[0]?.n || 2448;
  const findingsReal = pipe ? pipe.taxonomy.reduce((a, t) => a + (t.occurrences || 0), 0) : 5596;
  const vibeReal = pipe?.funnel?.find((f) => f.id === "vibe")?.n || 849;
  const flagsReal = pipe?.routing?.llm_judge?.calls_flagged || 493;

  // plays once: ramp finishes at 6s and the numbers stay fixed (no GIF loop)
  const ramp = eo(seg(lt, 0.5, 6));
  const total = Math.round(120 + ramp * (totalReal - 120));
  const findings = Math.round(40 + ramp * (findingsReal - 40));

  const yM = 150, yH = 316, yE = 456;
  const N: Record<string, { x: number; y: number; w: number }> = {
    ingest: { x: 140, y: 278, w: 108 },
    telem: { x: 330, y: yM - NODE_H / 2, w: 205 },
    judge: { x: 600, y: yM - NODE_H / 2, w: 210 },
    verify: { x: 900, y: 242 - NODE_H / 2, w: 180 },
    vibe: { x: 330, y: yH - NODE_H / 2, w: 205 },
    issue: { x: 600, y: yH - NODE_H / 2, w: 210 },
    human: { x: 900, y: 342 - NODE_H / 2, w: 210 },
    gt: { x: 330, y: yE - NODE_H / 2, w: 260 },
    golden: { x: 900, y: yE - NODE_H / 2, w: 280 }
  };
  const R = (n: string): Pt => [N[n].x + N[n].w, N[n].y + NODE_H / 2];
  const Lp = (n: string): Pt => [N[n].x, N[n].y + NODE_H / 2];

  const TR: { pts: Pt[]; color: string; dash?: boolean }[] = [
    { pts: route(R("ingest")[0], 306, Lp("telem")[0], yM, 283), color: C.purple },
    { pts: route(R("telem")[0], yM, Lp("judge")[0], yM, 0), color: C.purple },
    { pts: route(R("judge")[0], yM, Lp("verify")[0], 242, 855), color: C.grey, dash: true },
    { pts: route(R("ingest")[0], 306, Lp("vibe")[0], yH, 289), color: C.green },
    { pts: route(R("vibe")[0], yH, Lp("issue")[0], yH, 0), color: C.green },
    { pts: route(R("issue")[0], yH, Lp("human")[0], 342, 860), color: C.green },
    { pts: route(R("ingest")[0], 306, Lp("gt")[0], yE, 295), color: C.ink },
    // hidden GT gets INSERTED into the vibe batches: straight up from GT's top into vibe's bottom
    { pts: [[430, N.gt.y], [430, N.vibe.y + NODE_H]] as Pt[], color: C.ink, dash: true },
    // golden transcripts come out of the 100% human ASR lane: straight down into the experts row
    { pts: [[1005, N.human.y + NODE_H], [1005, N.golden.y]] as Pt[], color: C.green }
  ];
  const litJudge = (Math.floor(lt) % 4) === 1, litHuman = (Math.floor(lt) % 4) === 2;

  const pulses: React.ReactNode[] = [];
  TR.forEach((tr, ti) => {
    const n = 1 + Math.round(ramp * 4);
    for (let k = 0; k < n; k++) {
      const speed = 0.17 + ((ti + k) % 3) * 0.03;
      const phase = (k / n + ti * 0.11) % 1;
      const p = (lt * speed + phase) % 1;
      const [x, y] = ptAt(tr.pts, p);
      const fade = Math.sin(Math.PI * clamp(p * 1.03, 0, 1));
      pulses.push(<div key={ti + "-" + k} style={{ position: "absolute", left: x - 3.5, top: y - 3.5,
        width: 7, height: 7, borderRadius: 99, background: tr.color, zIndex: 3,
        opacity: 0.35 + 0.55 * fade, boxShadow: `0 0 7px ${tr.color}` }} />);
    }
  });

  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 26, left: 36, right: 36, display: "flex", alignItems: "flex-end", gap: 20, zIndex: 4 }}>
        <div>
          <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 26, color: C.ink, letterSpacing: -0.4 }}>How your calls get evaluated</div>
          <div style={{ fontSize: 13, color: C.mut, marginTop: 3 }}>Machines read 100% of traffic · humans go only where machines are blind</div>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 96, right: 0, height: 150, background: C.purpleBg, borderTop: `1px solid ${C.purpleLine}`, borderBottom: `1px solid ${C.purpleLine}` }} />
      <div style={{ position: "absolute", left: 0, top: 246, right: 0, height: 150, background: C.greenLaneBg, borderBottom: `1px solid ${C.greenLaneLine}` }} />
      <div style={{ position: "absolute", left: 0, top: 396, right: 0, height: 120, background: "#fbfcfd", borderBottom: `1px solid ${C.line}` }} />
      <div style={{ position: "absolute", left: 20, top: 106, width: 110, zIndex: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: 1 }}>Machines</div>
        <div style={{ fontSize: 10, color: C.mut, marginTop: 3 }}>100% of traffic</div>
      </div>
      <div style={{ position: "absolute", left: 20, top: 256, width: 110, zIndex: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 1 }}>Human panel</div>
        <div style={{ fontSize: 10, color: C.mut, marginTop: 3 }}>where machines are blind</div>
      </div>
      <div style={{ position: "absolute", left: 20, top: 406, width: 110, zIndex: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, textTransform: "uppercase", letterSpacing: 1 }}>Experts</div>
        <div style={{ fontSize: 10, color: C.mut, marginTop: 3 }}>ground truth</div>
      </div>
      <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} fill="none" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {TR.map((tr, i) => <path key={i} d={d(tr.pts)} stroke={tr.color} strokeOpacity={0.32} strokeWidth={2} strokeDasharray={tr.dash ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {TR.map((tr, i) => <circle key={"e" + i} cx={tr.pts[tr.pts.length - 1][0]} cy={tr.pts[tr.pts.length - 1][1]} r={3.5} fill="#fff" stroke={tr.color} strokeWidth={2} />)}
      </svg>
      {pulses}
      <div style={{ position: "absolute", left: N.ingest.x, top: N.ingest.y, width: N.ingest.w, height: NODE_H, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", background: C.ink, color: "#fff", borderRadius: 12, padding: "0 13px", textAlign: "center", boxShadow: "0 4px 14px rgba(16,24,31,.18)", zIndex: 2 }}>
        <div className={grotesk.className} style={{ fontWeight: 600, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString()}</div>
        <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1 }}>calls in · API / CSV</div>
      </div>
      <Node {...N.telem} accent={C.purple} title="Telemetry" sub="latency + barge-in, every call" />
      <Node {...N.judge} accent={C.purple} title="LLM judge · 100%" sub="repetition · language · instruction" lit={litJudge} />
      <Node {...N.verify} accent={C.grey} titleColor={C.ink} title="Verify judge flags" sub={`panel audits the machine · ${flagsReal.toLocaleString()} flags`} />
      <Node {...N.vibe} accent={C.green} title="Vibe scoring 1-4" sub={`${vibeReal.toLocaleString()} calls · n≥3 raters`} lit={litHuman} />
      <Node {...N.issue} accent={C.red} title="Issue logging · bad calls" sub={findings.toLocaleString() + " findings → taxonomy"} />
      <Node {...N.human} accent={C.green} bg={C.greenBg} title="100% human · ASR + pronunciation" sub="machines can't grade this" />
      <Node {...N.gt} accent={C.ink} title="Hidden ground truth" sub="inserted into vibe batches → Reliability" />
      <Node {...N.golden} accent={C.ink} title="Golden transcripts" sub="247 calls word-perfect → Datasets" />
      <div style={{ position: "absolute", left: 150, bottom: 16, display: "flex", gap: 18, fontSize: 11, color: C.mut, zIndex: 4 }}>
        <span><span style={{ color: C.purple }}>● </span>machine route</span>
        <span><span style={{ color: C.green }}>● </span>human route</span>
        <span><span style={{ color: C.grey }}>● </span>audits / feeds</span>
      </div>
    </div>
  );
}

export default function EvaluationDesign() {
  const [lt, setLt] = useState(0);
  const [pipe, setPipe] = useState<Pipeline | null>(null);
  const [scale, setScale] = useState(1);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/portal/pipeline").then((r) => r.json()).then(setPipe).catch(() => {});
  }, []);

  useEffect(() => {
    // lt grows unbounded: the counter ramp plays once and freezes; the pulses
    // keep drifting quietly (ambient motion, no restart)
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { setLt((now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const fit = () => {
      const w = hostRef.current?.offsetWidth || STAGE_W;
      const h = hostRef.current?.offsetHeight || STAGE_H;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <PortalShell>
      <div className={instrument.className} style={{ height: "100vh", boxSizing: "border-box", padding: 0, color: INK }}>
        <div ref={hostRef} style={{ width: "100%", height: "100%", overflow: "hidden", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: STAGE_W, height: STAGE_H, position: "relative", transform: `scale(${scale})`, transformOrigin: "center center", flex: "none" }}>
            <Flow lt={lt} pipe={pipe} />
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
