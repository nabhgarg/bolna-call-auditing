"use client";

import React, { useEffect, useState } from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, PURPLE, card } from "../../../lib/ui";
import { isPortalUser } from "../../../lib/role";

// Connect via MCP · the developer path into the same pipeline.
// An already-onboarded client's engineer adds our MCP server to their coding
// agent and onboards a use case for one of their own agents without opening
// this portal. Same resolver, same server-side prices, same panel.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

const KEY = "rl_demo_bolna_2026";

const TOOLS: [string, string, "read" | "write"][] = [
  ["list_agents", "Your agents, calls reviewed, quality score and biggest issue.", "read"],
  ["resolve_use_case", "Describe the job, get the checks, routing and price. Nothing is created.", "read"],
  ["create_use_case", "Put it in the pipeline for one agent. Screening starts the same day.", "write"],
  ["get_reliability", "Panel agreement and agreement with hidden expert-rated calls.", "read"],
  ["get_findings", "What the panel actually caught, with playable timestamps.", "read"],
];

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => {}); }}
      style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: 7, border: "1px solid #d6dee6", background: "#fff", color: done ? GREEN : "#4d5a66", cursor: "pointer", flex: "none", fontFamily: "inherit" }}>
      {done ? "✓ copied" : "Copy"}
    </button>
  );
}

function Cmd({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#0f1720", borderRadius: 10, padding: "13px 14px" }}>
      <code className={mono.className} style={{ flex: 1, fontSize: 12, lineHeight: 1.7, color: "#dbe6ef", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{children}</code>
      <Copy text={text} />
    </div>
  );
}

export default function Connect() {
  const [origin, setOrigin] = useState("https://bolna-call-auditing.vercel.app");
  const [showKey, setShowKey] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(isPortalUser());
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = `${origin}/api/mcp`;
  const addCmd = `claude mcp add --transport http realloop ${url} \\\n  --header "Authorization: Bearer ${KEY}"`;
  const curlCmd = `curl -s ${url} \\\n  -H "Authorization: Bearer ${KEY}" \\\n  -H "content-type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to your team. <a href="/portal/login?next=/portal/connect" style={{ color: GREEN }}>Log in</a> to see this program, or <a href="/portal/new-use-case" style={{ color: GREEN }}>start a use case</a>.</main>;

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "13px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Connect via MCP</span>
        <span style={{ fontSize: 12.5, color: MUT }}>onboard a use case from your terminal · as easy as running an LLM judge</span>
      </div>
    }>
      <div className={instrument.className} style={{ display: "grid", gridTemplateColumns: "minmax(0, 820px)", gap: 16, padding: "16px 22px 30px", alignItems: "start", color: INK }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>1 · Add RealLoop to your coding agent</span>
              <div style={{ fontSize: 12.5, color: MUT, marginTop: 3 }}>One command. Your engineers do not need portal logins.</div>
            </div>
            <Cmd text={addCmd.replace(/\\\n\s*/g, " ")}>{addCmd}</Cmd>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "#f5f7f9", borderRadius: 9, padding: "10px 12px" }}>
              <span style={{ fontSize: 12, color: MUT, flex: "none" }}>Program key</span>
              <code className={mono.className} style={{ fontSize: 12, color: INK }}>{showKey ? KEY : KEY.slice(0, 8) + "•".repeat(12)}</code>
              <button onClick={() => setShowKey(!showKey)} style={{ fontSize: 11.5, color: "#4d5a66", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>{showKey ? "hide" : "reveal"}</button>
              <span style={{ flex: 1 }} />
              <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 10.5, fontWeight: 600, padding: "3px 9px" }}>Bolna · live</span>
            </div>
          </div>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>2 · Onboard a use case in plain language</span>
              <div style={{ fontSize: 12.5, color: MUT, marginTop: 3 }}>Your engineer describes the problem. The agent picks the tools.</div>
            </div>

            <div style={{ border: "1px solid #e6ebf0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#fbfcfd", padding: "12px 14px", borderBottom: "1px solid #eef2f6", display: "flex", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: INK, color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>FDE</span>
                <span style={{ fontSize: 13, lineHeight: 1.6 }}>Our appliance support agent keeps mishearing the model number customers read out, and it sometimes quotes a warranty period that is not in our policy doc. Put humans on it.</span>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                {[["list_agents", "found Field Support · Appliances"], ["resolve_use_case", "2 checks, priced per call"], ["create_use_case", "in the pipeline, screening starts today"]].map(([t, r], i) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12 }}>
                    <span className={mono.className} style={{ fontSize: 10.5, color: PURPLE, background: "#f3eefc", borderRadius: 6, padding: "3px 8px", flex: "none" }}>{i + 1} · {t}</span>
                    <span style={{ color: MUT }}>{r}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 10, fontSize: 12.5, lineHeight: 1.65, color: "#4d5a66" }}>
                  {/* rates only · the weekly volumes here came from a call count
                      nobody gave us, the same invented figure the intake stopped
                      quoting. A per-call rate is true whatever the volume is. */}
                  <b style={{ color: INK }}>Transcription accuracy</b> · 100% human · <span className={mono.className} style={{ fontSize: 11 }}>₹34 per call</span><br />
                  <b style={{ color: INK }}>Factual accuracy</b> · human verified · <span className={mono.className} style={{ fontSize: 11 }}>₹4 + ₹31 per verified call</span><br />
                  <span style={{ color: MUT }}>Screening starts today on this agent&apos;s own recordings. First findings land in Agent insights on day 4.</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 12, marginTop: 2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>The tools it called, and the rest it can<span style={{ color: MUT, fontWeight: 400 }}> · reads are safe to run, creates ask first</span></div>
              {TOOLS.map(([n, d, kind]) => (
                <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, borderTop: "1px solid #eef2f6", paddingTop: 9 }}>
                  <code className={mono.className} style={{ fontSize: 11.5, color: INK, width: 152, flex: "none" }}>{n}</code>
                  <span style={{ fontSize: 12.5, color: "#4d5a66", flex: 1, lineHeight: 1.5 }}>{d}</span>
                  <span style={{ borderRadius: 999, fontSize: 10, fontWeight: 600, padding: "3px 8px", flex: "none", background: kind === "write" ? "#fdf4e3" : "#eef2f6", color: kind === "write" ? "#b07a15" : MUT }}>{kind === "write" ? "creates" : "reads"}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: MUT }}>The agent is told to show you the estimate before it creates anything · nothing runs until your engineer approves it.</div>
          </div>

          <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
            <div>
              <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Not on Claude Code?</span>
              <div style={{ fontSize: 12.5, color: MUT, marginTop: 3 }}>It is a plain JSON-RPC endpoint · any MCP client, or curl.</div>
            </div>
            <Cmd text={curlCmd.replace(/\\\n\s*/g, " ")}>{curlCmd}</Cmd>
          </div>
        </div>


      </div>
    </PortalShell>
  );
}
