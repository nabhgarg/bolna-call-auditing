"use client";

import React from "react";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { INK, MUT, GREEN, AMBER, RED } from "../../../lib/ui";

// The printed report.
//
// "Download report" used to print the screen: a nav-less screenshot of a
// master-detail layout, showing the ranked list beside whichever agent happened
// to be selected. That is a picture of an app, not a document · nobody can
// forward it to a head of support and have it stand on its own.
//
// This renders a separate artefact from the same data, in the order the
// questions actually get asked: how is the fleet doing, what should we fix
// first, which agent is which, and how far can these numbers be trusted. It is
// display:none on screen and only exists on paper (see .print-only in
// styles.css), so it never competes with the interactive view.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

type L2 = { key: string; label: string; human_calls: number; llm_calls: number; occ: number; subtypes: [string, number][] };
type Agent = { agent: string; avg: number; calls: number; avg_raters: number; reviewed: number; calls_with_issue: number; bad_pct: number; trend: { first: number; last: number }; l2: L2[] };
type Reliability = { inter_panel: number; vs_gt: number; calls: number } | null;

const scoreColor = (v: number) => (v >= 3.4 ? GREEN : v >= 3 ? AMBER : RED);
// Clamped on purpose. `calls_with_issue` comes back larger than `calls` for at
// least one agent in the live feed, and human_calls + llm_calls double-counts a
// call that both a reviewer and the judge flagged. Neither can exceed the
// agent's own call count in reality, and a report claiming 106% destroys trust
// in every other figure on the page.
const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);
const affectedCalls = (r: L2, calls: number) => Math.min((r.human_calls || 0) + (r.llm_calls || 0), calls || 0);

