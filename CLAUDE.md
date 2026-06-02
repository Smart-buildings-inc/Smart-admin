# ATLAS OS — Habitat Twin

Building-operations platform for self-sufficient "ATLAS" habitats: a single building modeled as one
floor per human need (water, energy, food, shelter, air, health, restoration), rendered as an
interactive 3D digital twin with live per-floor telemetry, incident triage, and resident broadcast.

**Local-first:** the app renders fully on in-memory seed data with **no database connected**. Set
`DATABASE_URL` (a Neon serverless Postgres connection string) to enable optional persistence of
floors, incidents, broadcasts, sensor points, and fleet buildings. The data layer transparently
falls back to seed data whenever `DATABASE_URL` is unset (`isDbConfigured` / `getDb()` returns null).

## Tech stack

- **Next.js 14** (App Router) + **React 18**, **TypeScript** (strict, `tsc --noEmit` for typecheck).
- **Tailwind CSS** with a custom dark ops-console palette: `ink.*` (surfaces), `signal.*`
  (ok/info/warn/crit), `need.*` (per-need accent colors). See `tailwind.config.ts`.
- **Drizzle ORM** (`drizzle-orm/neon-http`) over **@neondatabase/serverless** (Neon Postgres).
- **three.js** + **@react-three/fiber** / **@react-three/drei** for the 3D twin (`next.config.mjs`
  transpiles `three`).
- **Playwright** for e2e tests.

## Commands

