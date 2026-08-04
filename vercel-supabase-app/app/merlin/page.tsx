"use client";

import { useEffect, useMemo, useState } from "react";

// Public blind-review panel for the Merlin router audit.
// Anyone can grade: enter a name, judge each blinded pair, done.
// Which AI produced which side lives only in lib/merlin-key.json (server-side,
// never imported by any route this page can reach).

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

const blank = (): Judgment => ({ preference: "", confidence: "", tags_a: [], tags_b: [], reason: "" });

export default function MerlinReview() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [j, setJ] = useState<Judgment>(blank());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/merlin")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setErr("Could not load review items."));
  }, []);

  const storeKey = useMemo(() => `merlin-done::${name.trim().toLowerCase()}`, [name]);

  function begin() {
    if (!name.trim()) return;
    const prev = JSON.parse(localStorage.getItem(storeKey) || "{}");
    setDone(prev);
    const next = items.findIndex((it) => !prev[it.item_id]);
    setIdx(next === -1 ? 0 : next);
    setStarted(true);
  }

  const it = items[idx];
  const nDone = Object.keys(done).length;
  const finished = items.length > 0 && nDone >= items.length;

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
    localStorage.setItem(storeKey, JSON.stringify(nextDone));
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
          <span className="mr-sub">· Merlin router audit — blind review</span>
        </div>
        {started && !finished && (
          <span className="mr-progress">
            {nDone} / {items.length} graded
          </span>
        )}
      </header>

      {!started && (
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
            pair, {items.length || "…"} pairs total. Your progress saves in this
            browser, so you can leave and come back.
          </p>
          <ul>
            <li>The question is the spec — if it asked for 5 bullets, count them.</li>
            <li>Correct and plain beats wrong and polished. Don&apos;t reward length.</li>
            <li>Pick a side when you honestly can; use Tie only when you truly can&apos;t.</li>
          </ul>
          <div className="mr-startrow">
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && begin()}
            />
            <button className="mr-primary" onClick={begin} disabled={!name.trim() || !items.length}>
              Start reviewing
            </button>
          </div>
          {err && <p className="mr-err">{err}</p>}
        </main>
      )}

      {started && finished && (
        <main className="mr-intro">
          <h1>That&apos;s all of them — thank you.</h1>
          <p>
            You graded {nDone} pairs. Every judgment feeds an independent audit of
            automatic AI model selection, reviewed by multiple people so no single
            opinion decides anything.
          </p>
          <p className="mr-mutedline">
            Curious what this is? realloop runs human evaluation pipelines for AI
            products — this panel is a live slice of one.
          </p>
        </main>
      )}

      {started && !finished && it && (
        <main>
          <section className="mr-prompt">
            <span className="mr-cat">{it.category}</span>
            <div className="mr-prompttext">{it.prompt}</div>
          </section>

          <section className="mr-pair">
            {(["A", "B"] as const).map((side) => (
              <article key={side} className="mr-resp">
                <h3>Response {side}</h3>
                <div className="mr-resptext">{it[side]}</div>
              </article>
            ))}
          </section>

          <section className="mr-qs">
            <div className="mr-q">
              <label>Which response better serves the person who asked?</label>
              <div className="mr-opts">
                {PREFS.map((p) => (
                  <button
                    key={p}
                    className={j.preference === p ? "mr-on" : ""}
                    onClick={() => setJ({ ...j, preference: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mr-q">
              <label>How confident are you?</label>
              <div className="mr-opts">
                {CONF.map((c) => (
                  <button
                    key={c}
                    className={j.confidence === c ? "mr-on" : ""}
                    onClick={() => setJ({ ...j, confidence: c })}
                  >
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
                    <button
                      key={t}
                      className={j[side].includes(t) ? "mr-on-warn" : ""}
                      onClick={() => toggleTag(side, t)}
                    >
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
                {saving ? "Saving…" : "Save & next"}
              </button>
              <span className="mr-mutedline">Blind review — don&apos;t try to guess which system is which.</span>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

const css = `
.mr-wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px 60px; }
.mr-head { display:flex; justify-content:space-between; align-items:baseline; padding:18px 0; border-bottom:1px solid var(--line); margin-bottom:22px; }
.mr-brand { font-family: var(--font-display); font-weight:700; font-size:18px; }
.mr-sub { color: var(--muted); margin-left:6px; }
.mr-progress { font-family: var(--font-mono); font-size:13px; color: var(--muted); }
.mr-intro { max-width:640px; margin:40px auto; }
.mr-intro h1 { font-family: var(--font-display); font-size:28px; margin:0 0 14px; }
.mr-intro p, .mr-intro li { color:#2c3944; line-height:1.6; }
.mr-startrow { display:flex; gap:10px; margin-top:22px; }
.mr-startrow input { flex:1; border:1px solid var(--line); border-radius:6px; padding:10px 12px; background:var(--panel); }
.mr-primary { background: var(--accent); border-color: var(--accent); color:#fff; font-weight:600; }
.mr-primary:hover { background: var(--accent-strong); }
.mr-prompt { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; box-shadow: var(--shadow); margin-bottom:14px; }
.mr-cat { font-family: var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:1px; color: var(--accent-strong); }
.mr-prompttext { white-space:pre-wrap; margin-top:6px; max-height:200px; overflow-y:auto; }
.mr-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width: 860px) { .mr-pair { grid-template-columns:1fr; } }
.mr-resp { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; box-shadow: var(--shadow); }
.mr-resp h3 { margin:0 0 8px; font-family: var(--font-mono); font-size:12px; letter-spacing:1px; text-transform:uppercase; color: var(--muted); }
.mr-resptext { white-space:pre-wrap; max-height:46vh; overflow-y:auto; line-height:1.55; font-size:14.5px; }
.mr-qs { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; margin-top:14px; box-shadow: var(--shadow); }
.mr-q { margin-bottom:16px; }
.mr-q label { display:block; font-weight:600; margin-bottom:8px; font-size:14.5px; }
.mr-opts { display:flex; flex-wrap:wrap; gap:8px; }
.mr-opts button { border-radius:20px; padding:6px 14px; font-size:13.5px; }
.mr-opts.mr-tags button { border-radius:6px; font-family: var(--font-mono); font-size:12.5px; }
.mr-on { background: var(--accent) !important; border-color: var(--accent) !important; color:#fff !important; }
.mr-on-warn { background: var(--warn) !important; border-color: var(--warn) !important; color:#fff !important; }
.mr-q textarea { width:100%; min-height:48px; border:1px solid var(--line); border-radius:6px; padding:9px 11px; background:var(--panel); }
.mr-navrow { display:flex; align-items:center; gap:14px; }
.mr-mutedline { color: var(--muted); font-size:13px; }
.mr-err { color:#b03030; font-size:13.5px; }
`;
