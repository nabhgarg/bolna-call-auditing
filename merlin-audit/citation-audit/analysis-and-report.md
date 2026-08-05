# Citation Audit — Analysis & Report Skeleton

## Metrics to compute

1. **Headline reliability rate**: % SUPPORTED of checkable pairs (and the strict
   rate with PARTIAL as failure). The sentence for the outreach teaser:
   **"We checked [N] citations across 20 Merlin Deep Research reports; [X]% did
   not support the claim they were attached to."**
2. **By verdict**: full distribution (n and %) across the 6 verdicts.
3. **By topic class**: numeric / fast-moving / contested / niche / India / control.
   Expected gradient: controls best, niche + numeric worst. If controls score
   badly too, the finding is bigger than expected — report it straight.
4. **By source type**: reliability when citing papers vs news vs vendor blogs vs
   SEO farms + the source-quality mix itself (% low-grade sources = its own finding).
5. **Uncited-claim burden**: avg specific-but-uncited factual claims per report.
6. **Per-report range**: best and worst report (worst = likely exhibit).
7. **Grader agreement** on the 10% double-graded sample.

## Report section skeleton (merges into the combined audit as Section [X])

### Deep Research: do the citations hold?
- Method, 3 lines: 20 briefs, every claim–citation pair opened and graded by a
  human against a written rubric, 10% double-graded ([X]% agreement).
- The number: [X]% of [N] citations fully supported their claim; [Y]% partially;
  **[Z]% did not** ([n] unsupported, [n] contradicted, [n] fabricated/dead).
- The gradient table by topic class — makes the finding look fair (controls
  scored [high]) and diagnostic (failures cluster in [niche/numeric]).
- **Three exhibits** (screenshot triplets: claim → source → highlight):
  1. A CONTRADICTED figure (a number the source actually states differently)
  2. An UNSUPPORTED authoritative-sounding claim
  3. The funniest/starkest FABRICATED-OR-DEAD, if one exists
- Why it matters, 2 lines: users forward Deep Research reports; every unsupported
  citation forwarded under a customer's name is a trust incident waiting to
  publish itself. [Perplexity precedent, one sentence.]
- The fix we'd run: per-release citation spot-audit ([n] pairs sampled per week,
  same rubric, trend line) — slots into the same continuous service as the
  router scorecard.

## Honest-limits paragraph (include verbatim-ish)

Single snapshot ([dates]); 20 topics we chose (skewed toward hard cases by
design, with controls to calibrate); one primary grader with [X]% checked
agreement; paywalled sources excluded ([n] pairs). None of these change the
direction of the finding at the observed effect size.
