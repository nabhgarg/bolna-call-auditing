# Citation Grading Rubric — Deep Research Audit

## Unit of grading: the claim–citation pair

Work through each report paragraph by paragraph. A **pair** = one factual claim +
the source cited for it (a claim citing 3 sources = 3 pairs; a citation covering
2 distinct claims = 2 pairs). Skip pure opinion/framing sentences with no factual
content. Number pairs sequentially per report (R03-P14 = report 3, pair 14).

Uncited factual claims are counted separately: tally every **specific** factual
assertion (a number, date, name, study result) that carries no citation at all —
the `uncited_claim` count per report. Don't tally common-knowledge background.

## Verdicts (one per pair)

| Verdict | Definition | Test |
|---|---|---|
| **SUPPORTED** | The source states the claim, or it follows directly | A careful reader of the source would accept the claim as stated |
| **PARTIAL** | Source supports the gist but the report over-states, drops a qualifier, misstates a figure by a small margin, or generalizes a narrower finding | "Study of 58 students" → "research shows people..." |
| **UNSUPPORTED** | Source is real and on-topic but does NOT contain the claim | The number/statement simply isn't in the source |
| **CONTRADICTED** | Source says the opposite or a materially different figure | Report: "$4.2B by 2028"; source: "$1.1B by 2028" |
| **FABRICATED-OR-DEAD** | Link 404s / doesn't exist / resolves somewhere unrelated (verdict assigned at grading time — this is why reports are archived immediately at run time) | Check archive.org before assigning; note if it ever existed |
| **UNCHECKABLE** | Paywalled or inaccessible source | Try archive.org + Google cache first; use sparingly |

Reliability rate = SUPPORTED / (all pairs − UNCHECKABLE).
Strict rate = SUPPORTED / (all pairs − UNCHECKABLE) counting PARTIAL as failure — report both.

## Grading procedure per pair (~2 min)

1. Read the claim in context; write it down in ≤15 words.
2. Open the source. Search it (Ctrl+F key terms, incl. any figure) for the claim.
3. Read enough surrounding text to catch qualifiers the report may have dropped.
4. Assign ONE verdict. When torn between SUPPORTED and PARTIAL, ask: "would the
   source's author object to how they were cited?" Object → PARTIAL.
5. Log: report_id, pair_id, claim (≤15 words), source URL, source type
   (news / paper / blog / vendor / wiki / social), verdict, note (required for
   every non-SUPPORTED verdict: what the source actually says).

## Consistency controls

- One primary grader for all 20 reports (consistency beats parallelism at this scale).
- 10% random sample (~30 pairs) independently re-graded by a second person;
  report simple agreement. Disagreements discussed and reconciled; if agreement
  <85%, tighten definitions and re-grade affected verdict classes.
- The grader must not know which findings would make the report "better" — grade
  controls (topics 19–20) with identical severity. If the controls score high,
  that VALIDATES the method; a uniformly terrible score across all topics would
  suggest our definitions are too harsh.

## Additional per-report observations (log once per report)

- Did the report hedge appropriately where sources conflict, or present one side?
- Source-quality mix: % of citations that are vendor marketing / SEO content
  farms vs primary sources (papers, filings, official docs).
- Any internal contradiction within the report itself (two sections, different figures).
- Recency: oldest and newest source dates vs the topic's speed (topics 6–8).
