"use client";

import React from "react";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import { INK, MUT, GREEN, PURPLE, AMBER, card } from "../../lib/ui";

// Marketplace one-pager · the narrative screen: realloop as the human layer
// for production AI. Marketplace of calibrated reviewers + managed service.
// All numbers are real floors from the live system (July 2026).
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });


function Big({ n, l, color }: { n: string; l: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, padding: "16px 18px" }}>
      <div className={grotesk.className} style={{ fontSize: 28, fontWeight: 600, color: color || INK }}>{n}</div>
      <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>{l}</div>
    </div>
  );
}

function Step({ k, title, body, color }: { k: string; title: string; body: string; color: string }) {
  return (
    <div style={{ ...card, flex: 1, padding: 16, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: MUT, letterSpacing: 0.5 }}>{k}</div>
      <div className={grotesk.className} style={{ fontSize: 15.5, fontWeight: 600, margin: "4px 0 6px" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

export default function HumanLayer() {
  return (
    <div className={instrument.className} style={{ minHeight: "100vh", background: "#f5f7f9", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "12px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>realloop</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: MUT }}><a href="/portal" style={{ color: MUT }}>Portal</a> · <a href="/portal/agents" style={{ color: MUT }}>Agents</a></span>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "26px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 className={grotesk.className} style={{ margin: 0, fontSize: 32, fontWeight: 600, lineHeight: 1.15 }}>
            The human layer for your production AI
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: MUT, maxWidth: 720 }}>
            A marketplace of pre-screened, trained, <b style={{ color: INK }}>calibrated</b> reviewers · with the platform that makes
            human judgment fast, mobile-friendly and measurably reliable. Managed end-to-end, or run it yourself.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Big n="14" l="trained, calibrated reviewers" />
          <Big n="1,733" l="structured reviews delivered" />
          <Big n="78%" l="panel agreement ±1 · published, rising" color={GREEN} />
          <Big n="247" l="expert golden-transcript calls" />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Step k="01 · RUBRIC" color={INK} title="We define what good looks like · with you"
            body="Every engagement starts with your rubric: which failures matter, and which layer catches each · telemetry, LLM judge, or a human ear. The rubric decides where humans are actually needed." />
          <Step k="02 · TRIAGE" color={PURPLE} title="Machines cover everything, humans where it counts"
            body="Telemetry and our LLM judge read 100% of traffic. Only what genuinely needs human judgment reaches the panel · transcription truth, pronunciation, tone, nuanced appropriateness." />
          <Step k="03 · JUDGMENT" color={GREEN} title="Human review with subjectivity engineered out"
            body="One-screen, one-tap review flows anyone can run from a phone. Blind modes prevent anchoring. Ground-truth calls are inserted invisibly. Every reviewer's agreement is tracked · and published." />
          <Step k="04 · DELIVERY" color={AMBER} title="Findings you can act on · and trust"
            body="Agent-level dashboards with evidence you can hear, golden datasets for fine-tuning, and reliability metrics on every number. You always know who caught what, and how much to trust it." />
        </div>

        <div style={{ ...card, padding: 16, display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>We measure our reviewers the way you measure your AI</div>
            <div style={{ fontSize: 12.5, color: MUT, marginTop: 4, lineHeight: 1.6 }}>
              We ran a controlled experiment on our own panel: reviewers shown the ASR transcript rubber-stamped it 80% of the time;
              blind reviewers independently reproduced it only ~55%. So we redesigned the workflow · blind transcription, trust tiers,
              expert ground truth on every batch. Most eval vendors can&apos;t tell you their reliability. We publish ours.
            </div>
          </div>
          <div style={{ textAlign: "center", flex: "none" }}>
            <div className={grotesk.className} style={{ fontSize: 26, fontWeight: 600, color: GREEN }}>80% → 55%</div>
            <div style={{ fontSize: 10.5, color: MUT, maxWidth: 150 }}>anchoring bias, measured & engineered out</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ ...card, flex: 1, padding: 16 }}>
            <div className={grotesk.className} style={{ fontSize: 14.5, fontWeight: 600, color: GREEN }}>Managed service</div>
            <div style={{ fontSize: 12.5, color: MUT, marginTop: 4, lineHeight: 1.6 }}>
              We run your evals end-to-end · rubric, panel, calibration, reporting · and deliver the outcome. This is how Bolna runs today.
            </div>
          </div>
          <div style={{ ...card, flex: 1, padding: 16 }}>
            <div className={grotesk.className} style={{ fontSize: 14.5, fontWeight: 600, color: PURPLE }}>Marketplace</div>
            <div style={{ fontSize: 12.5, color: MUT, marginTop: 4, lineHeight: 1.6 }}>
              The same pre-screened reviewers and tooling, self-serve: bring your calls, pick your rubric, manage your own program on our platform.
            </div>
          </div>
          <div style={{ ...card, flex: 1, padding: 16, background: INK, border: "none" }}>
            <div className={grotesk.className} style={{ fontSize: 14.5, fontWeight: 600, color: "#fff" }}>The vision</div>
            <div style={{ fontSize: 12.5, color: "#93a1ae", marginTop: 4, lineHeight: 1.6 }}>
              Every production AI system needs a human to judge it, teach it, or catch what it can&apos;t do. Evals are the wedge. The human layer is the company.
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: MUT }}>
          Voice AI today (Hindi/English production calls) · text & chat agents next · all metrics above are live floors from the realloop platform, July 2026.
        </div>
      </div>
    </div>
  );
}
