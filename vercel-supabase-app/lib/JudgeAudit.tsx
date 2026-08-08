"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// Judge-audit workbench · blind human verification of Bolna's LLM judge.
//
// The reviewer sees ONLY the metric's criteria (phrased as a yes/no question),
// the audio and the transcript — never the judge's verdict, score or
// reasoning. They answer Yes or No; agreement with the hidden judge verdict is
// computed later, off-tool. Blind by design: showing the verdict would anchor
// the reviewer and the whole point is to measure the judge, not confirm it.
//
// Wired to the FULL set: /judge_items.json carries all 300 judgments from
// LLM_Eval_check.xlsx WITHOUT verdicts (those live server-side only, in
// lib/judge-key.json, exactly like the Merlin key). Answers persist through
// /api/reviews — one review per (call, metric) via review_mode
// judge_audit_<metric>, so re-answering replaces and answers on the same
// call's other metrics are never clobbered by the route's clear-then-insert.
// Progress is SERVER truth: reload and resume on any device.

type Turn = { role: string; text: string };
type Item = {
  id: string;
  execution_id: string;
  metric: string;
  category: string;
  criteria: string;
  recording_url: string;
  turns: Turn[];
};

// Yes/No question per metric · phrased so YES always means "the problem
// happened", regardless of how the underlying criteria is worded. Uniform
// polarity keeps reviewers from flip-flopping between metrics.
const QUESTION: Record<string, { q: string; yes: string; no: string; hint: string }> = {
  tool_name_leak: {
    q: "Did the agent say an internal tool / function name or an internal ID out loud to the caller?",
    yes: "Yes — leaked",
    no: "No — clean",
    hint: "Things like \"transfer_call\", \"schedule_callback\", a ticket/opaque ID read aloud. Customer-facing words like \"checkout link\" or \"callback\" are NOT leaks.",
  },
  language_adherence: {
    q: "Did the agent speak the wrong language at any point — ignoring what the user spoke or an explicit request to switch?",
    yes: "Yes — wrong language",
    no: "No — matched throughout",
    hint: "A brief mirrored greeting is fine. The agent must follow the user's language and honour explicit switch requests promptly.",
  },
  stuck_in_loop: {
    q: "Did the agent get stuck in a loop — repeating the same or equivalent question / statement / action?",
    yes: "Yes — looped",
    no: "No — progressed",
    hint: "Re-asking once after a genuine mishear is fine. A loop is autonomous repetition that stops the call from moving forward.",
  },
};

const METRIC_LABEL: Record<string, string> = {
  tool_name_leak: "Tool-name leak",
  language_adherence: "Language adherence",
  stuck_in_loop: "Stuck in loop",
};

