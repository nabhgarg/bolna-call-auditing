# [REPORT] Merlin Magic Router Audit — Realloop

*An independent human evaluation of Merlin's automatic model selection.*
*[Month 2026] · [N] prompts · [N] blind human judgments · methodology in appendix*

## 1. Summary (half page)

- What we did: ran [60] real-world prompts — deep sets in Merlin's two core
  loops, summarization/document work and live-search/factual questions —
  through Merlin twice — once with
  Merlin Magic choosing the model, once pinned to [premium model] — and had
  trained reviewers blindly judge each pair, two reviewers per item.
- Headline: **Magic matched or beat the premium model on [X]% of tasks while
  spending [N]% fewer credits.**
- But: **losses concentrate — [category] and [category] account for [X]% of all
  quality losses**, and on tasks with objectively checkable answers, routing
  caused [N] outright failures the premium model didn't make.
- [If found] Mid-conversation model switches produced [N] user-visible
  contradictions in [20] test sessions.

## 2. Where routing works (give them the win first)

Per-category results table. Call out the categories where Magic is saving money
invisibly — this is genuinely good engineering and saying so buys credibility.

## 3. Where routing bleeds

- The money table: category × (win/tie/loss, loss-at-certain-confidence).
- The escalation curve: routing vs difficulty.
- 3–4 verbatim exhibits: prompt, Magic's answer (model badge), premium answer,
  reviewer verdict + one-line reason. Lead with an objective one (e.g., the
  62-name extraction).

## 4. Routing behavior reconstructed

Heatmap of model choice by category/difficulty. Search-invocation miss rate.
Any badge-integrity findings ([or: "we found no badge discrepancies" — say it
either way; absence is also information they don't currently have]).

## 5. What we'd fix first

3 recommendations, each mapped to a finding, each a one-line product change:
1. Per-category escalation floors ([category] above [difficulty] → premium tier)
2. [e.g., Search-invocation trigger for time-sensitive queries]
3. [e.g., Pin model within a conversation once code/doc context is established]

## 6. Methodology (why these numbers can be trusted)

Blind, position-randomized pairs; 2 independent reviewers/item; third-review
adjudication; [10] seeded golden items — reviewer accuracy [X]/10; Cohen's κ =
[X]; objective checks scored against ground truth separate from reviewer flow.
One page, honest about limits: single premium-model baseline, [dates] snapshot,
consumer-style prompt mix, no access to Merlin's internal telemetry.

## 7. The continuous version

Half page: this audit, monthly, on YOUR real traffic distribution instead of our
synthetic set, with graded preference pairs delivered in router-trainable format.
[Realloop contact]
