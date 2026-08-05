# Haiku 4.5 vs Sonnet 5 — the 30 search prompts, graded against live reality

**What this is.** Merlin Magic routes short factual questions to Claude Haiku 4.5.
We ran all 30 search-category prompts from the audit set through Haiku 4.5
("what Merlin uses") and Claude Sonnet 5 ("the current generation"), both via
raw API on 5 Aug 2026, no web access for either. Three independent graders then
**searched the live web first** to establish what is actually true as of
5 Aug 2026, and only then graded each answer against verified reality.

**Grades**: CORRECT · PARTIAL (right gist, material error) · WRONG · STALE
(was true once, outdated now) · HALLUCINATED · HONEST-DECLINE (refused to guess,
pointed to a verification source — the *useful* failure mode).

## Scorecard

| | Haiku 4.5 (Merlin's pick) | Sonnet 5 |
|---|---|---|
| CORRECT | **15 / 30** | **18 / 30** |
| PARTIAL | 3 | 1 |
| WRONG | 1 | 0 |
| STALE (confidently outdated) | 4 | 3 |
| HONEST-DECLINE | 7 | 8 |
| **Confidently-wrong answers served (WRONG+STALE)** | **5** | **3** |

## The three regimes (the finding that matters)

1. **Stable facts (F01–F10):** Haiku 8/10 correct, Sonnet 9/10. The cheap model
   is genuinely fine here — routing cheap on settled knowledge is defensible
   engineering, and the audit should say so.
2. **Slow-drift facts (F11–F20):** the gap opens. Haiku invented M3 chip specs
   (5nm; it's 3nm), garbled the Napoleon unit conversion the prompt hinged on,
   and — the exhibit — **flatly asserted "Pope Francis is the current Pope" with
   zero hedge**, the identical answer Merlin shipped in production. Sonnet 5 got
   9/10 right-or-honest: it *knew* Francis died in April 2025, said an unnamed
   successor was likely elected, and pointed to current sources.
3. **Pure freshness (F21–F30):** both models declined honestly on markets,
   sports, schedules, and releases (7/10 each — no invented numbers, correct
   verification pointers). But on product-catalog questions both answered
   **confidently from stale memory**: Haiku offered the iPhone 15 and Galaxy S24
   Ultra (two generations behind, plus invented Pixel specs and prices — worst
   answer of the set); Sonnet was one generation behind on the same questions.

## What this means for Merlin

- **A better model shrinks the damage but does not fix it.** Upgrading the cheap
  tier cuts confidently-wrong answers from 5 to 3 and converts flat assertions
  into honest hedges — worth doing. But S26-Ultra-era questions defeated both
  models: **no model choice fixes freshness; only invoking search does.**
- Magic routed the Pope and cricket questions to Haiku **without search** (and
  on cricket, its search retrieved a stale result anyway). The router's real
  defect is tool-invocation policy, not just model choice — which is measurable,
  and fixable, per query category.
- Honest-decline behavior is the cheapest quality win available: same cost,
  same latency, no wrong answer shipped. A router that routes freshness
  questions to a model/prompt that declines-and-verifies beats one that ships
  Pope Francis fifteen months after his death.

## Full per-prompt verdicts (graders' verified truth included)

| id | verified truth (5 Aug 2026) | Haiku 4.5 | Sonnet 5 | decisive note |
|---|---|---|---|---|
| F01 | Canberra; site picked 1908, seat of govt 1927 | PARTIAL | CORRECT | Haiku misdates the compromise; Sonnet adds Melbourne-interim detail |
| F02 | García Márquez, 1967 | CORRECT | CORRECT | Sonnet more complete (Nobel 1982) |
| F03 | virus vs bacterium, 3 differences | CORRECT | CORRECT | near-equivalent |
| F04 | one zone, IST +5:30, 82.5°E | PARTIAL | CORRECT | Haiku's "unique among large nations" is false (China) |
| F05 | 418 I'm-a-teapot, RFC 2324; IANA-reserved per RFC 9110 | CORRECT | PARTIAL | Sonnet wrong on IANA registration |
| F06 | 100°C/212°F; pressure at altitude | CORRECT | CORRECT | equivalent |
| F07 | Van Gogh 1889; MoMA since 1941 | CORRECT | CORRECT | Sonnet more precise |
| F08 | Jupiter, ~1,300 Earths | CORRECT | CORRECT | equivalent |
| F09 | GDP definition + blind spot | CORRECT | CORRECT | equivalent |
| F10 | 15 Aug 1947 + Partition | CORRECT | CORRECT | equivalent |
| F11 | India ~1.46B > China ~1.42B (2025) | CORRECT | CORRECT | equivalent |
| F12 | M3=N3B 3nm 8CPU/10GPU; M4=N3E 10CPU, 38 TOPS | **WRONG** | CORRECT | Haiku: "5nm M3" + invented feature |
| F13 | cavitation; no arthritis link (Unger) | CORRECT | CORRECT | Sonnet adds 2015 MRI study |
| F14 | nominal vs PPP; India ~4th-5th vs 3rd | CORRECT | CORRECT | equivalent, both hedged rank |
| F15 | 5'2" French = ~5'7" English; propaganda | PARTIAL | CORRECT | Haiku garbles the conversion the prompt hinged on |
| F16 | ESB ~20-25 strikes/yr; field concentration | CORRECT | CORRECT | Sonnet better physics |
| F17 | Burj 828 / Merdeka 678.9 / Shanghai 632 | CORRECT | CORRECT | identical |
| F18 | Krasznahorkai, Oct 2025 | STALE | STALE | both said Han Kang 2024 but honored the honesty clause |
| F19 | Great Wall not visible; Ripley's 1932 origin | CORRECT | CORRECT | Haiku misattributes origin detail |
| F20 | **Pope Leo XIV since 8 May 2025** | **STALE** | **HONEST-DECLINE** | Haiku asserts Francis flatly; Sonnet knows Francis died, declines to name successor |
| F21 | iPhone 17, ₹82,900 | STALE | STALE | Haiku 2 generations behind, Sonnet 1 |
| F22 | Sam Altman, no change | CORRECT | CORRECT | only fully-correct freshness answer |
| F23 | NIFTY 24,614.90 (4 Aug close) | HONEST-DECLINE | HONEST-DECLINE | both declined cleanly — right behavior |
| F24 | Kimi K3, GPT-5.6, Grok 4.5 (July 2026) | HONEST-DECLINE | HONEST-DECLINE | neither invented releases |
| F25 | AUS-W bt IND-W, 28 Jun 2026 T20 WC | HONEST-DECLINE | HONEST-DECLINE | both pointed to ESPNcricinfo |
| F26 | Merlin by Foyer; recent: X bot, Bonkers | HONEST-DECLINE | HONEST-DECLINE | Sonnet flirted with wrong Foyer, flagged it |
| F27 | ~₹95.4/USD, down ~5.4% in 6mo | HONEST-DECLINE | HONEST-DECLINE | neither fabricated a rate |
| F28 | PLFS Jun 2026: UR 5.5%, youth 16.2% | HONEST-DECLINE | HONEST-DECLINE | both declined the figure |
| F29 | near-weekly Starlink + NASA/ISRO cadence | HONEST-DECLINE | HONEST-DECLINE | both stated low confidence as asked |
| F30 | S26 Ultra ~₹1.19L vs Pixel 10 Pro ₹1.1L | **STALE** | STALE | Haiku: S24-era + invented specs/prices — worst answer of the set |

*Method: responses generated 5 Aug 2026 via API (claude-haiku-4-5-20251001,
claude-sonnet-5), default settings, no tools. Graders verified truths against
live sources (NSE, nobelprize.org, Skyscraper Center, Apple newsroom, PLFS
bulletins, cricinfo) before grading. Raw responses: tools/haiku_compare.csv.*
