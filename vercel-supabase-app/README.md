# Bolna Call Audit - Vercel + Supabase

Hosted version of the internal call auditing tool.

## Architecture

- Vercel hosts the Next.js app and API routes.
- Supabase Postgres stores calls and reviews.
- Google Apps Script webhook can append submitted review rows into Google Sheets in near real time.

## 1. Create Supabase Project

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy:
   - Project URL
   - Publishable key
   - Service role key, recommended for server-side import/sync jobs

## 2. Configure Environment

Create `.env.local` for local dev and add these same variables in Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_optional_but_recommended
GOOGLE_SHEETS_WEBHOOK_URL=
```

`GOOGLE_SHEETS_WEBHOOK_URL` can stay blank until the Apps Script is deployed. Reviews still save in Supabase.

If you only use the publishable key, make sure the Supabase tables and RLS policies allow the app to read/write the required rows. For the quickest private MVP, use the service role key in Vercel server environment variables and do not expose it in client code.

## 3. Seed Calls

For now, seed calls by posting JSON to `/api/import` or with the JSON seed script.

Create a `calls.json` file with an array of call rows matching the `calls` table columns.

From the workspace root, you can convert the current Excel file with:

```bash
python3 export_calls_json.py
```

Then from this folder run:

```bash
npm install
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-from-json.mjs calls.json
```

It supports these optional assignment columns:

```text
assigned_reviewer
assigned_to
reviewer
reviewer_name
assignee
```

If one of these exists, reviewers only see calls assigned to their login name.

## 4. Google Sheets Realtime Output

1. Create/open a Google Sheet.
2. Open `Extensions -> Apps Script`.
3. Paste `../google_apps_script.gs` or the same script from the root workspace.
4. Deploy as Web App.
5. Copy the Web App URL.
6. Set it as `GOOGLE_SHEETS_WEBHOOK_URL` in Vercel.

Every submitted review saves to Supabase first, then attempts to append rows to the `Reviews` tab.

If Sheets sync fails, reviewers do not lose work. Use the `Sync Sheets` button to retry pending rows.

## 5. Deploy To Vercel

1. Push this folder to GitHub, or import it directly if your repo root is this workspace.
2. In Vercel, set the project root to:

```text
vercel-supabase-app
```

3. Add the environment variables from step 2.
4. Deploy.

## Review Modes

- Technical audio audit:
  - Pronunciation
  - Tone
  - Interruption
  - Latency
  - Response appropriateness

- Vibe + transcription:
  - Vibe score, required before submit
  - Transcription
  - Notes
