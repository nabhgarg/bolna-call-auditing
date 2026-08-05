# Analysis Plan — Merlin Router Audit

Inputs: reviewer judgments (2 per item), the run log (routing decisions, credit
costs), and objective checks from prompts.csv.

## 1. Reviewer QC — compute FIRST, gates everything else

- **Golden accuracy**: each reviewer's score on the 10 seeded golden items.
  <8/10 → their judgments are excluded and items re-reviewed.
- **Inter-rater agreement**: Cohen's κ on the collapsed 3-class outcome
  (A better / tie / B better) across all double-reviewed items. Report the number
  whatever it is. κ ≥ 0.6 = strong story; 0.4–0.6 = report with the note that
  ties dominate disagreements (show the disagreement matrix).
- **Disagreement resolution**: items where reviewers pick opposite sides (not
  tie-vs-side) go to a third reviewer; majority stands. Tie-vs-side = final
  verdict "lean" toward the side.

## 2. Core preference results

Per item, MAGIC wins / ties / loses vs PINNED (unblind after review).

- **Headline**: overall MAGIC win+tie rate. The router's promise is "cheaper with
  no quality loss," so **ties count FOR the router** — frame honestly: "Magic
  matched or beat the premium model on X% of tasks."
- **Per-category table** (the money table): for each of the 2 categories
  (search/factual, summarization/document) — n, Magic win %, tie %, loss %, and loss %
  on `certain`-confidence judgments only. With n=30 per category and a 10/10/10
  difficulty ladder, per-difficulty cells have n=10 — report them as directional
  with the caveat, but category-level numbers (n=30, 60 judgments) are solid.
- **Per-difficulty curve**: loss rate at easy/medium/hard within each category.
  Expected shape: losses concentrate at hard difficulty — the
  "difficulty threshold where Magic should have escalated but didn't."
- **Failure-tag profile**: distribution of tags on Magic's losing responses
  (`incomplete`/`wrong` on hard document tasks = under-escalation;
  `hallucinated` on F-series = answering from stale memory instead of searching;
  `padding` clusters = cheap-model verbosity, the "watered down" complaint).

## 3. Routing behavior (from the run log, no reviewers needed)

- **Routing distribution**: which model Magic picked, by category × difficulty.
  Heatmap. This is the first public reconstruction of Merlin Magic's policy.
- **Misroute confusion matrix**: rows = category, columns = model chosen, cell
  shading = loss rate to PINNED. The cells with high volume AND high loss rate
  are the misroutes.
- **Escalation analysis**: P(premium model chosen | difficulty) per category. Flat
  curve = router ignores difficulty (big finding if true).
- **The search 2×2** (the audit's second headline, F-series): cross
  search-NEEDED (per tools/search_needed.csv) with search-INVOKED (from the log).
  Needed-but-not-invoked = stale/hallucinated answers served as fresh (critical
  failures — enumerate each). Not-needed-but-invoked = wasted credits + latency
  on facts the model already knows. Report both rates per arm; this measures
  tool routing, a failure axis model choice can't explain.
- **Tool-invocation check** (S-series URL/YouTube rows): same idea for the page
  fetch / YouTube summarizer — an answer about a page it never fetched is a
  hallucinated summary; enumerate every instance.
- **Badge integrity**: any MAGIC/PINNED response where model_badge was hidden,
  changed mid-response, or inconsistent — enumerate every instance.

## 4. Cost–quality tradeoff

- Using credit costs from the log: total ⚡ spent MAGIC arm vs PINNED arm →
  **"Magic saved N% of credits"**.
- Cross with preference results → the one-sentence finding of the whole audit:
  **"Magic saves N% of model cost at the price of losing to the premium model on
  X% of tasks — and 80% of those losses sit in two categories."**
- Per-category cost-saved vs loss-rate scatter: categories in the
  high-savings/low-loss quadrant are where routing works; high-loss cells are
  where it bleeds. Recommend per-category routing floors (e.g., "never route hard
  coding below tier X") — the actionable deliverable.

## 5. Objective-check scoring (independent of reviewers)

For every prompt with an `objective_check`: pass/fail per arm, scored by the
operator against prompts.csv + assets.md ground truth. S-series: seeded
docs/data = full ground truth. F-series: ground truth is captured BY THE
OPERATOR ON RUN DAY (the answer + source URL logged the same day the response
was generated) — freshness facts decay, so run-day capture is what makes them
gradeable at all.
- MAGIC pass rate vs PINNED pass rate overall and per category.
- Every case of PINNED pass + MAGIC fail = a **documented user-visible failure
  caused by routing** — these become the report's exhibit examples (S17's
  62-name extraction, S27's cross-document date conflict, and any F-series case
  where Magic answered a freshness question from stale memory are the likely stars).
- Agreement between objective outcomes and reviewer preferences = a validity
  check on the human layer (report it — it's a selling point for our QC).

## 6. Session results (SS1–SS20)

- Count of mid-session model switches (badge changes between turns).
- Reviewer-flagged contradictions/tone breaks, cross-referenced against whether a
  model switch happened at that turn. Even 3–4 clean examples = the exhibit.

## Deliverable numbers checklist (must all appear in the report)

n prompts, n judgments, n reviewers, golden accuracy, κ, overall win/tie/loss,
per-category table, credits saved %, objective pass rates per arm, count of
routing-caused objective failures, session switch count.
