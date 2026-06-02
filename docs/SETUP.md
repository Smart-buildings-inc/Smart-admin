# ATLAS OS — Setup & Onboarding Guide

ATLAS OS is the **Habitat Twin** for Project ATLAS: a Next.js 14 (App Router) +
TypeScript app that renders an interactive 3D digital twin of a self-sufficient
residential habitat. This guide gets you from a fresh clone to a running app,
through optional persistence, deployments, CI, and the Claude Code web workflow.

---

## 1. Local development

```bash
git clone <your-fork-or-repo-url> Smart-admin
cd Smart-admin
npm install
npm run dev          # http://localhost:3000
```

`npm run dev` starts the Next.js dev server on **port 3000**.

### Local-first by design

The app is **local-first**: it renders on built-in **seed data with NO database
connected**. Open `http://localhost:3000` and the full ATLAS-01 habitat is
there — floors, telemetry, the incident feed, broadcasts, and KPIs all work, and
mutations (creating incidents, sending broadcasts) are held in memory for the
session. You do **not** need a database, and you do **not** need an `.env` file
to develop.

Only copy the env template if you specifically want persistence:

```bash
cp .env.example .env   # then set DATABASE_URL — see section 2
```

### Other useful scripts

| Script | Command | Purpose |
|---|---|---|
| Dev server | `npm run dev` | Next.js dev server on port 3000 |
| Production build | `npm run build` | Build the app |
| Start (prod) | `npm run start` | Serve the built app (honors `$PORT`) |
| Lint | `npm run lint` | `next lint` |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| E2E tests | `npm run test:e2e` | Playwright suite |

---

## 2. Database (optional)

Persistence is entirely optional. Without it, the app serves seed data; with it,
floors, incidents, and broadcasts persist.

### How it works

- The app uses **Drizzle ORM** with the **`@neondatabase/serverless`** driver via
  the `drizzle-orm/neon-http` adapter (`src/lib/db/index.ts`).
- The single env var that drives everything is **`DATABASE_URL`**.
- If `DATABASE_URL` is unset, `isDbConfigured` is `false`, no client is ever
  constructed, and the data layer (`src/lib/data.ts`) transparently falls back to
  seed data.
- If `DATABASE_URL` is set, Drizzle connects and reads/writes go to Postgres.

### Which database

Any **serverless-compatible Postgres** works, because the driver speaks the Neon
HTTP protocol:

- **Neon** — the canonical choice. Create a project at <https://neon.tech> and
  copy the connection string.
- **Supabase Postgres** — also works. Use the **connection / pooler URL** from the
  Supabase dashboard (Project → Settings → Database → Connection string /
  connection pooling), not just the project URL.

Set it in your `.env`:

```bash
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

### Database commands

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate SQL migrations from the schema (`drizzle-kit generate`) |
| `npm run db:push` | Push the schema directly to the database / create tables (`drizzle-kit push`) |
| `npm run db:seed` | Load the canonical ATLAS-01 seed data (`tsx src/lib/db/seed.ts`) |

Drizzle reads its config from `drizzle.config.ts`, which points at
`src/lib/db/schema.ts` (dialect `postgresql`) and uses `DATABASE_URL` for
credentials. A typical first-time persistence setup is:

```bash
cp .env.example .env   # set DATABASE_URL
npm run db:push        # create tables
npm run db:seed        # load ATLAS-01 data
```

---

## 3. Deployments

The app runs the full Next.js server (API routes + optional Postgres) and is
deployable to any Node host. In all cases, set `DATABASE_URL` as an environment
variable in the host's dashboard **only if you want persistence** — otherwise the
deploy "just works" on seed data.

### Netlify (currently active)

A [`netlify.toml`](../netlify.toml) is included and Netlify is the **currently
active** deployment — project **`smartbuildingblueprint`**.

- Build command: `npm run build`, publish dir: `.next`, Node 20.
- Netlify's official Next.js runtime (`@netlify/plugin-nextjs`) serves the App
  Router, server components, and the `/api/*` routes as serverless functions.
- Deploy: Netlify dashboard → Add new site → Import from GitHub → pick this repo.
- For persistence: add `DATABASE_URL` in the Netlify dashboard.

### Render (blueprint available)

A [`render.yaml`](../render.yaml) Blueprint is included.

- Render dashboard → **New → Blueprint** → connect this repo. Render reads
  `render.yaml` and provisions a free web service.
- Build: `npm install && npm run build`; start: `npm run start` (`next start`
  honors Render's injected `$PORT`). Health check at `/`, Node 20, auto-deploy on.
- For persistence: uncomment / add the `DATABASE_URL` env var in the Render
  dashboard (it's left unset in the blueprint so the free deploy works on seed
  data).

### Vercel (optional)

Vercel is supported but **optional — no project is linked yet**. It's a standard
Next.js 14 app, so it deploys one-click on Vercel. Add `DATABASE_URL` in the
Vercel project's environment variables if persistence is wanted.

---

## 4. Continuous integration

CI is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and runs
on every **push** and **pull request**. It has two jobs that run **in parallel**:

- **`build`** — `npm ci`, then `npm run typecheck`, `npm run lint`, and
  `npm run build`.
- **`e2e`** — `npm ci`, `npx playwright install --with-deps chromium`, then
  `npm run test:e2e`. Playwright's `webServer` builds and starts the app on port
  3000, so this job only needs the Chromium download.

Both jobs use Node 20 with npm caching.

---

## 5. Claude Code on the web

This repo is set up to work in **Claude Code on the web**:

- A **SessionStart hook** at [`.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh)
  prepares remote (web) containers so tests and linters work. It runs only when
  `CLAUDE_CODE_REMOTE=true`, then runs `npm install` and
  `npx playwright install chromium`. It's idempotent and non-interactive; local
  sessions skip it (they already have deps).
- [`.claude/settings.json`](../.claude/settings.json) registers that hook under
  `SessionStart` and **allow-lists common dev commands** so they don't prompt:
  `npm run:*`, `npm install:*`, `npm ci:*`, `npx playwright:*`, `npx next:*`, and
  the common read/write git commands (`git status/diff/log/add/commit/push`).

No action is needed to use these — they take effect automatically in a web
session.

---

## 6. Connectors used in development

Development uses the following MCP connectors:

- **GitHub**
- **Supabase**
- **Vercel**
- **Netlify**
- **Figma**

> These MCP connectors are configured in the **Claude Code web UI**
> (Settings → Connectors), **not** in this repository. There's nothing to install
> or commit in the repo to enable them.

---

## Quick reference

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Run locally (port 3000) | `npm run dev` |
| Enable persistence | `cp .env.example .env`, set `DATABASE_URL`, `npm run db:push`, `npm run db:seed` |
| Production build | `npm run build` then `npm run start` |
| Lint / typecheck | `npm run lint` / `npm run typecheck` |
| E2E tests | `npm run test:e2e` |

**Key env var:** `DATABASE_URL` (optional; unset → seed data).
