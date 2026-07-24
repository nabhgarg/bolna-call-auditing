"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import { INK, MUT, GREEN, AMBER, card } from "../../lib/ui";

// Marketplace (wireframe 11a) · you hire a calibrated PANEL per role, never an
// individual. The published reliability number (agreement on hidden ground-truth
// calls the panel can't detect) is the product; individuals rotate underneath.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });


type Panel = {
  role: string; panelLabel: string; metric: number; metricUnit: string; metricSub: string;
  calibrating?: boolean; blurb: string; langs: string[]; price: string; priceUnit: string;
  cta: string; primary?: boolean; real?: boolean;
};

const PANELS: Panel[] = [
  { role: "AI Call Review", panelLabel: "18-reviewer panel", metric: 81, metricUnit: "%", metricSub: "panel reliability · ±1 on hidden GT · n=546", blurb: "Vibe scores 1-4 + timestamped issue logs · n≥3 per call · 4,800 reviews/wk capacity", langs: ["Hindi", "Hinglish", "English"], price: "₹28", priceUnit: "/ review · <24h", cta: "Add to program", primary: true, real: true },
  { role: "Golden Transcription", panelLabel: "4-transcriber panel", metric: 84, metricUnit: "%", metricSub: "word agreement vs expert resolution", blurb: "Word-level Devanagari transcripts, every spike expert-resolved · 90 calls/wk capacity", langs: ["Hindi · native"], price: "₹120", priceUnit: "/ call · 48h", cta: "Add to program", real: true },
  { role: "Pronunciation Audit", panelLabel: "3-specialist panel", metric: 92, metricUnit: "%", metricSub: "panel reliability on brand/proper-noun GT", blurb: "Brand names, SKUs & city names verified across speakers, with audio evidence", langs: ["Hindi + English"], price: "₹52", priceUnit: "/ name · 72h", cta: "Add to program", real: true },
  { role: "AI Chat Review", panelLabel: "panel forming", metric: 87, metricUnit: "%", metricSub: "target reliability · pilot underway", calibrating: true, blurb: "Chatbot & WhatsApp-bot conversations · correctness, tone, task completion · 6,000/wk", langs: ["English", "Hinglish"], price: "₹18", priceUnit: "/ review · <24h", cta: "Add to program" },
  { role: "Regional Languages", panelLabel: "panel building", metric: 84, metricUnit: "%", metricSub: "early reliability · still building batch history", calibrating: true, blurb: "Tamil, Telugu, Marathi, Bengali call review · panel still building batch history", langs: ["Tamil", "Telugu", "+2"], price: "₹28", priceUnit: "/ review · 48h", cta: "Join waitlist" },
  { role: "Live Agent Testing", panelLabel: "4-tester panel", metric: 98, metricUnit: "%", metricSub: "script coverage per pre-launch run", blurb: "Scripted test calls to your agent before launch · every branch exercised, breaks noted", langs: ["any language"], price: "₹90", priceUnit: "/ test call · 24h", cta: "Add to program" }
];

function Tag({ t }: { t: string }) {
  return <span style={{ borderRadius: 6, border: "1px solid #e2e8ee", background: "#fff", color: "#4d5a66", fontSize: 10.5, padding: "2px 8px" }}>{t}</span>;
}

