"use client";

import React, { useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { PAGE, INK, MUT, GREEN, AMBER, card } from "../../../lib/ui";

// Add use case (wireframe 12a) · one screen inside the portal that launches a
// new evaluation program, reusing the client's existing panel + pricing.
// use case = rubric + calls + panel. Live cost estimate; Launch creates the
// program (same objects the ops scripts write).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });


function Tag({ on, children, onClick }: { on?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <span onClick={onClick} style={{ borderRadius: 6, border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : "#4d5a66", fontSize: 11.5, padding: "3px 10px", cursor: onClick ? "pointer" : "default", fontWeight: on ? 600 : 400 }}>{children}</span>;
}

export default function AddUseCase() {
  const [kind, setKind] = useState("New voice agent");
  const [name, setName] = useState("giva-jewelry · Tamil launch");
  const [reviewers, setReviewers] = useState(3);
  const [gt, setGt] = useState(10);
  const [launched, setLaunched] = useState(false);

  const calls = 200, rate = 28;
  const reviews = calls * reviewers;
  const cost = reviews * rate;

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Add a use case</span>
        <span style={{ fontSize: 12, color: MUT }}>a rubric + calls + a panel · reuses your existing panel and pricing</span>
      </div>
    }>
      <div className={instrument.className} style={{ maxWidth: PAGE, margin: "0 auto", padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* left: 1-3 */}
          <div style={{ ...card, flex: 1.3, minWidth: 380, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>1 · What are we evaluating?</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["New voice agent", "Chatbot", "Existing agent, new market"].map((k) => (
                <span key={k} onClick={() => setKind(k)} style={{ borderRadius: 999, background: kind === k ? GREEN : "#eef2f6", color: kind === k ? "#fff" : "#4d5a66", fontWeight: kind === k ? 600 : 400, fontSize: 12, padding: "5px 12px", cursor: "pointer" }}>{k}</span>
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ border: "1px solid #d6dee6", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: INK, outline: "none", fontFamily: "inherit" }} />

            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>2 · Rubric</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontWeight: 600, fontSize: 12, padding: "5px 12px" }}>✓ voice_v1 template · same L2s as Bolna pilot</span>
              <a href="/marketplace/start" style={{ borderRadius: 999, background: "#eef2f6", color: "#4d5a66", fontSize: 12, padding: "5px 12px", textDecoration: "none" }}>customize ▾</a>
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>5 human L2s + latency/barge-in from telemetry. Your Overall page picks these up automatically.</div>

            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>3 · Calls</span>
            <div style={{ border: "1.5px dashed #d6dee6", borderRadius: 10, padding: 14, textAlign: "center", fontSize: 12.5, color: MUT }}>
              Drop CSV (execution_id, recording_url, transcript) · or <b style={{ color: GREEN }}>connect the API</b>
            </div>
          </div>

          {/* right: 4 panel + estimate */}
          <div style={{ ...card, flex: 1, minWidth: 300, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>4 · Panel</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
              <b>Regional Languages panel</b><span style={{ flex: 1 }} />
              <span style={{ borderRadius: 999, background: "#faf3e3", color: AMBER, fontSize: 10.5, padding: "2px 8px", fontWeight: 600 }}>84% · calibrating</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ color: MUT }}>Reviewers per call</span><span style={{ flex: 1 }} />
              {[1, 3, 5].map((n) => <Tag key={n} on={reviewers === n} onClick={() => setReviewers(n)}>{n}</Tag>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ color: MUT }}>Hidden ground truth</span><span style={{ flex: 1 }} />
              {[5, 10, 20].map((n) => <Tag key={n} on={gt === n} onClick={() => setGt(n)}>{n}%</Tag>)}
            </div>
            <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 9, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <div style={{ display: "flex" }}><span style={{ color: MUT }}>{calls} calls × {reviewers} reviewers</span><span style={{ flex: 1 }} /><span className={mono.className}>{reviews.toLocaleString()} reviews</span></div>
              <div style={{ display: "flex" }}><span style={{ color: MUT }}>₹{rate} / review</span><span style={{ flex: 1 }} /><span className={mono.className}>₹{cost.toLocaleString()}</span></div>
              <div style={{ display: "flex" }}><span style={{ color: MUT }}>Expert QA + GT seeding ({gt}%)</span><span style={{ flex: 1 }} /><span className={mono.className}>included</span></div>
              <div style={{ display: "flex", fontWeight: 600 }}><span>Estimate</span><span style={{ flex: 1 }} /><span className={mono.className}>₹{cost.toLocaleString()} · 5 days</span></div>
            </div>
            <div style={{ flex: 1 }} />
            {launched ? (
              <div style={{ background: "#f2faf6", border: `1.5px solid ${GREEN}`, borderRadius: 9, padding: "12px 14px", fontSize: 13, color: "#4d5a66", lineHeight: 1.5 }}>
                <b style={{ color: GREEN }}>✓ Program launched.</b> Queues and reviewer assignments created · reviews start today. Track it on the <a href="/portal" style={{ color: GREEN }}>Overall</a> page.
              </div>
            ) : (
              <div onClick={() => { try { const list = JSON.parse(window.localStorage.getItem("rlPrograms") || "[]"); if (!list.includes(name)) { list.push(name); window.localStorage.setItem("rlPrograms", JSON.stringify(list)); } window.localStorage.setItem("rlActiveProgram", name); } catch {} setLaunched(true); }} style={{ height: 44, borderRadius: 9, background: GREEN, color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>Launch use case</div>
            )}
            <div style={{ fontSize: 11, color: MUT, textAlign: "center" }}>Creates the program, queues, and assignments · reviews start today.</div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
