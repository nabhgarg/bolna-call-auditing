"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../../lib/ThemeToggle";

// Public blind-review panel for the Merlin router audit.
// Identity: the review.realloop.in login when present (auditReviewerEmail in
// localStorage, same origin), else a remembered guest name. Progress is
// SERVER-truth: on load we fetch the item_ids this reviewer has already
// submitted, so reloads and device switches resume exactly where they left
// off. The left sidebar lists every question with its submitted/pending state.
// Which AI produced which side lives only in lib/merlin-key.json (server-side,
// imported only by the ops route — never by anything this page can reach).

type Item = { item_id: string; category: string; prompt: string; A: string; B: string };
type Judgment = {
  preference: string;
  confidence: string;
  tags_a: string[];
  tags_b: string[];
  reason: string;
};

const PREFS = ["A much better", "A slightly better", "Tie", "B slightly better", "B much better"];
const CONF = ["Certain", "Moderate"];
const TAGS = [
  "wrong", "incomplete", "ignored-constraint", "truncated",
  "hallucinated", "format", "padding", "refused"
];
const NAME_KEY = "merlinReviewerName";

const blank = (): Judgment => ({ preference: "", confidence: "", tags_a: [], tags_b: [], reason: "" });

// Minimal markdown for model responses: pipe tables, **bold**, and #-headings.
// Everything is HTML-escaped first, so the substitutions below are safe.
function mdToHtml(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let i = 0;
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const inline = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, "$1<i>$2</i>");
  while (i < lines.length) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(lines[i]);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) {
        body.push(cells(lines[i]));
        i++;
      }
      out.push(
        '<div class="mr-tablewrap"><table><thead><tr>' +
          head.map((h) => `<th>${inline(h)}</th>`).join("") +
          "</tr></thead><tbody>" +
          body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
          "</tbody></table></div>"
      );
      continue;
    }
    const line = lines[i];
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    out.push(h ? `<div class="mr-h">${inline(h[2])}</div>` : inline(line));
    i++;
  }
  return out.join("\n");
}

// A reviewer judging whether a summary is faithful has to be able to see what
// was summarised. Two kinds of source appear in prompts:
//   [ASSET:TEXT1 in assets.md] -> our own copy at /merlin/source/<NAME>
//   https://…                  -> the page/video itself
// Both open in a new tab so the reviewer keeps their place and their draft.
function promptWithSources(prompt: string) {
  const parts: React.ReactNode[] = [];
  const re = /\[ASSET:(\w+)[^\]]*\]|https?:\/\/[^\s)]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) {
    if (m.index > last) parts.push(prompt.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <a key={m.index} href={`/merlin/source/${m[1]}`} target="_blank" rel="noreferrer" className="mr-srclink">
          open the source document ({m[1]}) ↗
        </a>
      );
    } else {
      // Trailing punctuation belongs to the sentence, not the URL.
      const url = m[0].replace(/[.,;:]+$/, "");
      const label = url.includes("youtube.com") || url.includes("youtu.be")
        ? "open the video"
        : "open the page";
      parts.push(
        <a key={m.index} href={url} target="_blank" rel="noreferrer" className="mr-srclink">
          {label} ↗
        </a>
      );
      parts.push(m[0].slice(url.length));
    }
    last = m.index + m[0].length;
  }
  parts.push(prompt.slice(last));
  return parts;
}

