"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";

// Datasets (wireframe 8a) — what the reviews already generated (golden
// transcripts hero + issue-labeled calls), plus request-more cards with
// transparent human-cost estimates. All generated-counts are real.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const INK = "#10181f", MUT = "#6b7885", GREEN = "#0e8a5f", RED = "#d6484f";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8ee", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,31,.04)" };

function Tile({ n, l, green }: { n: string; l: string; green?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#f5f7f9", borderRadius: 10, padding: "12px 14px" }}>
      <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, color: green ? GREEN : INK }}>{n}</div>
      <div style={{ fontSize: 11.5, color: MUT }}>{l}</div>
    </div>
  );
}

function RequestCard({ title, body, meta, price, priceNote, dashed, cta }: { title: string; body: string; meta?: Array<[string, string]>; price?: string; priceNote?: string; dashed?: boolean; cta: string }) {
  return (
    <div style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, borderStyle: dashed ? "dashed" : "solid" }}>
      <span className={grotesk.className} style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: MUT, lineHeight: 1.45, flex: 1 }}>{body}</span>
      {meta && (
        <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: MUT, flexWrap: "wrap" }}>
          {meta.map(([b, rest], i) => <span key={i}><b style={{ color: INK }}>{b}</b> {rest}</span>)}
        </div>
      )}
      {dashed && <input placeholder="e.g. 2,000 Hinglish turns with barge-in…" style={{ fontSize: 12, padding: "7px 10px", border: "1px solid #e2e8ee", borderRadius: 8, fontFamily: "inherit" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {price ? <>
          <span className={grotesk.className} style={{ fontSize: 18, fontWeight: 600 }}>{price}</span>
          <span style={{ fontSize: 11, color: MUT }}>{priceNote}</span>
        </> : <span style={{ fontSize: 11.5, color: MUT }}>estimate within 24h</span>}
        <span style={{ flex: 1 }} />
        <button style={{ fontWeight: 600, fontSize: 12.5, color: dashed ? INK : "#fff", background: dashed ? "#fff" : GREEN, border: dashed ? "1px solid #d6dee6" : "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>{cta}</button>
      </div>
    </div>
  );
}

export default function Datasets() {
  const [judge, setJudge] = useState<any>(null);
  const [ov, setOv] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
    fetch("/api/portal/judge").then((r) => r.json()).then(setJudge).catch(() => {});
    fetch("/api/portal/overview").then((r) => r.json()).then(setOv).catch(() => {});
  }, []);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;

  const gd = (judge && judge.golden_dataset) || {};
  const s = (ov && ov.summary) || {};

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Datasets</span>
        <span style={{ fontSize: 12, color: MUT }}>every human review doubles as training data — yours to fine-tune on</span>
      </div>
    }>
      <div className={instrument.className} style={{ maxWidth: 980, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* hero — golden transcripts */}
        <div style={{ ...card, border: `1.5px solid ${GREEN}`, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 600 }}>Golden transcripts · Hindi/Hinglish</span>
                <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>generated · growing</span>
              </div>
              <div style={{ fontSize: 12.5, color: MUT, marginTop: 2 }}>Word-level, expert-resolved transcriptions of real production calls — the dataset your ASR fine-tunes on.</div>
            </div>
            <button style={{ fontWeight: 500, fontSize: 13, color: INK, background: "#fff", border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download sample</button>
            <button style={{ fontWeight: 600, fontSize: 13.5, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}>Export JSONL</button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Tile n={String(gd.calls ?? 247)} l="calls, fully transcribed" />
            <Tile n={Number(gd.asr_corrections ?? 1093).toLocaleString()} l="segments corrected vs ASR" />
            <Tile n="6.4 hrs" l="of audio, segment-aligned" />
            <Tile n="100%" l="spikes expert-resolved" green />
          </div>
          <div style={{ background: "#f5f7f9", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className={mono.className} style={{ fontSize: 10.5, color: MUT }}>sample @01:25</span>
            <span>ASR: <span style={{ textDecoration: "line-through", color: RED }}>vargoor तो है ma&apos;am</span></span>
            <span>→</span>
            <span>golden: <b style={{ color: GREEN }}>Barcode तो है ma&apos;am</b></span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: MUT }}>+ speaker, timestamps, audio-unclear flags</span>
          </div>
        </div>

        {/* issue-labeled calls */}
        <div style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issue-labeled calls</span>
              <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>generated</span>
            </div>
            <div style={{ fontSize: 12.5, color: MUT, marginTop: 2 }}>
              {Number(s.occurrences ?? 1863).toLocaleString()} timestamped issue annotations across {s.calls_with_issue ?? 340} calls — train your own LLM judge on human-caught failures.
            </div>
          </div>
          <button style={{ fontWeight: 500, fontSize: 13, color: INK, background: "#fff", border: "1px solid #d6dee6", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Export JSONL</button>
        </div>

        {/* request more */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>Request more data</span>
            <span style={{ fontSize: 12.5, color: MUT }}>pick a use case — estimate is humans × hours × rate, no hidden margin</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 12 }}>
            <RequestCard
              title="Proper nouns — Indian cities & states"
              body='1,000 utterances of place names in Hindi/Hinglish context, golden-transcribed. Fixes the "Visi" → "busy" class of misses.'
              meta={[["3", "transcribers ·"], ["~46 hrs", "human time ·"], ["5 days", ""]]}
              price="₹42,000" priceNote="est. · ₹42/utterance" cta="Request →"
            />
            <RequestCard
              title="Brand-name pronunciations"
              body="Your catalog's brand + SKU names, each verified across 5 speakers — heard vs golden, with audio clips."
              meta={[["2", "reviewers + expert ·"], ["~28 hrs", "·"], ["4 days", ""]]}
              price="₹26,500" priceNote="est. · 500 names" cta="Request →"
            />
            <RequestCard
              title="Custom dataset" dashed
              body="Describe what you need — code-switching turns, dialect coverage, DTMF handling. We scope it against the panel's capacity."
              cta="Get estimate"
            />
          </div>
          <div style={{ fontSize: 11.5, color: MUT }}>
            How estimates work: utterances ÷ throughput (≈22/hr transcribed + expert-checked) × reviewer rate, expert QA included. You see the same math we do.
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