export default function Marketplace() {
  const [program, setProgram] = useState<string[]>([]);
  useEffect(() => { try { setProgram(JSON.parse(window.localStorage.getItem("rlProgram") || "[]")); } catch {} }, []);
  function toggle(role: string) {
    setProgram((prev) => { const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]; window.localStorage.setItem("rlProgram", JSON.stringify(next)); return next; });
  }

  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontWeight: 600, padding: "4px 12px", fontSize: 12 }}>Marketplace</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}><a href="/marketplace/join" style={{ color: MUT }}>Work with us</a> · <a href="/portal" style={{ color: MUT }}>Portal</a></span>
        <a href="/marketplace/start" style={{ fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, borderRadius: 8, padding: "9px 16px", textDecoration: "none" }}>Start a program</a>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* headline + top stats */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 300, flex: 1 }}>
            <div className={grotesk.className} style={{ fontSize: 26, letterSpacing: "-.4px", lineHeight: 1.15, fontWeight: 600 }}>Hire a calibrated panel, not a freelancer</div>
            <div style={{ fontSize: 13.5, color: MUT, marginTop: 4, maxWidth: 560 }}>You never pick individuals. Each role is a panel with a published reliability number, measured on hidden ground-truth calls it can&apos;t detect.</div>
          </div>
          <div style={{ display: "flex", gap: 14, flex: "none" }}>
            <div style={{ textAlign: "right" }}><div className={grotesk.className} style={{ fontSize: 19, fontWeight: 600, color: GREEN }}>81%</div><div style={{ fontSize: 10.5, color: MUT }}>panel reliability, core role</div></div>
            <div style={{ textAlign: "right", borderLeft: "1px solid #e2e8ee", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontSize: 19, fontWeight: 600 }}>1,733+</div><div style={{ fontSize: 10.5, color: MUT }}>reviews delivered</div></div>
            <div style={{ textAlign: "right", borderLeft: "1px solid #e2e8ee", paddingLeft: 14 }}><div className={grotesk.className} style={{ fontSize: 19, fontWeight: 600 }}>&lt;24h</div><div style={{ fontSize: 10.5, color: MUT }}>median turnaround</div></div>
          </div>
        </div>

        {/* role panels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {PANELS.map((p) => {
            const inProgram = program.includes(p.role);
            const accent = p.calibrating ? AMBER : GREEN;
            return (
              <div key={p.role} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10, border: `${p.primary || inProgram ? 1.5 : 1}px solid ${p.primary || inProgram ? GREEN : "#e2e8ee"}`, minHeight: 210 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>{p.role}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ borderRadius: 999, background: p.calibrating ? "#faf3e3" : "#e7f4ee", color: accent, fontSize: 10.5, fontWeight: 600, padding: "3px 9px" }}>{p.panelLabel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className={grotesk.className} style={{ fontSize: 30, fontWeight: 600, color: accent }}>{p.metric}{p.metricUnit}</span>
                  <span style={{ fontSize: 11, color: MUT, lineHeight: 1.3 }}>{p.metricSub}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "#eef2f6" }}><div style={{ width: `${p.metric}%`, height: 5, borderRadius: 3, background: p.calibrating ? "#d99a2b" : GREEN }} /></div>
                <div style={{ fontSize: 11.5, color: MUT, lineHeight: 1.5 }}>{p.blurb}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{p.langs.map((l) => <Tag key={l} t={l} />)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
                  <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>{p.price}</span>
                  <span style={{ fontSize: 11, color: MUT }}>{p.priceUnit}</span>
                  <span style={{ flex: 1 }} />
                  {p.cta === "Join waitlist" ? (
                    <a href={`mailto:nabh@realloop.in?subject=${encodeURIComponent("Waitlist: " + p.role)}`} style={{ fontWeight: 600, fontSize: 12.5, color: INK, background: "#fff", border: "1px solid #d6dee6", borderRadius: 8, padding: "7px 14px", textDecoration: "none" }}>Join waitlist</a>
                  ) : (
                    <button onClick={() => toggle(p.role)} style={{ fontWeight: 600, fontSize: 12.5, color: inProgram ? "#fff" : (p.primary ? "#fff" : GREEN), background: inProgram || p.primary ? GREEN : "#fff", border: `1px solid ${GREEN}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>{inProgram ? "✓ In program" : "Add to program"}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* how reliability is measured */}
        <div style={{ ...card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, background: "#f2faf6", borderColor: "#bfe2d2" }}>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flex: "none" }}>✓</span>
          <span style={{ fontSize: 12.5, color: "#4d5a66", lineHeight: 1.5 }}>
            <b style={{ color: INK }}>How reliability is measured:</b> expert-rated calls are seeded unmarked into every batch. The number you see is the panel&apos;s agreement on calls it didn&apos;t know were tests · recomputed weekly, never self-reported. Every panel includes expert QA; individuals rotate, the reliability number is the contract.
          </span>
        </div>
        <div style={{ fontSize: 11, color: MUT }}>
          Reliability shown is real for operating panels (call review, transcription, pronunciation); chat, regional and testing panels are in pilot/capacity. Reviewers reach these panels through the <a href="/marketplace/join" style={{ color: GREEN }}>calibration track</a>.
        </div>
      </div>

      {program.length > 0 && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 40, ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 16px", boxShadow: "0 8px 28px rgba(16,24,31,.16)" }}>
          <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>Program</span>
          <span style={{ fontSize: 12.5, color: MUT }}>{program.length} panel{program.length === 1 ? "" : "s"} selected</span>
          <button onClick={() => { setProgram([]); window.localStorage.setItem("rlProgram", "[]"); }} style={{ fontSize: 11.5, color: MUT, background: "transparent", border: "none", cursor: "pointer" }}>clear</button>
          <a href={`/marketplace/start?panels=${program.map(encodeURIComponent).join(",")}`} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, borderRadius: 8, padding: "9px 15px", textDecoration: "none" }}>Start a program →</a>
        </div>
      )}
    </div>
  );
}
