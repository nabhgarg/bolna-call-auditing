import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Roman-Hinglish -> golden-script converter.
// Reviewers type everything in Roman for speed; this decides per word whether
// it is English (stays Roman) or Hindi (converted to Devanagari via Google
// Input Tools transliteration). The client renders converted tokens
// highlighted so the reviewer can toggle any wrong decision. An LLM can later
// replace the word-classifier; the response shape stays the same.

// Words that stay Roman even though they'd transliterate fine. Compact set:
// common English + domain vocabulary seen in these calls.
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

export async function POST(request: Request) {
  const { text } = await request.json().catch(() => ({ text: "" }));
  const raw = String(text || "");
  if (!raw.trim()) return NextResponse.json({ tokens: [] });

  // split preserving punctuation attached to words
  const parts = raw.trim().split(/\s+/);
  type Tok = { src: string; out: string; converted: boolean };
  const tokens: Tok[] = parts.map((src) => {
    const core = src.replace(/^[^\wऀ-ॿ{]+|[^\wऀ-ॿ}]+$/g, "");
    const lower = core.toLowerCase();
    const keepRoman =
      !core ||
      DEVANAGARI.test(core) ||          // already Devanagari
      core === "{noise}" || lower === "noise" ||
      ENGLISH.has(lower) ||
      /\d/.test(core) ||                // digits handled by lint, don't convert
      /['-]/.test(core);                // don't / e-mail style words -> English
    return { src, out: src, converted: !keepRoman };
  });

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

  return NextResponse.json({ tokens }, { headers: { "Cache-Control": "no-store" } });
}
