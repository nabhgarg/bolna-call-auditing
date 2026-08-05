# Run Protocol — Merlin Router Audit

## What we're producing — three-arm design (free-tier workaround)

No Merlin Pro. Merlin runs happen on the FREE tier (102 queries/day; Magic's
cheap picks mostly cost 1 query). The premium-comparison arms run via raw APIs.

- **Arm 1 (MAGIC)** — operator, in Merlin: Magic picks the model. Log the badge.
- **Arm 2 (MATCHED)** — API: the SAME model the badge showed, via run_api.py
  with matched_models.csv. Magic vs Matched isolates the WRAPPER effect
  (their harness/truncation vs raw model) — this quantifies the "models get
  dumber on Merlin" complaint.
- **Arm 3 (FRONTIER)** — API: the best available model (Sonnet 4.5 / GPT-5)
  for every prompt. Magic vs Frontier is the EXPERIENCE GAP and is what the
  human pairwise review grades.

Item split (which prompts get which treatment):
- **Pairwise set (~35)**: all self-contained prompts — F01–F20 + the asset-based
  S items (S07–S11, S15, S17, S18, S20–S22, S24, S27–S29). Reviewed blind,
  MAGIC vs FRONTIER. MATCHED is graded on objective checks only (no reviewers).
- **Merlin-solo set (~25)**: URL/YouTube S items + freshness-hard F21–F30 —
  raw APIs can't fetch/search, so no API arm; graded against the operator's
  run-day ground truth (faithfulness + freshness pass/fail).

Attribution logic for the report: if MAGIC ≈ MATCHED on objective checks, losses
to FRONTIER are routing/model-choice; if MAGIC < MATCHED, the wrapper itself
degrades output — either way a finding, and we state which we observed.

Honest-limits note (goes in the report verbatim-ish): API arms use provider
defaults (no system prompt, default temperature, 4k max tokens) — not Merlin's
internal settings; that difference is what Arm 2 measures. Badge-to-API-model
mapping is our best judgment where Merlin's label is ambiguous ("Merlin Pro
model"); ambiguous cases are logged and excluded from wrapper claims.

Plus 20 multi-turn sessions (SS1–SS20) run through Magic only.

## Account & environment

- Merlin FREE account, web app at getmerlin.in/chat (not the extension, except
  S-series URL prompts where the page/YouTube flow is the natural surface — note
  surface used in the log).
- Fresh chat per prompt. Never reuse a conversation across prompts (context bleed).
- Default settings; do not toggle web access or tools on/off manually. On
  S-series rows with URLs/YouTube links, whether the router invokes the page
  fetch / YouTube summarizer on its own IS part of what we're measuring — log it.

## Pacing — protects result validity

- **Max ~50 Merlin queries/day** (free tier is 102/day but heavy-model responses
  cost up to 30 — leave headroom so Magic is never rationed). All 60 MAGIC runs
  fit in 2 relaxed days.
- Run API arms (run_api.py) the SAME day as the corresponding MAGIC block —
  never days apart (model updates between runs would confound). Fill
  matched_models.csv from the badges right after each block.
- Randomize prompt order within a block (pre-shuffled order in the logging sheet).
- If you hit any rate-limit, throttle notice, or visible degradation: STOP, log
  it, resume next day. Mark any responses from that block `suspect`.

## Per-query logging (one row per response)

| Field | Notes |
|---|---|
| prompt_id | from prompts.csv |
| arm | MAGIC / PINNED |
| run_ts | ISO timestamp |
| surface | chat / extension-page / extension-youtube |
| model_badge | Model name Merlin DISPLAYS for the response — screenshot if ambiguous |
| credit_cost | ⚡ shown/charged, if visible |
| search_used | did it visibly invoke Live Search (citations/sources shown)? |
| latency_s | rough seconds to complete |
| response_text | full text, verbatim, pasted |
| anomaly | truncation, error, retry, throttle notice, empty |

**The `model_badge` field on MAGIC rows is the routing decision — the single most
important field in the study.** Never skip it. If the UI hides which model Magic
chose, that fact is itself a finding: log `hidden`.

## F-series ground-truth capture (same day, non-negotiable)

For every F-series prompt marked "verify on run day" (and any other F item where
you're unsure): immediately after running both arms, the operator looks up the
actual answer from an authoritative source and records it in the log's
`ground_truth` + `ground_truth_source` columns WITH the date. Freshness facts
decay — a ground truth captured at review time instead of run time is invalid.

## Handling asset prompts

- Prompts marked `[ASSET:...]` : paste the asset block from assets.md directly into
  the prompt text. Same pasted content in both arms, byte-identical.
- Never paste anything from the "GROUND TRUTH" section.

## Multi-turn sessions (SS1–SS20)

Twenty scripted 4–6 turn conversations through MAGIC only, each designed to span
task types mid-conversation (e.g., turn 1 casual question → turn 3 a hard
document task → turn 5 "now draft the email about it"), because cross-type turns are where
routers switch models mid-thread. Log model_badge PER TURN. Export full transcript.
(Session scripts: reuse 20 prompts from the main set as turn-3 anchors; operator
improvises natural surrounding turns from the template in the logging sheet.)

## Blinding & handoff to review

1. Operator exports pairs: prompt + MAGIC response + PINNED response.
2. A script (not the operator) randomizes A/B position per item and strips all
   metadata (model badges, arm labels, timestamps) before portal upload.
3. The 10 golden items (pre-selected pairs where one response contains a seeded,
   objectively verifiable failure) are mixed in unlabeled.
4. Reviewers never see the logging sheet. The operator never grades.

## Do nots

- Do not automate the Merlin UI (ToS + throttle contamination).
- Do not edit/regenerate any response — first completion is the datum. If Merlin
  errors, log the error, retry once after 10+ minutes, keep both attempts logged.
- Do not run from an IP/network associated with anything traceable to outreach
  plans (use a normal personal-tier setup; we are a regular paying customer).
