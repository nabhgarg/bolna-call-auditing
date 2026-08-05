# Merlin Audit — Pre-hand Eval Package

Two self-serve evals we run on Merlin (getmerlin.in) with zero cooperation from Foyer,
producing the "Merlin Magic Router Audit" pitch artifact for Pratyush Rai.

## Contents

```
merlin-audit/
├── router-audit/          Use case 1 — blind side-by-side comparison of
│   ├── prompts.csv        Merlin Magic (auto-routing) vs pinned best model
│   ├── assets.md          Source texts / data referenced by prompts
│   ├── rubric.md          Pairwise review rubric for Realloop reviewers
│   ├── run-protocol.md    How to execute the runs (pacing, logging, blinding)
│   ├── analysis-plan.md   Metrics, stats, and QC computations
│   └── report-template.md Skeleton of the final audit document
└── citation-audit/        Use case 2 — Deep Research citation verification
    ├── README.md          Design and rationale
    ├── topics.md          20 research briefs to run through Deep Research
    ├── grading-rubric.md  Citation verdict definitions + grading procedure
    └── analysis-and-report.md  Metrics and report skeleton
```

## The two evals in one line each

1. **Router audit** — 60 prompts, deep in Merlin's two core loops, chosen
   because they fail in DIFFERENT ways: **summarization/document work** (the
   extension's main button; failure = unfaithfulness, needs a human holding
   source and summary side by side) and **search/factual** (Live Search + the
   search-engine sidebar; failure = staleness, hallucinated freshness, and
   tool-routing misses — did the router even invoke search when the question
   demanded it).
   10 easy / 10 medium / 10 hard each, run twice (Magic-auto vs pinned best
   model), blinded pairs graded by 2 reviewers each on the Realloop portal →
   per-category win rates, escalation-vs-difficulty curves,
   cost-saved-vs-quality-lost tradeoff.
2. **Citation audit** — 20 Deep Research reports, every citation opened and graded
   (supported / partial / unsupported / fabricated / dead) → citation reliability
   rate, a concrete "N citations don't support the claim" headline.

## Operating requirements

- 1 × Merlin Pro account (~$19/mo). Optional: ChatGPT Plus + Claude Pro for the
  native-comparison subset (Phase 2 extension, not required for the core audit).
- 1 operator, ~4–6 hrs/day for 4–5 days (router runs) + 1 day (Deep Research runs).
- 2 reviewers from the Realloop roster, ~12–15 reviewer-hours total.
- All runs are manual in the Merlin web app. Do NOT automate against their product.

## Sequence

1. Operator reads `router-audit/run-protocol.md`, sets up the logging sheet.
2. Router runs (days 1–5, paced ≤80 queries/day per account).
3. Deep Research runs (day 5–6, only 20 queries — cheap).
4. Pairs loaded into the review portal; reviewers grade per `rubric.md`.
5. Citation grading (operator or 1 reviewer) per `citation-audit/grading-rubric.md`.
6. Analysis per `analysis-plan.md` → fill `report-template.md`.
