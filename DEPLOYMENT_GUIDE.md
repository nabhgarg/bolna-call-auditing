# Deployment Guide for Agents

This repo has a Next.js app in `vercel-supabase-app/`. Use this guide when committing changes, pushing to GitHub, and deploying the Bolna call auditing portal to Vercel.

## Project Details

- Repo path: `/Users/nabhgarg/Desktop/Bolna - Call Auditing`
- App path: `/Users/nabhgarg/Desktop/Bolna - Call Auditing/vercel-supabase-app`
- GitHub repo: `https://github.com/nabhgarg/bolna-call-auditing.git`
- Main branch: `main`
- Vercel project to deploy: `bolna-call-auditing-q87f`
- Production URL: `https://bolna-call-auditing-q87f.vercel.app/`

Important: there may also be a Vercel project named `bolna-call-auditing`. Do not deploy there unless the user explicitly asks. The live user-facing project is `bolna-call-auditing-q87f`.

## Before Committing

Check the current branch and working tree:

```bash
git branch --show-current
git status --short
```

Review changes before staging:

```bash
git diff --stat
git diff
```

Run the app checks from the app directory:

```bash
cd "/Users/nabhgarg/Desktop/Bolna - Call Auditing/vercel-supabase-app"
npm run typecheck
```

From the repo root, check for whitespace errors:

```bash
cd "/Users/nabhgarg/Desktop/Bolna - Call Auditing"
git diff --check
```

Do not stage unrelated local files unless the user asks. Existing untracked files may be user-owned.

## Commit to Git

Stage only the files that belong to the change:

```bash
git add vercel-supabase-app/app/page.tsx vercel-supabase-app/app/styles.css
```

Use a clear commit message:

```bash
git commit -m "Describe the change"
```

Confirm the commit:

```bash
git log -1 --oneline
git status --short
```

## Push to GitHub

Confirm the remote:

```bash
git remote -v
git ls-remote origin refs/heads/main
```

Push:

```bash
git push origin main
```

Verify that remote `main` moved to the local commit:

```bash
git ls-remote origin refs/heads/main
git log -1 --oneline
```

## If GitHub Push Fails

If you see `Repository not found`, check whether the remote URL is correct and whether GitHub auth is valid.

If you see `Permission denied to smritichh` or another wrong account, fix GitHub CLI auth:

```bash
gh auth status
gh auth logout -h github.com -u smritichh
gh auth login -h github.com --web --git-protocol https
```

During web login, authenticate as the `nabhgarg` GitHub account. After login:

```bash
gh auth status
git push origin main
```

## Deploy to Vercel

Deploy from the repo root, not from `vercel-supabase-app/`. The Vercel project root already points at the app folder.

First confirm the linked project:

```bash
cat .vercel/project.json
```

It should show:

```json
{
  "projectName": "bolna-call-auditing-q87f"
}
```

If it is linked to the wrong Vercel project, relink it:

```bash
npx vercel link --project bolna-call-auditing-q87f --yes
```

Deploy production:

```bash
npx vercel --prod --yes
```

Wait until Vercel reports:

```text
"readyState": "READY"
Aliased https://bolna-call-auditing-q87f.vercel.app
```

Verify the live alias:

```bash
npx vercel inspect https://bolna-call-auditing-q87f.vercel.app
```

The output should show:

```text
name    bolna-call-auditing-q87f
target  production
status  Ready
Aliases https://bolna-call-auditing-q87f.vercel.app
```

## Common Vercel Mistake

If you run deploy inside `vercel-supabase-app/`, Vercel may look for:

```text
vercel-supabase-app/vercel-supabase-app
```

and fail because the project root is applied twice. Run deployment commands from:

```bash
/Users/nabhgarg/Desktop/Bolna - Call Auditing
```

## Final Report Format

When done, report:

- commit hash and message
- whether GitHub push succeeded
- Vercel deployment status
- production URL
- tests/checks run
- any untracked files intentionally left alone

Example:

```text
Committed and pushed main at af38370 Restore combined audit tab.
Vercel production is READY and aliased to https://bolna-call-auditing-q87f.vercel.app/.
Checks run: npm run typecheck, git diff --check.
Left untracked user files untouched.
```
