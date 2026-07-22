# RealLoop — Design Context + Screen Prompts (YC demo, 2026-07)

Purpose of this file: paste the CONTEXT block plus ONE screen prompt into Claude
(design mode) to generate a wireframe. Every prompt is self-contained enough to
work with just the context block above it.

---

## CONTEXT (paste before every screen prompt)

**Company:** RealLoop (realloop.in) — evals + data-generation services for AI
voice agents, delivered through a managed marketplace of trained quality
reviewers ("human output as a service"). Founders: Nabh + Manavi (both act as
ground-truth experts). First client: Bolna (voice-AI platform, India).

**The gap we open the demo with:** production voice calls fail on latency,
barge-in, ASR/transcription errors, call naturalness ("does it sound human"),
tone, response appropriateness, and pronunciation. These failures need three
different remedies:
- HUMAN EVALS — naturalness, tone, pronunciation, nuanced issue logging
- AI-AS-JUDGE — latency, barge-in (deterministic from telemetry), repetition,
  language errors (LLM can catch)
- DATA GENERATION — golden transcripts for ASR fine-tuning (humans correct
  ASR word-by-word)

**Our process (the play):** rubric + process set up in days, not months →
every call gets an overall "vibe" score (1–5) from a panel of trained
reviewers → calls rated 1–2 get deep human issue logging → an LLM judge runs
over ALL calls → the portal shows exactly where humans were needed and where
the LLM sufficed. Trust comes from measurement: reviewers are calibrated
against founder ground-truth scores, and panel reliability is computed from
common calls everyone rates (Krippendorff's alpha, published openly — most
eval shops don't know theirs).

**Real numbers (safe floors, only grow):** 500+ calls in system, 14 active
reviewers in 3 roles, 1,100+ review slots, 72% panel agreement (±1), alpha
0.21 and rising batch-over-batch, 56 calls flagged 1–2★ by experts, 3–4 min
per call review time, 359 reviews in one day peak.

**Stack:** Next.js + Supabase on Vercel. Reviewer app at
bolna-call-auditing.vercel.app. Single-page app, sidebar + workspace layout.
Audio is stereo (agent channel / user channel) rendered as a dual waveform
(agent up in green #1f7a5c, user down in blue #5b8def). Current palette:
warm off-white background (#f7f5f0-ish), ink #1f2d28, green primary #1f7a5c,
amber highlight #b7791f, red #d64545. Language: reviewers work in
Hindi/Hinglish; UI is English.

**Roles → screens:** reviewer (vibe score + issue logging), issue_logger
(transcription only, auto-routed to /transcribe), expert (everything +
client dashboard access).

**Demo constraints:** 2-minute screen-only video. Wireframes must optimise
for (a) reviewer usability — fast, low-error, mobile-friendly; (b) looking
useful/insightful on camera — a partner should understand each screen in
3 seconds without narration. No decorative fluff; numbers and evidence
everywhere. Sentence case. No stock-photo aesthetics.

---

## SCREENS THAT EXIST TODAY (prompts = redesign/polish passes)

### S1 — Login
Prompt: Wireframe a minimal login card for an internal review tool. Email
field → 6-digit code field (codes are pre-shared, no email delivery). Center
card, product name "Call Audit", one-line helper text. Mobile-first: full
width under 400px. Nothing else on screen.

### S2 — Reviewer: vibe scoring (desktop, exists)
Prompt: Wireframe a call-review workspace. Left sidebar: pending/submitted
tabs, count strip ("50 pending · 30 submitted · 80 assigned"), scrollable
call cards (short id, agent name, duration, language). Main area top: audio
bar with native player + dual-channel waveform strip (agent up / user down)
with a click-to-seek playhead. Below: a Review panel with (a) vibe score as
five large tap targets 1–5, (b) required "why this score" text area,
(c) submit button that advances to the next pending call. Show a state where
score 3 is selected. Optimise for: one call reviewed per 3 minutes, minimal
eye travel, no scrolling to submit on a 13" laptop.

### S3 — Reviewer: issue logging (desktop, exists)
Prompt: Same workspace shell as S2 (sidebar + audio bar). The Review panel
instead captures timestamped issues: an issue-type select (pronunciation /
response appropriateness), a "Capture 01:23" button that freezes the current
audio timestamp, per-type fields (pronunciation: content tag + word heard;
response appropriateness: error type select — repetition / language errors /
user input capture / irrelevant — with sub-type + explanation), an "add
issue" action, and a logged-issues list with per-issue remove. Vibe score
block also present above (these reviewers do both). Show 2 issues already
logged. Optimise for: capture-while-listening without pausing flow.

### S4 — Expert screen (desktop, exists)
Prompt: Same shell as S2/S3 with everything enabled: vibe score, pronunciation
+ response appropriateness issue capture, AND a right-hand transcript panel
listing conversation turns (agent/user) where each user turn can be corrected
inline (edit text, mark wrong-same-language / wrong-different-language /
missing, audio-unclear checkbox, insert a missed turn between two turns).
This is the ground-truth screen founders use. Dense but ordered; wireframe
priority: transcript panel readability at 14px.

### S5 — /transcribe: golden transcript workbench (exists, our best screen)
Prompt: Wireframe an audio-first transcription workbench. Left sidebar: call
list (same as S2). Top bar: player + dual waveform where USER speech spikes
are highlighted boxes (pending red / done green / current amber) — clicking a
spike plays exactly that segment and the player clock follows. Main panel:
one card per spike — "spike 3 of 14, 00:26–00:28", the ASR text if Bolna
heard something ("ASR heard: हां payment pending") or "no official transcript
— listen and write it", verdict buttons (Correct / Edit—ASR wrong / {noise}),
and when editing: a Roman-input textarea ("haan didi main kaam kar rahi
hoon") with live word-by-word conversion preview where Hindi words render in
Devanagari highlighted and English/brand words stay Roman; clicking any word
opens exactly 3 Devanagari alternatives + keep-Roman ("kam" = काम | कम | कॉम |
kam). Right panel: numbered spike list with timestamps (click to jump) +
read-only conversation context below. Footer: "Resolve all spikes to submit
(9/14)". Optimise for: zero-mouse flow (space = replay, arrows = next spike).

### S6 — Client dashboard v1 (exists at /dashboard, expert-gated)
Prompt: Wireframe an analytics page for the client (Bolna): trust strip
(panel agreement 72% ±1, alpha 0.21 with trend arrow, reviewers calibrated
against expert ground truth), calibration curve chart (batch 1 → batch 2 per
reviewer), per-agent error rates table, worst calls list with timestamped
evidence, golden transcript sample viewer, ops strip (reviews/day, time per
call), "Download report (PDF)" button. Wireframe priority: the trust strip
reads in 3 seconds.

---

## SCREENS TO GENERATE (new for the demo)

### N1 — Portal home v2: triage funnel + who-caught-what (THE money shot)
Prompt: Wireframe the enterprise portal home for a voice-AI eval service.
Top: 4 metric cards (calls evaluated 538 · panel agreement ±1 72% · expert
calibration α 0.21↗ · bad calls flagged 56). Middle: a 3-stage horizontal
triage funnel — "All calls (538, LLM judge on 100%)" → "Panel scored (vibe
1–5, n≥3 per call)" → "Rated 1–2★ (56 → human issue logging)". Bottom: a
"who caught what" horizontal stacked-bar block: one row per issue type (ASR/
transcription, response appropriateness, pronunciation, naturalness/tone,
latency/barge-in), each bar split into LLM-caught (purple) vs human-caught
(teal), count at row end, 2-swatch legend, and one caption line: "latency is
machine-detectable; naturalness and pronunciation only surface through
humans." Every row clicks through to a drill-down (N2). Include a "Download
report" affordance. A YC partner must grasp "humans only where needed" in
one glance.

### N2 — Issue drill-down with evidence
Prompt: Wireframe the drill-down for one issue type ("ASR / transcription ·
92 issues"). Top: 3 small stat tiles — LLM caught 35 (purple tint) · human
caught 43 (teal tint) · human-only, LLM missed 14 (amber tint; this is the
moat number). Below: evidence cards, one per issue: call id + timestamp, a
source chip (human / LLM judge), one-line evidence ("ASR heard 'कॉम कर रही
हूं' · golden: 'काम कर रही हूं'"), inline play button for the audio clip.
Filter chips by source. Wireframe priority: every number is backed by a
playable clip — credibility through evidence.

### N3 — Mobile vibe reviewer (one-thumb flow)
Prompt: Wireframe a phone-width (375px) version of the vibe-scoring flow:
sticky mini player + compact waveform at top, five large score buttons in
one row (thumb-reachable), reason text box, full-width "Submit · next call"
button pinned at the bottom, swipe or auto-advance to next call. No sidebar —
calls advance linearly with a "12 left" counter. Optimise for: score a call
in under 60 seconds on a phone during a commute.

### N4 — Gap-map slide (video beat 2, static graphic)
Prompt: Wireframe a single 16:9 slide titled "Where production voice calls
fail — and what each failure needs". Left column: 7 failure chips (latency,
barge-in, ASR/transcription, naturalness, tone, response appropriateness,
pronunciation). Right: three remedy buckets (Human evals · AI as judge ·
Data generation for fine-tuning) with connector lines from each chip to its
bucket (ASR connects to BOTH AI-judge and data-generation). Muted palette,
one accent per bucket, no icons-for-decoration. Must read silently in 5
seconds in a video.

### N5 — realloop.in proof strip (marketing site section)
Prompt: Wireframe a single marketing-site section: headline "The calibrated
ground-truth layer for voice AI", one-line sub ("We publish our own
reliability numbers — most eval shops don't know theirs"), 4 stat blocks
(1,100+ reviews · 140+ calls · 14 trained reviewers · 72% panel agreement),
one product screenshot placeholder (portal home N1), one CTA ("Get a pilot
report"). Trust-forward, zero decoration.

---

## Data dependencies for N1/N2 (build note, not for design)
- LLM-judge verdicts per call must exist in DB (planned run: telemetry rules
  for latency/barge-in + LLM judge for repetition/language/appropriateness;
  Sonnet on the 56 low-rated calls, Haiku on the rest).
- Human issue counts come from reviews.issues_json (already live).
- "Human-only (LLM missed)" = human-logged issues with no matching LLM
  verdict on the same call + type.
