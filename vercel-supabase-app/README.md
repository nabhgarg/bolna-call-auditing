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
GOOGLE_SHEETS_WEBHOOK_SECRET=
```

`GOOGLE_SHEETS_WEBHOOK_URL` can stay blank until the Apps Script is deployed. Reviews still save in Supabase.
`GOOGLE_SHEETS_WEBHOOK_SECRET` is optional, but recommended. If you set it in Vercel, set the same value in `google_apps_script.gs` as `SHARED_SECRET`.

If you only use the publishable key, make sure the Supabase tables and RLS policies allow the app to read/write the required rows. For the quickest private MVP, use the service role key in Vercel server environment variables and do not expose it in client code.

## 3. Google Sheets Import And Export

The current app uses the technical audio audit flow only. Create a Google Sheet with these tabs:

```text
Calls_Technical_Audio
Reviews_Technical_Audio
```

The `Calls_Technical_Audio` tab should have one header row. Supported headers include:

```text
execution_id
assigned_reviewer
audit_mode
org_name
agent_id
agent_name
duration_sec
created_at_ist
to_number
status
transcriber_language
transcript
recording_url
agent_interrupted_user_count
source_sheet
```

Common aliases also work, such as `call_id`, `client`, `agent`, `duration`, `language`, `audio_url`, `assigned_to`, and `reviewer`.

Setup:

1. Open the Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Paste `../google_apps_script.gs`.
4. Optional: set `SHARED_SECRET` in the script.
5. Deploy as a Web App.
6. Copy the Web App URL.
7. Set the Web App URL as `GOOGLE_SHEETS_WEBHOOK_URL` in Vercel.
8. If using a secret, set the same value as `GOOGLE_SHEETS_WEBHOOK_SECRET` in Vercel.

Import flow:

- Click `Import calls` to read `Calls_Technical_Audio`.
- Base call data is upserted into `calls` by `execution_id`.
- All reviewers see the same technical audio call pool. Review completion is tracked per reviewer login name.

Export flow:

- Every submitted review saves to Supabase first.
- Technical audio reviews append to `Reviews_Technical_Audio`.
- Manual CSV export downloads the technical audio review schema.
- If Sheets export fails, the review stays saved in Supabase. Use `Sync Sheets` to retry pending rows.

Technical audio review export columns:

```text
review_id
call_id
org_name
agent_name
call_duration_sec
call_created_at_ist
reviewer_name
review_mode
issue_type
issue_timestamp
issue_recording_link
pronunciation_correct_form
pronunciation_word_heard
content_tag
tone_tag
barge_in_consequence
latency_reaction
response_error_type
response_error_explanation
metric_rating_name
metric_rating_value
metric_rating_reason
issue_notes
review_notes
issue_payload_json
started_at
submitted_at
duration_taken_sec
```

## 4. Seed Calls

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

Assignment columns are preserved for future use, but the current alignment flow shows the same call pool to every reviewer.

## 5. Deploy To Vercel

1. Push this folder to GitHub, or import it directly if your repo root is this workspace.
2. In Vercel, set the project root to:

```text
vercel-supabase-app
```

3. Add the environment variables from step 2.
4. Deploy.

## Review Mode

- Technical audio audit:
  - Pronunciation
  - Tone
  - Barge-in
  - Latency
  - Response appropriateness