export default function MerlinReview() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [rosterEmail, setRosterEmail] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [started, setStarted] = useState(false);
  const [loadingResume, setLoadingResume] = useState(true);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [j, setJ] = useState<Judgment>(blank());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [sideOpen, setSideOpen] = useState(true);

  useEffect(() => {
    try { setSideOpen(localStorage.getItem("merlinSideOpen") !== "0"); } catch {}
  }, []);
  function toggleSide() {
    setSideOpen((v) => {
      try { localStorage.setItem("merlinSideOpen", v ? "0" : "1"); } catch {}
      return !v;
    });
  }

  const storeKey = useMemo(() => `merlin-done::${name.trim().toLowerCase()}`, [name]);

  // Load items + resume state. Identity comes from the reviewer-app login
  // (same origin) or a remembered guest name; server-side done-list wins over
  // whatever this browser remembers.
  async function loadFor(identity: string) {
    const res = await fetch(`/api/merlin?reviewer=${encodeURIComponent(identity)}`);
    const d = await res.json();
    const its: Item[] = d.items || [];
    const doneMap: Record<string, boolean> = {};
    try {
      Object.assign(doneMap, JSON.parse(localStorage.getItem(`merlin-done::${identity.trim().toLowerCase()}`) || "{}"));
    } catch {}
    for (const iid of d.done || []) doneMap[iid] = true;
    setItems(its);
    setDone(doneMap);
    const next = its.findIndex((it) => !doneMap[it.item_id]);
    setIdx(next === -1 ? 0 : next);
    setStarted(true);
    setLoadingResume(false);
  }

  useEffect(() => {
    let identity = "";
    try {
      const e = (window.localStorage.getItem("auditReviewerEmail") || "").trim().toLowerCase();
      if (e) {
        setRosterEmail(e);
        identity = e;
      } else {
        identity = (window.localStorage.getItem(NAME_KEY) || "").trim();
      }
    } catch {}
    if (identity) {
      setName(identity);
      loadFor(identity).catch(() => { setErr("Could not load review items."); setLoadingResume(false); });
    } else {
      // No identity yet: fetch items so the intro can show the count.
      fetch("/api/merlin")
        .then((r) => r.json())
        .then((d) => setItems(d.items || []))
        .catch(() => setErr("Could not load review items."))
        .finally(() => setLoadingResume(false));
    }
  }, []);

  function begin() {
    const n = nameInput.trim();
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch {}
    setName(n);
    setLoadingResume(true);
    loadFor(n).catch(() => { setErr("Could not load review items."); setLoadingResume(false); });
  }

  function switchReviewer() {
    try { localStorage.removeItem(NAME_KEY); } catch {}
    setName(""); setRosterEmail(""); setStarted(false); setNameInput(""); setDone({}); setJ(blank());
  }

  const it = items[idx];
  const nDone = Object.values(done).filter(Boolean).length;
  const allDone = items.length > 0 && nDone >= items.length;

  function jumpTo(i: number) {
    setIdx(i);
    setJ(blank());
    setErr("");
    window.scrollTo(0, 0);
  }

  function toggleTag(side: "tags_a" | "tags_b", t: string) {
    setJ((p) => ({
      ...p,
      [side]: p[side].includes(t) ? p[side].filter((x) => x !== t) : [...p[side], t]
    }));
  }

  async function submit() {
    if (!j.preference || !j.confidence || !j.reason.trim()) {
      setErr("The verdict, confidence, and a one-line reason are required.");
      return;
    }
    setSaving(true);
    setErr("");
    const res = await fetch("/api/merlin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer: name.trim(), item_id: it.item_id, ...j })
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      setErr("Save failed — check your connection and try again.");
      return;
    }
    const nextDone = { ...done, [it.item_id]: true };
    setDone(nextDone);
    try { localStorage.setItem(storeKey, JSON.stringify(nextDone)); } catch {}
    setJ(blank());
    const next = items.findIndex((x) => !nextDone[x.item_id]);
    if (next !== -1) setIdx(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="mr-wrap">
      <style>{css}</style>

      <header className="mr-head">
        <div>
          <span className="mr-brand">realloop</span>
          <span className="mr-sub">· Merlin audit — blind review</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          {started && (
            <span className="mr-progress">
              {nDone} / {items.length} submitted{name ? ` · ${name}` : ""}
            </span>
          )}
          <ThemeToggle compact />
        </span>
      </header>

      {loadingResume && <main className="mr-intro"><p className="mr-mutedline">Loading…</p></main>}

      {!loadingResume && !started && (
        <main className="mr-intro">
          <h1>Which answer is better? You decide.</h1>
          <p>
            We asked the same questions to an AI assistant two different ways and
            collected both answers. You&apos;ll see them side by side as{" "}
            <b>A</b> and <b>B</b> — you won&apos;t know which system produced which,
            and the sides are shuffled every time.
          </p>
          <p>
            For each pair: pick the better answer, say how confident you are, tag
            anything broken, and give a one-line reason. Two to three minutes per
            pair, {items.length || "…"} pairs total. Your progress is saved to your
            name, so you can leave and come back — from any device.
          </p>
          <ul>
            <li>The question is the spec — if it asked for 5 bullets, count them.</li>
            <li>Correct and plain beats wrong and polished. Don&apos;t reward length.</li>
            <li>Pick a side when you honestly can; use Tie only when you truly can&apos;t.</li>
          </ul>
          <div className="mr-startrow">
            <input
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && begin()}
            />
            <button className="mr-primary" onClick={begin} disabled={!nameInput.trim() || !items.length}>
              Start reviewing
            </button>
          </div>
          <p className="mr-mutedline">
            On the reviewer roster? <a href="/?next=/merlin">Sign in</a> instead — your
            judgments then count toward your reviewer record.
          </p>
          {err && <p className="mr-err">{err}</p>}
        </main>
      )}

      {!loadingResume && started && (
        <div className={`mr-cols ${sideOpen ? "" : "mr-collapsed"}`}>
          <aside className="mr-side">
            <div className="mr-sidehead">
              {sideOpen && <span>{nDone}/{items.length} done</span>}
              <button className="mr-sidetoggle" onClick={toggleSide}
                title={sideOpen ? "Collapse list" : "Show all questions"}>
                {sideOpen ? "«" : "»"}
              </button>
            </div>
            {sideOpen ? (
              <>
                <div className="mr-sidelist">
                  {items.map((x, i) => (
                    <button
                      key={x.item_id}
                      className={`mr-siderow ${i === idx ? "mr-current" : ""}`}
                      onClick={() => jumpTo(i)}
                    >
                      <span className={`mr-dot ${done[x.item_id] ? "mr-dot-done" : ""}`}>
                        {done[x.item_id] ? "✓" : ""}
                      </span>
                      <span className="mr-sidenum">{String(i + 1).padStart(2, "0")}</span>
                      <span className="mr-sidecat">{x.category}</span>
                    </button>
                  ))}
                </div>
                <div className="mr-sidefoot">
                  <span className="mr-mutedline">{rosterEmail || name}</span>
                  {!rosterEmail && (
                    <a href="#" onClick={(e) => { e.preventDefault(); switchReviewer(); }}>switch</a>
                  )}
                </div>
              </>
            ) : (
              <div className="mr-railcount">{nDone}/{items.length}</div>
            )}
          </aside>

          <main className="mr-main">
            {allDone && (
              <div className="mr-banner">
                All {items.length} pairs submitted — thank you. You can revisit any
                question from the sidebar; resubmitting replaces your earlier answer.
              </div>
            )}
            {it && (
              <>
                {done[it.item_id] && (
                  <div className="mr-banner mr-banner-soft">
                    Already submitted. Grading it again will replace your earlier answer.
                  </div>
                )}
                <section className="mr-prompt">
                  <span className="mr-cat">{it.category} · {idx + 1} of {items.length}</span>
                  <div className="mr-prompttext">{promptWithSources(it.prompt)}</div>
                </section>

                <section className="mr-pair">
                  {(["A", "B"] as const).map((side) => (
                    <article key={side} className="mr-resp">
                      <h3>Response {side}</h3>
                      <div className="mr-resptext" dangerouslySetInnerHTML={{ __html: mdToHtml(it[side]) }} />
                    </article>
                  ))}
                </section>

                <section className="mr-qs">
                  <div className="mr-q">
                    <label>Which response better serves the person who asked?</label>
                    <div className="mr-opts">
                      {PREFS.map((p) => (
                        <button key={p} className={j.preference === p ? "mr-on" : ""} onClick={() => setJ({ ...j, preference: p })}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mr-q">
                    <label>How confident are you?</label>
                    <div className="mr-opts">
                      {CONF.map((c) => (
                        <button key={c} className={j.confidence === c ? "mr-on" : ""} onClick={() => setJ({ ...j, confidence: c })}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(["tags_a", "tags_b"] as const).map((side) => (
                    <div className="mr-q" key={side}>
                      <label>Anything broken in Response {side === "tags_a" ? "A" : "B"}? (optional)</label>
                      <div className="mr-opts mr-tags">
                        {TAGS.map((t) => (
                          <button key={t} className={j[side].includes(t) ? "mr-on-warn" : ""} onClick={() => toggleTag(side, t)}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="mr-q">
                    <label>One-line reason — the decisive difference</label>
                    <textarea
                      value={j.reason}
                      placeholder="e.g., A answered the actual question; B's list is missing 14 entries"
                      onChange={(e) => setJ({ ...j, reason: e.target.value })}
                    />
                  </div>

                  {err && <p className="mr-err">{err}</p>}
                  <div className="mr-navrow">
                    <button className="mr-primary" onClick={submit} disabled={saving}>
                      {saving ? "Saving…" : done[it.item_id] ? "Resubmit" : "Save & next"}
                    </button>
                    <span className="mr-mutedline">Blind review — don&apos;t try to guess which system is which.</span>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

const css = `
.mr-wrap { max-width: 1360px; margin: 0 auto; padding: 0 20px 60px; }
.mr-head { display:flex; justify-content:space-between; align-items:baseline; padding:16px 0; border-bottom:1px solid var(--line); margin-bottom:20px; }
.mr-brand { font-family: var(--font-display); font-weight:700; font-size:18px; }
.mr-sub { color: var(--muted); margin-left:6px; }
.mr-progress { font-family: var(--font-mono); font-size:13px; color: var(--muted); }
.mr-intro { max-width:640px; margin:40px auto; }
.mr-intro h1 { font-family: var(--font-display); font-size:28px; margin:0 0 14px; }
.mr-intro p, .mr-intro li { color:var(--ink-2); line-height:1.6; }
.mr-startrow { display:flex; gap:10px; margin-top:22px; margin-bottom:10px; }
.mr-startrow input { flex:1; border:1px solid var(--line); border-radius:6px; padding:10px 12px; background:var(--panel); }
.mr-primary { background: var(--accent); border-color: var(--accent); color:var(--on-accent); font-weight:600; }
.mr-primary:hover { background: var(--accent-strong); }
.mr-cols { display:grid; grid-template-columns:210px minmax(0,1fr); gap:18px; align-items:start; }
.mr-cols.mr-collapsed { grid-template-columns:46px minmax(0,1fr); gap:12px; }
@media (max-width: 980px) { .mr-cols, .mr-cols.mr-collapsed { grid-template-columns:1fr; } .mr-side { display:none; } }
.mr-side { position:sticky; top:14px; background:var(--panel); border:1px solid var(--line); border-radius:10px; box-shadow:var(--shadow); display:flex; flex-direction:column; max-height:calc(100vh - 40px); }
.mr-sidehead { padding:8px 8px 8px 14px; border-bottom:1px solid var(--line); font-family:var(--font-mono); font-size:12px; color:var(--muted); display:flex; align-items:center; justify-content:space-between; gap:6px; }
.mr-collapsed .mr-sidehead { padding:8px 4px; justify-content:center; border-bottom:none; }
.mr-sidetoggle { border:none; background:none; min-height:0; padding:2px 6px; color:var(--muted); font-size:14px; line-height:1; cursor:pointer; border-radius:5px; }
.mr-sidetoggle:hover { background:var(--soft); color:var(--ink); }
.mr-railcount { writing-mode:vertical-rl; text-align:center; padding:8px 0 12px; font-family:var(--font-mono); font-size:11.5px; color:var(--muted); }
.mr-sidelist { overflow-y:auto; padding:6px; }
.mr-siderow { display:flex; align-items:center; justify-content:flex-start; gap:8px; width:100%; text-align:left; border:none; background:none; padding:6px 8px; border-radius:6px; cursor:pointer; min-height:0; }
.mr-siderow:hover { background:var(--soft); }
.mr-current { background:var(--soft); outline:1px solid var(--line); }
.mr-dot { width:16px; height:16px; flex:none; border-radius:9px; border:1px solid var(--line); font-size:10px; line-height:14px; text-align:center; color:var(--on-accent); background:transparent; }
.mr-dot-done { background:var(--accent); border-color:var(--accent); }
.mr-sidenum { font-family:var(--font-mono); font-size:11.5px; color:var(--muted); }
.mr-sidecat { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mr-sidefoot { padding:9px 14px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:space-between; align-items:center; font-size:12px; }
.mr-banner { background:var(--submitted); border:1px solid var(--tx-preview-line); color:var(--accent-strong); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:13.5px; }
.mr-banner-soft { background:var(--wash-cream); border-color:var(--wash-warn-line); color:var(--warn); }
.mr-prompt { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; box-shadow: var(--shadow); margin-bottom:14px; }
.mr-cat { font-family: var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:1px; color: var(--accent-strong); }
.mr-prompttext { white-space:pre-wrap; margin-top:6px; max-height:200px; overflow-y:auto; }
.mr-srclink { display:inline-block; background:var(--soft); border:1px solid var(--line); border-radius:6px; padding:1px 9px; margin:0 2px; font-size:13px; font-weight:600; color:var(--accent-strong); text-decoration:none; }
.mr-srclink:hover { background:var(--panel); border-color:var(--accent); }
.mr-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width: 860px) { .mr-pair { grid-template-columns:1fr; } }
.mr-resp { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; box-shadow: var(--shadow); }
.mr-resp h3 { margin:0 0 8px; font-family: var(--font-mono); font-size:12px; letter-spacing:1px; text-transform:uppercase; color: var(--muted); }
.mr-resptext { white-space:pre-wrap; max-height:46vh; overflow-y:auto; line-height:1.55; font-size:14.5px; }
.mr-resptext .mr-h { font-weight:600; font-size:15px; margin:6px 0 2px; }
.mr-tablewrap { overflow-x:auto; white-space:normal; margin:6px 0; }
.mr-resptext table { border-collapse:collapse; font-size:13px; min-width:60%; }
.mr-resptext th, .mr-resptext td { border:1px solid var(--line); padding:5px 9px; text-align:left; vertical-align:top; }
.mr-resptext th { background:var(--soft); font-weight:600; }
.mr-qs { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; margin-top:14px; box-shadow: var(--shadow); }
.mr-q { margin-bottom:16px; }
.mr-q label { display:block; font-weight:600; margin-bottom:8px; font-size:14.5px; }
.mr-opts { display:flex; flex-wrap:wrap; gap:8px; }
.mr-opts button { border-radius:20px; padding:6px 14px; font-size:13.5px; }
.mr-opts.mr-tags button { border-radius:6px; font-family: var(--font-mono); font-size:12.5px; }
.mr-on { background: var(--accent) !important; border-color: var(--accent) !important; color:var(--on-accent) !important; }
.mr-on-warn { background: var(--warn) !important; border-color: var(--warn) !important; color:var(--on-accent) !important; }
.mr-q textarea { width:100%; min-height:48px; border:1px solid var(--line); border-radius:6px; padding:9px 11px; background:var(--panel); }
.mr-navrow { display:flex; align-items:center; gap:14px; }
.mr-mutedline { color: var(--muted); font-size:13px; }
.mr-err { color:var(--red-bar); font-size:13.5px; }
`;
