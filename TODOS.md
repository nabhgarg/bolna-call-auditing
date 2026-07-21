# TODOS

## P1 — Anonymization gate before wider video/dashboard distribution
- **What:** Display-only anonymization toggle (reviewers → R-01…, agents → Agent A…, mask phone numbers in transcripts) on /dashboard + report; re-record demo video if it goes beyond the YC application form.
- **Why:** The YC-submitted video shows reviewer full names and client call content; wider distribution without anonymization harms reviewers and the Bolna relationship.
- **Context:** Deferred by explicit decision on 2026-07-21 (CEO review D4.4/D8.1). Toggle affects display only, no data changes. Dashboard code: `vercel-supabase-app/app/dashboard/page.tsx`, API: `app/api/dashboard/route.ts`.
- **Effort:** S (CC ~30 min). **Blocked by:** nothing. **Blocks:** any public use of the video/URL.

## P2 — Hinglish golden-set benchmark productization
- **What:** Curate expert-corrected golden transcripts into a versioned benchmark set; measure ASR/LLM-judge accuracy against it; publish the number.
- **Why:** The compounding data asset behind the "calibrated ground-truth layer" positioning (E6 claim needs a build plan before YC interviews). Automation-first competitors (Coval/Hamming/Cekura) don't have this.
- **Context:** Corrections already collected with exact timestamps via expert insert flow (commit 3094748). Requires data-rights conversation with Bolna first.
- **Effort:** L (CC ~1-2 days spread over weeks). **Blocked by:** client data agreement.

## P3 — Split the page.tsx monolith
- **What:** Refactor `vercel-supabase-app/app/page.tsx` (~1,400 lines, 32 touches in 14 days) into components/hooks (player, transcript, issue forms, login).
- **Why:** Every feature lands in one file; risk and cost compound per change.
- **Context:** Post-demo cleanup; no behavior change intended. Recent role/screen logic lives around lines 250-262.
- **Effort:** M (CC ~2-3 hrs). **Blocked by:** demo shipped (after 2026-07-25).

## Done / promoted into active scope
- Sheet-import archival guard for batch-2 rows — decided "build now" (2026-07-21, D8.2): import must refuse to archive `b2*` queue rows it doesn't see in the sheet.
