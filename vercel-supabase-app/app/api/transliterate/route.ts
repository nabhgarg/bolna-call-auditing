import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Roman-Hinglish -> golden-script converter.
// Reviewers type everything in Roman for speed; this decides per word whether
// it is English (stays Roman) or Hindi (converted to Devanagari via Google
// Input Tools transliteration). Word classification uses Claude Haiku when
// ANTHROPIC_API_KEY is set (context-aware, far better than a wordlist), and
// falls back to the compact dictionary below when it isn't / on timeout.
// The client renders converted tokens highlighted so the reviewer can toggle
// or correct any wrong decision.

// Fallback list: words that stay Roman even though they'd transliterate fine.
const ENGLISH = new Set(`
a i am is are was were be been the this that these those it its of in on at to for from with without and or but if then than so not no yes you your yours he she they them his her we us our me my mine
do does did done doing have has had having will would can could should shall may might must
what which who whom when where why how there here now today tomorrow yesterday please thanks thank welcome sorry excuse
okay ok fine good great nice best better bad new old right wrong correct sir madam mam hello hi bye call phone number mobile
one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand lakh crore point zero
litre liter litres liters can cans case cases bottle bottles pack packs piece pieces kg gram ml
company offer referral refer register registration app application online payment paytm google pay phonepe upi bank account
order booking delivery address pincode location city state name email time date month year minute second hour
job work working salary income money rupees interested interest busy free available confirm confirmed cancel cancelled
problem issue help support team customer service agent details detail information info share send receive
`.trim().split(/\s+/));

const DEVANAGARI = /[ऀ-ॿ]/;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

// Context-aware classifier: for each candidate word, is it Hindi (convert to
// Devanagari) or English/brand/code-switch (keep Roman)? Sees the whole
// sentence so "car" in "car lena hai" stays Roman while "kar" converts.
async function classifyWithHaiku(sentence: string, candidates: Array<{ index: number; word: string }>): Promise<Map<number, boolean> | null> {
  if (!ANTHROPIC_KEY || !candidates.length) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system:
          "You classify words in Roman-typed Hinglish call transcripts. " +
          "For each listed word, answer whether it is a HINDI word typed in Roman (transliterate to Devanagari) or anything else that must STAY IN ROMAN: English words, English borrowed into Hindi speech (app, company, offer, salary, madam, ok, payment, pending), brand/company/product names (Paytm, Pronto, WhatsApp, Amazon), and foreign proper nouns. When unsure, keep Roman. " +
          "Hindi words convert even if they look like English words (kar, to, hai — judge from sentence context). " +
          "Reply with ONLY a JSON array of 0/1, one per listed word in the same order: 1 = Hindi (convert), 0 = keep Roman. No other text.",
        messages: [{
          role: "user",
          content: `Sentence: ${sentence}\nWords: ${JSON.stringify(candidates.map((c) => c.word))}`
        }]
      }),
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = String(data?.content?.[0]?.text || "");
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    if (!Array.isArray(arr) || arr.length !== candidates.length) return null;
    const map = new Map<number, boolean>();
    candidates.forEach((c, k) => map.set(c.index, Boolean(Number(arr[k]))));
    return map;
  } catch {
    return null; // fall back to dictionary
  }
}

async function transliterateRun(words: string[]): Promise<string[]> {
  const phrase = words.join(" ");
  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(phrase)}&itc=hi-t-i0-und&num=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data?.[0] === "SUCCESS") {
      const out = String(data[1]?.[0]?.[1]?.[0] || "").trim().split(/\s+/);
      if (out.length === words.length) return out;
      // word-count drift — fall back to per-word calls
      return Promise.all(words.map(async (w) => {
        try {
          const r = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(w)}&itc=hi-t-i0-und&num=1`, { signal: AbortSignal.timeout(3000) });
          const j = await r.json();
          return String(j?.[1]?.[0]?.[1]?.[0] || w);
        } catch { return w; }
      }));
    }
  } catch { /* network fail -> leave roman */ }
  return words;
}

// Top-3 Devanagari forms for one word — the click-a-word chooser (kam can be
// काम or कम; 3 options covers it without the choice overload of 6).
async function devanagariOptions(word: string): Promise<string[]> {
  try {
    const r = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=hi-t-i0-und&num=4`, { signal: AbortSignal.timeout(3500) });
    const j = await r.json();
    const alts = (j?.[1]?.[0]?.[1] || []).map((x: unknown) => String(x)).filter(Boolean);
    return ([...new Set(alts)] as string[]).slice(0, 3);
  } catch { return []; }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // single-word mode: { word } -> { alts: [top 3 Devanagari forms] }
  if (body?.word) {
    const alts = await devanagariOptions(String(body.word));
    return NextResponse.json({ alts, out: alts[0] || String(body.word) }, { headers: { "Cache-Control": "no-store" } });
  }

  const raw = String(body?.text || "");
  if (!raw.trim()) return NextResponse.json({ tokens: [] });

  // split preserving punctuation attached to words
  const parts = raw.trim().split(/\s+/);
  type Tok = { src: string; out: string; converted: boolean };
  const tokens: Tok[] = [];
  const candidates: Array<{ index: number; word: string }> = [];
  parts.forEach((src, index) => {
    const core = src.replace(/^[^\wऀ-ॿ{]+|[^\wऀ-ॿ}]+$/g, "");
    const lower = core.toLowerCase();
    // hard guards that never go to the classifier
    const hardRoman =
      !core ||
      DEVANAGARI.test(core) ||          // already Devanagari
      core === "{noise}" || lower === "noise" ||
      /\d/.test(core) ||                // digits handled by lint, don't convert
      /['-]/.test(core);                // don't / e-mail style words -> English
    tokens.push({ src, out: src, converted: !hardRoman });
    if (!hardRoman) candidates.push({ index, word: core });
  });

  // classify: Haiku (context-aware) with dictionary fallback
  const haiku = await classifyWithHaiku(raw.trim(), candidates);
  for (const c of candidates) {
    const hindi = haiku ? (haiku.get(c.index) ?? !ENGLISH.has(c.word.toLowerCase())) : !ENGLISH.has(c.word.toLowerCase());
    tokens[c.index].converted = hindi;
  }

  // transliterate consecutive Hindi-candidate runs together (context helps)
  let i = 0;
  while (i < tokens.length) {
    if (!tokens[i].converted) { i++; continue; }
    let j = i;
    while (j < tokens.length && tokens[j].converted) j++;
    const run = tokens.slice(i, j);
    const outs = await transliterateRun(run.map((t) => t.src));
    outs.forEach((o, k) => {
      run[k].out = o;
      if (o === run[k].src) run[k].converted = false; // nothing changed
    });
    i = j;
  }

  return NextResponse.json({ tokens, classifier: haiku ? "haiku" : "dictionary" }, { headers: { "Cache-Control": "no-store" } });
}
