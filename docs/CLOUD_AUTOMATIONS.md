# Cloud Automations (CI/CD)

ATLAS OS uses GitHub Actions plus Vercel to automate build, test, deploy, and
health monitoring. This document describes every workflow, what triggers it, and
the exact secrets/variables an owner must configure for the pipeline to work.

Per the repository working agreement, routine work pushes straight to `main`;
CI runs on every push and the deploy only fires once CI is green.

## Pipeline at a glance

```
push / PR ─▶ CI (typecheck, lint, build, Playwright matrix)
                │  (on main, conclusion == success)
                ▼
            Deploy ─▶ Vercel production
                ▲
PR ─────────▶ Lighthouse (perf / a11y budgets, non-blocking)

cron every 6h / manual ─▶ Scheduled Health (probe live /api endpoints)
```

## Workflows

### `.github/workflows/ci.yml` — CI (pre-existing)

- **Triggers:** every `push` and every `pull_request`.
- **Jobs:** `build` (`npm ci` → `typecheck` → `lint` → `build`) and `e2e`
  (Playwright matrix; its `webServer` builds + starts on port 3000) run in
  parallel.
- This is the gate for deploys — Deploy keys off this workflow's success.

### `.github/workflows/deploy.yml` — Deploy

- **Triggers:** `workflow_run` on the **CI** workflow `completed` event.
- **Gate:** runs only when `conclusion == success` **and**
  `head_branch == main`, so a red build is never promoted.
- **Flow:** installs the Vercel CLI, then the prebuilt production flow:
  1. `vercel pull --yes --environment=production --token=$VERCEL_TOKEN`
  2. `vercel build --prod --token=$VERCEL_TOKEN`
  3. `vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN`
- Checks out the exact commit CI validated (`workflow_run.head_sha`).
- **Concurrency:** `deploy-production` with `cancel-in-progress`, so a newer
  commit cancels an in-flight deploy.
- **Required secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Uses a `production` GitHub Environment — attach environment protection
  rules/reviewers there if you want a manual approval before promotion.

### `.github/workflows/lighthouse.yml` — Lighthouse

- **Triggers:** `pull_request`.
- **Flow:** `npm ci` → `npm run build` → `npm run start` (waits for port 3000)
  → `treosh/lighthouse-ci-action` using `lighthouserc.json` against `/`,
  `/landing`, `/simulator`.
- **Non-blocking:** the Lighthouse step is `continue-on-error` so budget misses
  do not fail the PR yet; the report is uploaded as the `lighthouse-report`
  artifact and to temporary public storage.
- **Budgets** (see `lighthouserc.json`): performance ≥ 0.80 (warn),
  accessibility ≥ 0.90 (error), best-practices ≥ 0.85 (warn), FCP ≤ 2500 ms,
  LCP ≤ 4000 ms, TBT ≤ 600 ms, CLS ≤ 0.1. `numberOfRuns: 1`.
- **No secrets required.**

### `.github/workflows/scheduled-health.yml` — Scheduled Health

- **Triggers:** cron `0 */6 * * *` (every 6 hours) and `workflow_dispatch`.
- **Flow:** curls `GET $ATLAS_PROD_URL/api/incidents` and
  `GET $ATLAS_PROD_URL/api/analytics`, asserts HTTP 200, and writes a markdown
  status table to the run summary (`$GITHUB_STEP_SUMMARY`) including the
  open-incident count when the incidents payload parses via `jq`.
- **Fails** the job on any non-200 so it shows up in checks/notifications.
- **Target URL:** `ATLAS_PROD_URL` repo variable or secret; falls back to
  `https://smart-admin.vercel.app`.
- **Note:** `/api/incidents` exists today; `/api/analytics` is probed as part
  of the intended health surface and will 200 once that route ships (until then
  this check flags it, which is the desired early-warning behavior).

## Required GitHub secrets & variables

Add these under **Settings → Secrets and variables → Actions**. Never commit
secret values to the repo.

| Name | Kind | Used by | Required? | How to obtain |
| --- | --- | --- | --- | --- |
| `VERCEL_TOKEN` | Secret | Deploy | Yes | Vercel → Account Settings → Tokens → Create Token (scope it to the team that owns the project). |
| `VERCEL_ORG_ID` | Secret | Deploy | Yes | Run `vercel link` locally and read `.vercel/project.json` (`orgId`), or Vercel → Team Settings → General → Team ID. |
| `VERCEL_PROJECT_ID` | Secret | Deploy | Yes | From the same `.vercel/project.json` (`projectId`), or Vercel → Project → Settings → General → Project ID. |
| `ATLAS_PROD_URL` | Variable (or Secret) | Scheduled Health | Optional | The live production URL, e.g. `https://smart-admin.vercel.app` or a custom domain. Omit to use the default. A repo **Variable** is fine since the URL is not sensitive. |

**Minimum to enable deploy + health:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID` (deploy) and optionally `ATLAS_PROD_URL` (health; has a
sensible default).

## Optional runtime environment for the deployed app

These are **not** needed for the workflows themselves — set them on the Vercel
project (Settings → Environment Variables) to enable optional app features:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon serverless Postgres connection string. The data layer falls back to in-memory seed data when unset (`isDbConfigured` / `getDb()` returns null), so the app runs fully without it. |
| `ANTHROPIC_API_KEY` | Enables optional Anthropic-powered features. Safe to omit if unused. |
