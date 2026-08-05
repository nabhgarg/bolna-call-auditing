# Pairwise Review Rubric — Merlin Router Audit

You will see one prompt and two responses, labeled **A** and **B**. You do NOT know
which AI model produced which response, and the left/right position is random.
Judge only what is on the screen.

## Your task per item (target: 2–3 minutes)

### Q1 — Which response better serves the person who asked? (required)
- **A much better** — A succeeds where B fails, or B has a serious error A doesn't
- **A slightly better** — both acceptable, A is clearly the one you'd want
- **Tie** — a real user would be equally served by either
- **B slightly better**
- **B much better**

Pick a side whenever you honestly can. Use Tie only when you genuinely cannot —
"both are long and decent" is not automatically a tie; reread the prompt's
constraints first.

### Q2 — Confidence (required)
- **Certain** — I could defend this choice to another reviewer
- **Moderate** — I lean this way but a reasonable person could disagree

### Q3 — Failure tags (check all that apply, for EACH response separately)
| Tag | Meaning | Example |
|---|---|---|
| `wrong` | Factually or logically incorrect content | Math answer is 186, response says 210 |
| `incomplete` | Missed part of what was asked | Asked for 62 names, gave 41 |
| `ignored-constraint` | Broke an explicit instruction | "5 bullets, 8 words each" → 7 bullets |
| `truncated` | Response visibly cut off mid-thought | Ends mid-sentence or mid-list |
| `hallucinated` | Invented facts, sources, names, or data | Cites a study that doesn't appear in the source |
| `format` | Right content, wrong requested format | Asked for JSON, got prose with JSON-ish fragments |
| `padding` | Substantial filler that hurts usability | Three paragraphs of preamble before the answer |
| `refused` | Declined or deflected a benign request | "As an AI I cannot..." on a normal task |

### Q4 — One-line reason (required, 5–25 words)
The single decisive difference. "A solved it, B's loop skips the last element."
Not "A is better overall."

## Judging principles

1. **The prompt is the spec.** If it says exactly 3 sentences, count them. If it
   says no intro text, an intro is a violation — even if the content is good.
   For prompts with an objective check noted, correctness dominates style.
2. **Correct and plain beats wrong and polished.** Formatting never outweighs a
   factual error.
3. **Don't reward length.** Longer is only better when the prompt needed the depth.
   Padding is a defect, not a bonus.
4. **Judge the user's outcome, not effort.** A response that "shows work" but lands
   on the wrong answer still loses to a terse right answer.
5. **Search/factual items** (F-series): each item comes with a ground-truth note
   recorded by the operator ON THE DAY the responses were generated — judge
   against that, not against what's true on the day you review (facts move).
   A response that confidently states a stale or invented fact is `wrong` (or
   `hallucinated` if it invents events/releases/sources). A response that gets
   it right AND names its source/date beats one that is merely right. Honest
   uncertainty ("my data may be out of date, check X") beats confident
   wrongness — always.
6. **Summarization items** (S-series): faithfulness first — anything stated that
   is not in the source is `hallucinated` even if plausible; anything important
   missing is `incomplete`. Emphasis distortion (technically-true summary that
   misleads about what mattered) counts against a response in Q1 even without a tag.
7. **If both responses fail badly**, pick the less bad one and tag both. Note
   "both fail" in Q4.

## Integrity rules

- Never try to guess which response is which model, and never let a guess affect
  your judgment.
- Never use an AI tool to make the comparison for you.
- Some items have known correct answers and are used to check reviewer accuracy
  (you won't know which ones).
- If you recognize a prompt from a previous item, judge it fresh — duplicates with
  paraphrased wording are intentional.

## Session grading (items SS1–SS20 only)

For multi-turn conversation transcripts, additionally answer:
- **Q5 — Consistency**: did the assistant contradict itself between turns, change
  tone/persona abruptly, or forget established context? (yes/no + which turn)
- **Q6 — Would this session frustrate a paying user?** (no / mildly / seriously)