export default function JudgeAudit({ onBack }: { onBack?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [unsure, setUnsure] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | "error">>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const email = typeof window !== "undefined" ? String(window.localStorage.getItem("auditReviewerEmail") || "").toLowerCase() : "";
  const display = typeof window !== "undefined" ? String(window.localStorage.getItem("auditReviewerName") || email) : "";

  useEffect(() => {
    Promise.all([
      fetch("/judge_items.json").then((r) => r.json()),
      // resume · server truth, so a reload or a second device continues
      fetch(`/api/reviews?reviewer=${encodeURIComponent(email)}&mode_prefix=judge_audit`).then((r) => r.json()).catch(() => ({ reviews: [] }))
    ]).then(([d, prev]) => {
      const its: Item[] = d.items || [];
      setItems(its);
      const a: Record<string, "yes" | "no"> = {}; const u: Record<string, boolean> = {};
      for (const r of prev.reviews || []) {
        for (const f of r.issues_json || []) {
          if (f && f.type === "judge_audit" && f.item_id) {
            if (f.answer === "yes" || f.answer === "no") a[f.item_id] = f.answer;
            if (f.unsure) u[f.item_id] = true;
          }
        }
      }
      setAnswers(a); setUnsure(u);
      const first = its.find((i) => !a[i.id]) || its[0];
      if (first) setOpenId(first.id);
    }).catch(() => setItems([]));
  }, [email]);

  const open = useMemo(() => items.find((i) => i.id === openId) || null, [items, openId]);
  const doneCount = Object.keys(answers).length;

  async function answer(id: string, v: "yes" | "no") {
    setAnswers((a) => ({ ...a, [id]: v }));
    const it = items.find((i) => i.id === id);
    // Auto-advance to the next unanswered call · one question per call means
    // the answer IS the submit, so the queue should just keep flowing.
    const idx = items.findIndex((i) => i.id === id);
    const next = [...items.slice(idx + 1), ...items.slice(0, idx)].find((i) => !( { ...answers, [id]: v } )[i.id]);
    if (next) setTimeout(() => setOpenId(next.id), 350);
    if (!it) return;
    setSaving((s) => ({ ...s, [id]: "saving" }));
    try {
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: it.execution_id,
          reviewer_name: display, reviewer_email: email,
          review_mode: `judge_audit_${it.metric}`,
          vibe_score: "", flow_score: "", llm_rating: "", llm_error_type: "",
          notes: `judge audit · ${it.metric} · ${v}${unsure[id] ? " · unsure" : ""}`,
          issues: [{ type: "judge_audit", item_id: it.id, metric: it.metric, answer: v, unsure: !!unsure[id] }],
          started_at: new Date().toISOString(), duration_taken_sec: 0
        })
      }).then((r) => r.json());
      setSaving((s) => ({ ...s, [id]: res.error ? "error" : "saved" }));
    } catch {
      setSaving((s) => ({ ...s, [id]: "error" }));
    }
  }

  const groups = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const i of items) (g[i.metric] = g[i.metric] || []).push(i);
    return g;
  }, [items]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit" }}>
      {/* ── Sidebar · queue grouped by metric ── */}
      <aside style={{ width: 268, minWidth: 268, borderRight: "1px solid var(--line)", background: "var(--panel)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Judge audit</div>
            {onBack && (
              <button type="button" onClick={onBack} style={{ fontSize: 12, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}>
                ← call review
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Blind check of the LLM judge · {doneCount}/{items.length} done
          </div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--soft)" }}>
            <div style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%`, height: 4, borderRadius: 2, background: "var(--accent)", transition: "width .3s" }} />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 16px" }}>
          {Object.entries(groups).map(([metric, list]) => (
            <div key={metric}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--head)", textTransform: "uppercase", letterSpacing: 0.6, padding: "12px 8px 4px" }}>
                {METRIC_LABEL[metric] || metric}
              </div>
              {list.map((i) => {
                const a = answers[i.id];
                return (
                  <button key={i.id} onClick={() => setOpenId(i.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: openId === i.id ? "var(--soft)" : "transparent" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: a ? "var(--accent)" : "var(--slate)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", color: a ? "var(--muted)" : "var(--ink)" }}>{i.id.slice(0, 8)}</span>
                    {a && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: a === "yes" ? "var(--danger)" : "var(--accent)" }}>{a === "yes" ? "YES" : "NO"}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid var(--line)", fontSize: 11, color: Object.values(saving).includes("error") ? "var(--danger)" : "var(--muted)" }}>
          {Object.values(saving).includes("error")
            ? "Some answers failed to save · re-answer them"
            : "Every answer saves on click · reload resumes where you left off"}
        </div>
      </aside>

      {/* ── Workspace ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {!open ? (
          <div style={{ color: "var(--muted)", marginTop: 80, textAlign: "center" }}>Select a call to start</div>
        ) : (
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {/* Question card · the ONLY framing the reviewer gets. */}
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--shadow)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--on-accent)", background: "var(--accent)", borderRadius: 999, padding: "3px 10px" }}>
                  {METRIC_LABEL[open.metric] || open.metric}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "ui-monospace, monospace" }}>{open.id.slice(0, 8)}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.45 }}>{QUESTION[open.metric]?.q || open.criteria}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>{QUESTION[open.metric]?.hint}</div>
            </div>

            {/* Audio */}
            <div style={{ marginTop: 14, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 16px", boxShadow: "var(--shadow)" }}>
              <audio ref={audioRef} key={open.id} controls preload="none" src={`/api/audio?url=${encodeURIComponent(open.recording_url)}`} style={{ width: "100%" }} />
            </div>

            {/* Transcript */}
            <div style={{ marginTop: 14, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 18px", boxShadow: "var(--shadow)", maxHeight: 380, overflowY: "auto" }}>
              {open.turns.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", alignItems: "baseline" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, width: 44, flexShrink: 0, color: t.role === "agent" ? "var(--accent)" : "var(--blue)" }}>
                    {t.role === "agent" ? "Agent" : "User"}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.55 }}>{t.text}</span>
                </div>
              ))}
            </div>

            {/* Yes / No · the answer is the submit. */}
            <div style={{ display: "flex", gap: 12, marginTop: 18, position: "sticky", bottom: 16 }}>
              <button onClick={() => answer(open.id, "yes")}
                style={{ flex: 1, padding: "15px 0", fontSize: 15.5, fontWeight: 700, borderRadius: 12, cursor: "pointer", boxShadow: "var(--shadow-bar)",
                  border: answers[open.id] === "yes" ? "2px solid var(--danger)" : "1px solid var(--line)",
                  background: answers[open.id] === "yes" ? "var(--danger)" : "var(--panel)",
                  color: answers[open.id] === "yes" ? "#fff" : "var(--danger)" }}>
                {QUESTION[open.metric]?.yes || "Yes"}
              </button>
              <button onClick={() => answer(open.id, "no")}
                style={{ flex: 1, padding: "15px 0", fontSize: 15.5, fontWeight: 700, borderRadius: 12, cursor: "pointer", boxShadow: "var(--shadow-bar)",
                  border: answers[open.id] === "no" ? "2px solid var(--accent-strong)" : "1px solid var(--line)",
                  background: answers[open.id] === "no" ? "var(--accent)" : "var(--panel)",
                  color: answers[open.id] === "no" ? "var(--on-accent)" : "var(--accent-strong)" }}>
                {QUESTION[open.metric]?.no || "No"}
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: "var(--muted)", cursor: "pointer", justifyContent: "center" }}>
              <input type="checkbox" checked={!!unsure[open.id]} onChange={(e) => setUnsure((u) => ({ ...u, [open.id]: e.target.checked }))} />
              I answered, but I&apos;m not fully sure (audio unclear / borderline)
            </label>
          </div>
        )}
      </main>
    </div>
  );
}