export default function ReportPrint({
  agents, reliability, program, verdictLabel
}: {
  agents: Agent[];
  reliability: Reliability;
  program: string;
  verdictLabel: (a: Agent) => string;
}) {
  if (!agents.length) return null;

  const totalCalls = agents.reduce((s, a) => s + (a.calls || 0), 0);
  const totalIssue = agents.reduce((s, a) => s + (a.calls_with_issue || 0), 0);
  // Volume-weighted · a five-call agent scoring 1.0 must not drag the fleet
  // average as hard as a hundred-call agent does.
  const fleetAvg = totalCalls
    ? agents.reduce((s, a) => s + (a.avg || 0) * (a.calls || 0), 0) / totalCalls
    : 0;
  const majorPct = totalCalls
    ? Math.round(agents.reduce((s, a) => s + ((a.bad_pct || 0) / 100) * (a.calls || 0), 0) / totalCalls * 100)
    : 0;

  // Fleet-wide priorities: same issue type summed across every agent, ranked by
  // how many calls it touches rather than by raw finding count, because one
  // call can carry a dozen findings of the same kind.
  const byType = new Map<string, { label: string; calls: number; occ: number; agents: number }>();
  agents.forEach((a) => (a.l2 || []).forEach((r) => {
    const affected = affectedCalls(r, a.calls);
    if (!affected) return;
    const cur = byType.get(r.key) || { label: r.label, calls: 0, occ: 0, agents: 0 };
    cur.calls += affected; cur.occ += r.occ || 0; cur.agents += 1;
    byType.set(r.key, cur);
  }));
  const priorities = [...byType.values()].sort((a, b) => b.calls - a.calls).slice(0, 3);

  const attention = agents.filter((a) => a.avg <= 2.9).sort((a, b) => a.avg - b.avg);
  const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const th: React.CSSProperties = { textAlign: "left", fontSize: 8.5, fontWeight: 600, color: MUT, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 8px 5px 0", borderBottom: `1px solid #e2e8ee` };
  const td: React.CSSProperties = { fontSize: 10, padding: "6px 8px 6px 0", borderBottom: "1px solid #eef2f6", verticalAlign: "top" };

  return (
    <div className={`print-only ${instrument.className}`} style={{ color: INK }}>

      {/* ---------- masthead ---------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderBottom: `2px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: GREEN, flex: "none", marginTop: 3 }} />
        <div style={{ flex: 1 }}>
          <div className={grotesk.className} style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>Call quality report</div>
          <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>{program} · {agents.length} agents · {totalCalls.toLocaleString()} calls reviewed by a human panel</div>
        </div>
        <div className={mono.className} style={{ fontSize: 9, color: MUT, textAlign: "right", lineHeight: 1.5 }}>
          realloop.in<br />{generated}
        </div>
      </div>

      {/* ---------- headline numbers ---------- */}
      <div style={{ display: "flex", gap: 0, border: "1px solid #e2e8ee", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        {[
          { v: fleetAvg.toFixed(1) + " / 4", l: "average call quality", s: "scored by people, not a model", c: scoreColor(fleetAvg) },
          { v: pct(totalIssue, totalCalls) + "%", l: "calls with at least one issue", s: `${totalIssue.toLocaleString()} of ${totalCalls.toLocaleString()}`, c: INK },
          { v: majorPct + "%", l: "rated a major failure", s: "1 or 2 out of 4", c: majorPct > 25 ? RED : INK },
          reliability
            ? { v: reliability.vs_gt + "%", l: "panel matches a hidden expert", s: "within 1 point", c: GREEN }
            : { v: "·", l: "panel reliability", s: "not yet measured", c: MUT }
        ].map((k, i) => (
          <div key={i} style={{ flex: 1, padding: "10px 12px", borderLeft: i ? "1px solid #e2e8ee" : "none" }}>
            <div className={grotesk.className} style={{ fontSize: 20, fontWeight: 700, color: k.c, lineHeight: 1.1 }}>{k.v}</div>
            <div style={{ fontSize: 9, fontWeight: 600, marginTop: 3 }}>{k.l}</div>
            <div style={{ fontSize: 8.5, color: MUT, marginTop: 1 }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* ---------- what to fix first ---------- */}
      <div className={grotesk.className} style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>What to fix first</div>
      <div style={{ fontSize: 9.5, color: MUT, marginBottom: 8 }}>Ranked by how many calls each problem touches across the whole fleet, not by how many findings it generated · one call can carry a dozen findings of the same kind.</div>
      <ol style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
        {priorities.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "6px 0", borderTop: i ? "1px solid #eef2f6" : "none" }}>
            <span className={mono.className} style={{ fontSize: 9, fontWeight: 600, color: MUT }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 10.5 }}>
              <b>{p.label}</b>
              <span style={{ color: MUT }}> · {p.calls} affected calls across {p.agents} agent{p.agents === 1 ? "" : "s"}, {p.occ.toLocaleString()} findings</span>
            </span>
          </li>
        ))}
      </ol>

      {/* ---------- the fleet ---------- */}
      <div className={grotesk.className} style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Every agent, worst first</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={th}>Agent</th>
            <th style={{ ...th, textAlign: "right" }}>Calls</th>
            <th style={{ ...th, textAlign: "right" }}>Raters</th>
            <th style={{ ...th, textAlign: "right" }}>Quality</th>
            <th style={{ ...th, textAlign: "right" }}>With issue</th>
            <th style={th}>Defining problem</th>
          </tr>
        </thead>
        <tbody>
          {[...agents].sort((a, b) => a.avg - b.avg).map((a) => (
            <tr key={a.agent}>
              <td style={{ ...td, fontWeight: 600 }}>{a.agent}</td>
              <td style={{ ...td, textAlign: "right" }} className={mono.className}>{a.calls}</td>
              <td style={{ ...td, textAlign: "right" }} className={mono.className}>{(a.avg_raters || 0).toFixed(1)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700, color: scoreColor(a.avg) }} >{a.avg?.toFixed(1)}</td>
              <td style={{ ...td, textAlign: "right" }} className={mono.className}>{pct(a.calls_with_issue, a.calls)}%</td>
              <td style={{ ...td, color: MUT }}>{verdictLabel(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- the ones that need work ---------- */}
      {attention.length > 0 && (
        <div style={{ breakBefore: "page" } as React.CSSProperties}>
          <div className={grotesk.className} style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Agents needing attention</div>
          <div style={{ fontSize: 9.5, color: MUT, marginBottom: 10 }}>Scoring 2.9 or below out of 4. What is breaking on each, ranked by affected calls.</div>
          {attention.map((a) => (
            <div key={a.agent} style={{ border: "1px solid #e2e8ee", borderRadius: 8, padding: "10px 12px", marginBottom: 8, breakInside: "avoid" } as React.CSSProperties}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span className={grotesk.className} style={{ fontSize: 11.5, fontWeight: 600 }}>{a.agent}</span>
                <span className={mono.className} style={{ fontSize: 12, fontWeight: 700, color: scoreColor(a.avg) }}>{a.avg?.toFixed(1)}</span>
                <span style={{ fontSize: 9, color: MUT }}>· {a.calls} calls · {pct(a.calls_with_issue, a.calls)}% with an issue · {a.bad_pct}% major failure</span>
                <span style={{ flex: 1 }} />
                {a.trend && (
                  <span style={{ fontSize: 9, color: a.trend.last >= a.trend.first ? GREEN : RED }}>
                    {a.trend.last >= a.trend.first ? "improving" : "declining"} · {a.trend.first?.toFixed(1)} to {a.trend.last?.toFixed(1)}
                  </span>
                )}
              </div>
              {(a.l2 || []).filter((r) => affectedCalls(r, a.calls) > 0)
                .sort((x, y) => affectedCalls(y, a.calls) - affectedCalls(x, a.calls))
                .slice(0, 4)
                .map((r) => {
                  const affected = affectedCalls(r, a.calls);
                  return (
                    <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <span style={{ fontSize: 9.5, width: 150, flex: "none" }}>{r.label}</span>
                      <span style={{ flex: 1, height: 5, background: "#eef2f6", borderRadius: 3, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${pct(affected, a.calls)}%`, background: GREEN }} />
                      </span>
                      <span className={mono.className} style={{ fontSize: 9, color: MUT, width: 118, textAlign: "right", flex: "none" }}>
                        {affected} of {a.calls} calls · {r.occ} findings
                      </span>
                    </div>
                  );
                })}
              {(a.l2 || []).length === 0 && <div style={{ fontSize: 9.5, color: MUT }}>No issue types logged yet for this agent.</div>}
            </div>
          ))}
        </div>
      )}

      {/* ---------- method ---------- */}
      <div style={{ borderTop: "1px solid #e2e8ee", marginTop: 14, paddingTop: 10, breakInside: "avoid" } as React.CSSProperties}>
        <div className={grotesk.className} style={{ fontSize: 11, fontWeight: 600, marginBottom: 5 }}>How to read this</div>
        <div style={{ fontSize: 9, lineHeight: 1.65, color: "#4b5762" }}>
          Every call in this report was listened to by a trained human reviewer, and most by more than one · the raters column is the average number of people per call for that agent. Quality is scored 1 to 4, where 1 and 2 count as a major failure. Issue counts are per call, so an agent can have more findings than calls.
          {reliability && (
            <> The panel itself is audited: on a hidden set of expert-rated calls, reviewers land within one point of each other {reliability.inter_panel}% of the time and within one point of the expert {reliability.vs_gt}% of the time, across {reliability.calls?.toLocaleString?.() || reliability.calls} scored calls. Where that agreement is low, treat the agent-level number as directional rather than exact.</>
          )}
        </div>
      </div>
    </div>
  );
}