- `npm run dev` — dev server (port 3000)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — Next.js ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run test:e2e` — Playwright (its `webServer` runs `build && start` first)
- `npm run db:generate` — drizzle-kit generate migrations
- `npm run db:push` — push schema to the configured DB
- `npm run db:seed` — seed the DB (`tsx src/lib/db/seed.ts`)

## Architecture

- **Pages (server components)** fetch initial data and pass it into client components:
  - `src/app/page.tsx` — main Console (the twin + panels). `force-dynamic`.
  - `src/app/simulator/page.tsx` — Building Simulator (F12): a live, operating
    voxel/pixel-art twin of ATLAS-01 (cut-away floors, working elevator,
    switchback stairs, rooftop solar + reservoir, voxel residents). `force-dynamic`.
  - `src/app/fleet/page.tsx` — Fleet view (F7), multi-building rollup.
  - `src/app/layout.tsx` — root layout; renders the shared `NavBar` above all pages.
- **Data access** is centralized and DB-optional:
  - `src/lib/data.ts` — floors, incidents, broadcasts, building KPIs. Each function calls `getDb()`
    and falls back to seed data (with mutable in-memory stores for incidents/broadcasts) when no DB.
    Sending a broadcast also mirrors an `info` incident into the feed.
  - `src/lib/fleet.ts` — fleet buildings (kept separate from the single-building console).
  - `src/lib/sensors.ts` — tagged sensor-point ingestion/query (F11), Brick/Haystack-style tags.
  - `src/lib/db/` — `index.ts` (client + `isDbConfigured`), `schema.ts`, `seed-data.ts`, `seed.ts`.
  - `src/lib/types.ts` — shared domain types (`Floor`, `Incident`, `Broadcast`, `BuildingKpis`,
    `SensorPoint`, `Building`). `src/lib/ui.ts` maps enums → colors/labels (keep in sync with
    `tailwind.config.ts` `need.*` / `signal.*`).
    - `Floor` now carries occupancy classification (`OccupancyGroup` A–F, `UseScope`
      residential/amenity/business/mechanical/industrial), per-floor `dwellings`, `beds`,
      and `regulatoryNotes[]` — see `docs/ATLAS-data-model.md` §2.
    - `Building` now carries `dwellings`, `beds`, `gridTied`, and `islandCapable` — the
      energy strategy is explicitly grid-tied + islanding, not off-grid (§3).
    - `BuildingKpis` now carries a `resilience` object with sub-scores (`energyPct`,
      `waterPct`, `foodPct`, `overall`); `autonomyPct` is kept as a back-compat alias for
      `energyPct`; `foodPct` uses `FOOD_TARGET_KG_PER_RESIDENT = 0.5 kg/day/resident` (§4).
    - Full model reference: `docs/ATLAS-data-model.md`.
- **API routes** (`src/app/api/*`, all `force-dynamic`): `floors`, `incidents`, `broadcasts`,
  `sensors`. They delegate to the lib data layer and validate POST bodies, returning JSON
  (`201` on create, `400` on bad input).
- **Client `Console`** (`src/components/Console.tsx`) orchestrates the UI: lazy-loads `HabitatTwin`
  (WebGL, `ssr: false`), wires `KpiStrip`, `FloorPanel`, `IncidentFeed`, `BroadcastComposer`,
  manages floor selection + orbit/walk-through twin modes, and polls `/api/incidents` every ~15s.
- **Client `SimulatorView`** (`src/components/SimulatorView.tsx`) owns the Building Simulator DOM
  chrome (controls, legend, telemetry, live elevator indicator) and lazy-loads the WebGL scene
  `BuildingSimulator.tsx` (`ssr: false`) — a procedural voxel building (no Blender/GLTF assets;
  geometry authored in three.js). Pixelation is a low `dpr` buffer upscaled nearest-neighbour.
- **Feature labels:** code comments tag features `F1`–`F7` (e.g. F1 twin, F2 floor panel, F3 feed,
  F4 broadcast, F5 KPI strip, F7 fleet) plus `F11` (sensor ingestion) and `F12` (building simulator).
  Grep these labels to locate the code behind a feature.

## Conventions

- Dark, iOS-flavored ops-console UI; mobile-first responsive layout (safe-area insets, collapsible
  `NavBar` drawer on mobile, single-column → grid at `lg`).
- Reuse the CSS primitives in `src/app/globals.css`: `.panel`, `.panel-pad`, `.kpi-label`,
  `.kpi-value`, plus `.display`, `.important`, `.pulse`, `.float`, `.annotation`, `.scroll-thin`.
- Floor metrics are sparse (`FloorMetrics` is all-optional) — each floor reports only what it has;
  KPIs are derived by aggregating across floors in `getBuildingKpis()`.
- Keep colors consistent between `tailwind.config.ts` and `src/lib/ui.ts`.

## Testing

- Playwright config (`playwright.config.ts`) runs `npm run build && npm run start` on port 3000,
  across two projects: **Desktop Chrome** and **Mobile Chrome** (Pixel 5).
- Tests live in `e2e/`: `api.spec.ts` (API contracts, incl. broadcast→incident mirroring),
  `app.spec.ts` (console UI: header, KPI strip, seed chip, twin controls, feed),
  `broadcast.spec.ts` (broadcast send + feed update). Tests run on seed data; no DB required.

## Working agreement (standing rules for agents)

Durable conventions for this repository — follow them every session:

- **Push directly to `main`.** Commit and push routine work straight to `main`;
  no feature-branch/PR gate is required (the owner opted out). Keep commits
  focused with clear messages. CI still runs on every push.
- **Always resolve merge conflicts (and surface them).** Whenever a branch/PR
  has conflicts with `main`, merge the latest `main` into the branch, resolve
  the conflicts, and re-verify (typecheck/lint/e2e) so the branch stays
  mergeable — don't leave a conflicted PR sitting. Tell the owner what
  conflicted and how it was resolved.
- **Build & maintain in parallel with sub-agents.** When work splits into
  independent sub-tasks (distinct files, docs, investigations), fan them out to
  parallel sub-agents and batch independent tool calls rather than working
  serially. Reconcile and commit centrally to avoid git conflicts.
- **Prefer cloud automations.** Lean on GitHub Actions and the connected
  Vercel / Netlify / Supabase tooling to automate build, test, and deploy. CI
  runs `build` and `e2e` as parallel jobs (`.github/workflows/ci.yml`); extend
  it as the app grows.
- **Verify before pushing.** Run `npm run typecheck`, `npm run lint`, and the
  relevant `npm run test:e2e` so pushes to `main` stay green.
