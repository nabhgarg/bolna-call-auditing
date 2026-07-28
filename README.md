# RealLoop

A marketplace for credible human judgment on AI phone calls. AI companies describe what their agent must get right; RealLoop puts a screened, trained panel of reviewers on it, and publishes how far that panel can be trusted.

One Next.js app serves the whole product across five subdomains. Push to `main`, Vercel builds and deploys.

> **⚠️ This repository is public.** Do not commit customer PII (phone numbers, transcripts, recordings), reviewer rosters, or secrets. Several such files exist in history from before the repo was opened — see [Data & secrets](#data--secrets). Real secrets belong in environment variables, never in the source.

---

## The two sides

RealLoop is a two-sided product, and the code reflects it:

- **Reviewer side** — where the work happens. Reviewers apply, get screened on a live assignment, then grade production calls: rating response quality (the *vibe* tool) or producing golden transcripts spike-by-spike (the *transcription* tool).
- **Client side** — where the answers come back. A portal showing which agent is failing, what to fix first, and how reliable the panel's numbers are, plus a plain-language intake that reads a described problem back as checks and a price.

## Hosts

All five are the **same deployment**. [`vercel-supabase-app/middleware.ts`](vercel-supabase-app/middleware.ts) reads the `Host` header and rewrites the root path per subdomain; every deeper path passes through untouched, so absolute links keep working.

| Host | Serves | Route |
|---|---|---|
| `realloop.in` → `www` | marketing landing | `public/apex.html` |
| `www.realloop.in/ycpartners` | YC partner demo shell | `public/ycpartners.html` |
| `portal.realloop.in` | client portal | `/portal/*` |
| `review.realloop.in` | reviewer apps | `/` (vibe) and `/transcribe` |
| `marketplace.realloop.in` | reviewer application | `/marketplace/join` |

The apex → `www` redirect is a **Vercel domain setting**, not code.

## Stack

- **Next.js 16** (App Router) on **Vercel** — pages, API routes, and host routing all in one project. Fluid Compute, Node runtime.
- **Supabase Postgres** via the REST API. The browser uses the **publishable (anon) key**; server jobs that need to bypass RLS use the service-role key.
- **Google Apps Script** webhook mirrors submitted reviews into a Sheet, and sends OTP emails. Its source is [`google_apps_script.gs`](google_apps_script.gs); the deployed copy lives in Google, not here.
- Inline styles + design tokens in `vercel-supabase-app/lib/ui.tsx`. Fonts: Space Grotesk / Instrument Sans / IBM Plex Mono.

## Layout

```
vercel-supabase-app/          the deployed Next.js app  (Vercel builds this)
  app/
    page.tsx                  reviewer · response-vibe tool          (review.realloop.in/)
    transcribe/               reviewer · golden-transcription tool   (review.realloop.in/transcribe)
    portal/                   client dashboard, intake, login        (portal.realloop.in/portal/*)
    marketplace/join/         reviewer application + screening       (marketplace.realloop.in)
    api/                      calls, reviews, login/verify, portal data, audio proxy, MCP
  lib/                        role/session, OTP, demo mode, Supabase admin, UI tokens
  public/
    apex.html                 marketing landing
    ycpartners.html           YC partner demo shell (frames the 4 live screens)
  middleware.ts               host-based routing
  supabase/                   schema.sql and table policies

static/, audit_tool.py        the original standalone tool this replaced (not deployed)
docs/, *.md                   product brief, deployment guide, design references
```

## How the pieces fit

- **Routing table.** `call_audit_queue` (`call_id`, `audit_mode`, `assigned_reviewer`, `source_sheet`) decides who sees which call. `audit_mode` is `<base_mode>::<queue_id>` — e.g. `timing_transcription::b7t_jui`. A reviewer's queue is every row matching `audit_mode = <mode>` or `LIKE <mode>::%`.
  - **Parking / removing** work moves a suffix onto the **base mode** (`timing_transcription__parked::b7t_roshan`), *not* the queue id, so the `LIKE` above stops matching it. This convention is load-bearing.
- **Auth.** Stateless HMAC OTP ([`lib/otp.ts`](vercel-supabase-app/lib/otp.ts)): the 6-digit code is an HMAC of `(email, time-window)`, verified against the current and previous window. No codes are stored. Roles (`reviewer`, `issue_logger`, `expert`, `client`) come from the `reviewers` table and are mirrored into a `.realloop.in` cookie so one login covers every subdomain.
- **RLS with the anon key.** INSERT and UPDATE work; **DELETE silently returns `200` with `[]` but deletes nothing**. Undo is done by renaming a row's `audit_mode`, never by deleting. Some tables (`applicants`, `use_cases`) have **no anon SELECT** on purpose — they hold phone numbers and private client descriptions.
- **Demo mode** ([`lib/demo.ts`](vercel-supabase-app/lib/demo.ts)). `?demo=<token>` on the four framed routes gives a read-only, no-login session over anonymised data. Writes dead-end (`/api/use-cases`, `/api/reviews`, `/api/apply` drop the row), client names are blanked, and a real signed-in account always wins over a stale demo flag.

## Running locally

```bash
cd vercel-supabase-app
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

Localhost and `*.vercel.app` fall through middleware to the **reviewer app** (`/`); the portal and marketplace are reachable at their real paths (`/portal/...`, `/marketplace/join`). Host-based rewrites only apply to the `realloop.in` domains.

### Environment

Set these in `.env.local` and in the Vercel project. See [`vercel-supabase-app/README.md`](vercel-supabase-app/README.md) for the full description.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key, used in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only key for imports/sync (bypasses RLS) |
| `OTP_SECRET` | **must be set in prod** — HMAC secret for login codes |
| `GOOGLE_SHEETS_WEBHOOK_URL` / `_SECRET` | Apps Script mirror + OTP email; optional |

## Deploying

Push to `main`. Vercel builds `vercel-supabase-app/` (`npm run build`) and deploys all five hosts at once. Confirm a green build with `npm run build` locally first. Deploys are atomic, so a single push updates every subdomain together.

## Data & secrets

- **Never commit** customer data (phone numbers, transcripts, recordings), reviewer rosters, `.docx`/`.csv` exports, or real keys.
- `OTP_SECRET` ships with a hardcoded fallback for local dev only. **In production it must be set as an env var** — otherwise anyone reading this public source can mint valid login codes.
- Files known to be in history from before the repo went public — `calls_for_google_sheet.csv`, `reviewers_sheet.csv`, `Bolna-Review-Brief.docx` — should be purged with `git filter-repo` and any exposed credentials rotated.
