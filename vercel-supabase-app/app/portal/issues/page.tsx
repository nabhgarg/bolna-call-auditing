"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, card } from "../../../lib/ui";

// N2 · issue drill-down, evidence-backed. Every count on the portal home
// opens here as playable rows: call + timestamp + finding + who caught it.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });


const TYPES: Array<[string, string]> = [
  ["asr", "Wrong / missing transcription"], ["response", "Response appropriateness"], ["pronunciation", "Pronunciation misses"],
  ["proper_noun", "Proper nouns & city names"], ["tone", "Naturalness of the call"], ["latency", "Slow responses"], ["bargein", "Barge-ins"]
];

function Inner() {
  const params = useSearchParams();
  const type = params.get("type") || "asr";
  const [data, setData] = useState<any>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed((window.localStorage.getItem("auditReviewerRole") || "") === "expert");
  }, []);
  useEffect(() => {
    setData(null);
    fetch(`/api/portal/issues?type=${encodeURIComponent(type)}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [type]);

  function play(row: any) {
    const a = audioRef.current;
    if (!a) return;
    const key = `${row.call_id}@${row.ts}`;
    a.src = `/api/audio?url=${encodeURIComponent(row.recording_url)}`;
    const secs = row.ts_sec !== undefined ? row.ts_sec : (() => { const m = String(row.ts || "0:0").split(":"); return Number(m[0]) * 60 + Number(m[1] || 0); })();
    const go = () => { try { a.currentTime = Math.max(0, secs - 2); } catch {} a.play().catch(() => {}); };
    if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
    setPlaying(key);
  }

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to experts. Log in on the <a href="/" style={{ color: GREEN }}>main app</a> first.</main>;

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "10px 20px" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Issue evidence</span>
        <a href="/portal/agents" style={{ fontSize: 12, color: MUT, textDecoration: "none" }}>← Agent insights</a>
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TYPES.map(([t, label]) => (
            <a key={t} href={`/portal/issues?type=${t}`}
              style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 999, textDecoration: "none",
                background: t === type ? INK : "#fff", color: t === type ? "#fff" : "#4d5a66", border: "1px solid #e2e8ee" }}>
              {label}
            </a>
          ))}
        </div>
        {!data ? <div style={{ color: MUT }}>Loading evidence…</div> : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className={grotesk.className} style={{ fontSize: 22, fontWeight: 600 }}>{data.title} · {(data.caught.machine + data.caught.human)} findings</span>
              <span style={{ fontSize: 12, color: MUT }}>{data.note}</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...card, flex: 1, padding: "12px 16px", background: "#f4effd", borderColor: "#e2d8f6" }}>
                <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, color: PURPLE }}>{data.caught.machine}</div>
                <div style={{ fontSize: 11.5, color: MUT }}>machine caught (telemetry)</div>
              </div>
              <div style={{ ...card, flex: 1, padding: "12px 16px", background: "#e7f4ee", borderColor: "#cfe9dd" }}>
                <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600, color: GREEN }}>{data.caught.human}</div>
                <div style={{ fontSize: 11.5, color: MUT }}>human caught</div>
              </div>
              {data.calls_affected !== undefined && (
                <div style={{ ...card, flex: 1, padding: "12px 16px" }}>
                  <div className={grotesk.className} style={{ fontSize: 22, fontWeight: 600 }}>{data.calls_affected}</div>
                  <div style={{ fontSize: 11.5, color: MUT }}>calls affected</div>
                </div>
              )}
            </div>
            <div style={{ ...card, padding: 8 }}>
              {(data.rows || []).map((r: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderBottom: i < data.rows.length - 1 ? "1px solid #eef2f6" : "none", fontSize: 13 }}>
                  <button onClick={() => play(r)} title="play this moment"
                    style={{ width: 30, height: 30, borderRadius: 999, background: playing === `${r.call_id}@${r.ts}` ? GREEN : INK, color: "#fff", border: "none", cursor: "pointer", flex: "none", fontSize: 11 }}>▶</button>
                  <span style={{ fontFamily: "var(--font-mono, ui-monospace)", fontSize: 12, color: MUT, flex: "none" }}>{String(r.call_id).slice(0, 8)} @{r.ts || "-"}</span>
                  <span style={{ flex: "none", fontSize: 11, padding: "2px 9px", borderRadius: 6, background: r.source === "human" ? "#e7f4ee" : "#f4effd", color: r.source === "human" ? GREEN : PURPLE, border: "1px solid " + (r.source === "human" ? "#cfe9dd" : "#e2d8f6") }}>{r.source}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.text}</span>
                  <span style={{ flex: "none", fontSize: 11, color: MUT, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.agent}</span>
                </div>
              ))}
              {(!data.rows || !data.rows.length) && <div style={{ padding: 14, color: MUT, fontSize: 13 }}>No findings of this type yet.</div>}
            </div>
          </>
        )}
        <audio ref={audioRef} controls style={{ width: "100%", height: 34 }} />
      </div>
    </PortalShell>
  );
}

export default function IssueDrilldown() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
