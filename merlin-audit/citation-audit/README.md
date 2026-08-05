# Citation Audit — Merlin Deep Research

## Why this one (as the second pre-hand artifact)

- **Fully self-serve**: needs only a Merlin account and 20 Deep Research runs.
- **Objective**: a citation either supports the claim it's attached to or it
  doesn't. No preference judgments, no κ debates — one grader + spot-check.
- **Complements the router audit**: preference-based findings (router) + hard
  factual findings (citations) = a report that hits both "quality is subjective"
  and "quality is checkable" registers.
- **Scandal-adjacent**: fabricated/unsupportive citations are the failure class
  that has repeatedly burned Perplexity and AI-search products publicly. A founder
  feels this risk instantly.
- **Cheap**: ~1 day of runs + ~8–10 hours of grading.

## Design in one paragraph

Run 20 research briefs (topics.md) through Merlin Deep Research. For each report,
enumerate every claim–citation pair: a factual claim in the text and the source
cited for it. A grader opens each source and assigns one verdict per pair
(grading-rubric.md): SUPPORTED / PARTIAL / UNSUPPORTED / CONTRADICTED /
FABRICATED-OR-DEAD / UNCHECKABLE. Output: overall citation reliability rate,
breakdown by topic domain and source type, and verbatim exhibits of the worst
failures. A 10% double-grade sample checks grader consistency.

## Run protocol

- Merlin Pro account, Deep Research (in Labs at getmerlin.in/chat).
- One brief per run, verbatim from topics.md. Fresh chat each time.
- Max 6–8 runs/day (each is heavy; spread over 3 days; log timestamps).
- Save each report as PDF/markdown WITH its citation links immediately —
  link rot between run and grading invalidates FABRICATED-OR-DEAD verdicts.
- Log per run: topic_id, run_ts, duration, n_sources_claimed, export file.
- If a run errors or produces a degenerate report (<300 words), log and retry
  once next day; keep both.

## Expected volume

20 reports × (typically 8–20 citations) ≈ **200–350 claim–citation pairs**.
At ~2 min/pair grading ≈ 8–10 hours. Double-grade 10% (~30 pairs).

## Deliverable

One section in the combined audit (analysis-and-report.md): the reliability rate,
the domain breakdown, and 3 exhibits — each exhibit is a screenshot triplet:
the claim in Merlin's report, the cited source, the mismatch highlighted.
