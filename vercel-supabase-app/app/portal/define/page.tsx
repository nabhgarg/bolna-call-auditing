"use client";

import React, { useMemo, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, AMBER, RED, card } from "../../../lib/ui";

// Client Input · "describe your use case in plain language, we turn it into
// review tasks". Two halves: the natural-language box + key-info form on the
// left, and the metrics we detected on the right (transcription / number-input
// capture / factual accuracy), each with what humans will actually check and
// what it costs. This is the screen a client sees before a program exists.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

type MetricKey = "transcription" | "number_capture" | "factual";
type Metric = {
  key: MetricKey; label: string; blurb: string; lane: "human" | "mixed";
  checks: string[]; rate: string; hint: RegExp;
};

const METRICS: Metric[] = [
  {
    key: "transcription", label: "Transcription accuracy", lane: "human",
    blurb: "Code-mixed Hindi/English written the way it was spoken.",
    checks: ["Hindi in Devanagari, English in Roman", "Addresses and place names tagged", "Numbers written as spoken"],
    rate: "₹120 / call",
    hint: /hinglish|hindi|devanagari|transcri|language|address|regional|tamil|telugu|marathi|bengali/i,
  },
  {
    key: "number_capture", label: "Number & input capture", lane: "human",
    blurb: "What the user actually said vs what the bot captured.",
    checks: ["Amounts, OTPs, order and phone numbers", "Answers the bot never registered", "Digits misheard mid-call"],
    rate: "₹28 / review",
    hint: /number|otp|amount|digit|input|capture|phone|order id|pincode|quantity/i,
  },
  {
    key: "factual", label: "Factual accuracy", lane: "mixed",
    blurb: "Every claim checked against your knowledge base.",
    checks: ["Prices, offers and policy claims", "Invented product or service details", "Answers outside the knowledge base"],
    rate: "₹40 / review",
    hint: /fact|knowledge base|kb|policy|price|catalog|hallucinat|accurate|wrong info|claim/i,
  },
];

const EXAMPLE = "Our voice agent calls customers in Hindi and English to confirm orders. It has to capture the order amount and the delivery address correctly, and it should only quote prices from our catalog.";

export default function Define() {
  const [desc, setDesc] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("Voice agent");
  const [langs, setLangs] = useState<string[]>(["Hindi", "Hinglish"]);
  const [volume, setVolume] = useState("500-2,000");
  const [manual, setManual] = useState<MetricKey[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  React.useEffect(() => { setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert"); }, []);

  // metrics detected from the plain-language description, plus manual toggles
  const detected = useMemo(() => {
    const auto = METRICS.filter((m) => m.hint.test(desc)).map((m) => m.key);
    return new Set<MetricKey>([...auto, ...manual]);
  }, [desc, manual]);
  const toggle = (k: MetricKey) => setManual((s) => (detected.has(k) ? s.filter((x) => x !== k) : [...s, k]));

  const nCalls = Number(String(volume).replace(/[^\d]/g, "").slice(0, 4)) || 500;
  const sampled = Math.max(60, Math.round(nCalls * 0.35));
  const ready = desc.trim().length > 25 && detected.size > 0;

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>New use case</span>
        <span style={{ fontSize: 12.5, color: MUT }}>describe it in plain language · we turn it into review tasks</span>
      </div>
    }>
      <div className={instrument.className} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "16px 22px 30px", alignItems: "start", color: INK }}>

        {/* LEFT · natural language + key info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>What should the AI get right?</span>
              <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>Write it the way you would explain it to a new teammate. No rubric, no schema.</div>
            </div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={7}
              placeholder={EXAMPLE}
              style={{ width: "100%", boxSizing: "border-box", fontSize: 14, lineHeight: 1.6, padding: "12px 14px", border: "1px solid #d6dee6", borderRadius: 10, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setDesc(EXAMPLE)} style={{ fontSize: 12, padding: "6px 11px", borderRadius: 7, border: "1px solid #d6dee6", background: "#fff", color: "#4d5a66", cursor: "pointer" }}>Use an example</button>
              <span style={{ fontSize: 11.5, color: MUT }}>{desc.trim().length > 25 ? "Metrics detected on the right." : "Keep typing · we pick the metrics up as you go."}</span>
            </div>
          </div>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Key info</span>
            <label style={{ fontSize: 12, color: "#4d5a66", display: "flex", flexDirection: "column", gap: 5 }}>Use case name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order confirmation · Hindi"
                style={{ padding: "9px 11px", border: "1px solid #d6dee6", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            </label>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Channel</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Voice agent", "Chat / text agent"].map((k) => (
                  <span key={k} onClick={() => setKind(k)} style={{ borderRadius: 999, background: kind === k ? GREEN : "#eef2f6", color: kind === k ? "#fff" : "#4d5a66", fontWeight: kind === k ? 600 : 400, fontSize: 12, padding: "6px 13px", cursor: "pointer" }}>{k}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Languages on the line</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {["Hindi", "Hinglish", "English", "Tamil", "Telugu", "Marathi", "Bengali"].map((l) => {
                  const on = langs.includes(l);
                  return <span key={l} onClick={() => setLangs((s) => on ? s.filter((x) => x !== l) : [...s, l])}
                    style={{ border: `1px solid ${on ? GREEN : "#d6dee6"}`, background: on ? GREEN : "#fff", color: on ? "#fff" : INK, borderRadius: 6, padding: "5px 11px", fontSize: 11.5, cursor: "pointer" }}>{l}</span>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#4d5a66", marginBottom: 5 }}>Calls per week</div>
              <div style={{ display: "flex", background: "#eef2f6", borderRadius: 9, padding: 3, gap: 3 }}>
                {["under 500", "500-2,000", "2,000+"].map((v) => (
                  <div key={v} onClick={() => setVolume(v)} style={{ flex: 1, textAlign: "center", fontSize: 12, padding: "7px 0", borderRadius: 7, cursor: "pointer", fontWeight: 600, background: v === volume ? "#fff" : "transparent", color: v === volume ? INK : MUT, boxShadow: v === volume ? "0 1px 2px rgba(16,24,31,.08)" : "none" }}>{v}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT · what we will measure */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>What we will measure</span>
              <span style={{ fontSize: 12, color: MUT }}>picked up from your description · click to add or remove</span>
            </div>
            {METRICS.map((m) => {
              const on = detected.has(m.key);
              return (
                <div key={m.key} onClick={() => toggle(m.key)}
                  style={{ border: `1.5px solid ${on ? GREEN : "#e6ebf0"}`, background: on ? "#f7fbf9" : "#fff", borderRadius: 12, padding: "13px 15px", cursor: "pointer", transition: "background .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flex: "none", border: `1.5px solid ${on ? GREEN : "#c8d2db"}`, background: on ? GREEN : "#fff", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{on ? "✓" : ""}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ borderRadius: 999, fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: m.lane === "human" ? "#e7f4ee" : "#f3eefc", color: m.lane === "human" ? GREEN : PURPLE }}>{m.lane === "human" ? "100% human" : "judge + human"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: MUT, marginTop: 5, marginLeft: 27 }}>{m.blurb}</div>
                  {on && (
                    <div style={{ marginLeft: 27, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {m.checks.map((c) => <div key={c} style={{ fontSize: 12, color: "#4d5a66" }}><span style={{ color: GREEN }}>·</span> {c}</div>)}
                      <div className={mono.className} style={{ fontSize: 11, color: MUT, marginTop: 3 }}>{m.rate}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {detected.size === 0 && <div style={{ fontSize: 12, color: MUT }}>Nothing detected yet. Describe what the AI must get right, or pick a metric above.</div>}
          </div>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, borderLeft: `4px solid ${ready ? GREEN : "#e6ebf0"}` }}>
            <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>What happens next</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[[String(detected.size), "metrics become review tasks"], [sampled.toLocaleString(), "calls sampled in week one"], ["3+", "reviewers per call"]].map(([n, l]) => (
                <div key={l} style={{ flex: 1, minWidth: 130, background: "#f5f7f9", borderRadius: 10, padding: "11px 13px" }}>
                  <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
                  <div style={{ fontSize: 11, color: MUT }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: MUT, lineHeight: 1.55 }}>
              We convert each metric into the reviewer task that measures it, screen the panel on your own calls, and seed hidden expert-rated calls so you can see the panel&apos;s reliability from day one.
            </div>
            <a href={ready ? "/portal/agents" : undefined}
              style={{ height: 44, borderRadius: 9, background: ready ? GREEN : "#c8d6d0", color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", cursor: ready ? "pointer" : "not-allowed", marginTop: 2 }}>
              {ready ? "Create the program →" : "Describe your use case to continue"}
            </a>
            <div style={{ fontSize: 11, color: "#93a1ae", textAlign: "center" }}>Prefer to wire it from code? <a href="/portal/connect" style={{ color: GREEN }}>Connect via MCP</a></div>
          </div>
        </div>

      </div>
    </PortalShell>
  );
}
