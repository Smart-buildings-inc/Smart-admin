# ATLAS OS — the Habitat Twin

> **Smart-admin** — _a smart admin that controls the entire building and every layer._

The building operations platform for **Project ATLAS**: grid-tied, high-resilience
residential habitats where every floor is dedicated to one human need (water, energy,
food, shelter, air, health, restoration). ATLAS OS is the human window into the same
live telemetry the AI ops layer optimizes against — an interactive **3D digital twin**
where operators inspect per-floor metrics, triage incidents, and broadcast to residents.

This repo implements the **P0 feature set** from the PRD, plus an immersive
walk-through and AR mode.

## Features

| | Feature | Notes |
|---|---|---|
| **F1** | 3D Habitat Twin | Orbitable tower; floors color-coded by human need; floors with an active incident pulse |
| **F2** | Per-floor telemetry | Tap a floor → live energy / water / food / occupancy / climate metrics; occupancy classification (OccupancyGroup + UseScope) and compliance notes per floor |
| **F3** | Security & incident feed | Severity-ranked, live; click an event to focus its floor |
| **F4** | Resident broadcast | Compose + send notifications; mirrored into the incident feed |
| **F5** | Building KPI strip | Resilience Index (energy autonomy / non-potable reuse / food amenity sub-scores), battery, solar, dwellings, residents, open incidents |
| **F7** | Fleet view | Multi-building rollup with per-building KPIs, `gridTied`/`islandCapable` flags, and a **Permitting & compliance** detail panel per building (elevator count, firefighter elevator, exit stairs, sprinkler coverage, barrier-free/AODA, CSA B128 dual-plumbing, MECP ECA status, reservoir location, ESS fire-code compliance) |
| **F12** | Building Simulator | Live architectural cutaway twin of ATLAS-01 (curtain-wall frame, cut-away floors, working **dual elevators**, switchback stairs, **bulk reservoir in basement** / Reclamation Core, **pool-only rooftop**) — geometry matches the right-sized permitted design |
| **+** | **Portfolio** | `/portfolio` — OpCo/PropCo capital structure, Canadian funding programs (CMHC MLI Select, Greener Affordable Housing, Save on Energy, SR&ED, NRC IRAP), and three-phase approvals timeline |
| **+** | **Guided walk-through** | Animated camera descent from the rooftop pool down to the underground Reclamation Core, with futuristic bold-italic annotation callouts (arrows + quotes) |
| **+** | **WebXR AR mode** | "Enter AR" on compatible devices (Android / Chrome WebXR). iOS Safari lacks WebXR — use the guided walk-through there |
| **+** | **12 penthouses + shared rooftop pool** | A penthouse floor of up to 12 premium market dwellings sharing the Skydeck pool directly overhead |
| **+** | **Privacy-by-design presence sensing** | WiFi-CSI occupancy via [RuView](https://github.com/ruvnet/RuView) ESP32-S3 nodes — presence, person count, and vitals through walls with no cameras or wearables; seed fallback when hardware is absent. See [docs/ATLAS-ruview-presence.md](./docs/ATLAS-ruview-presence.md) |

### KPI labels — honest-by-design

| KPI | What it measures | What it does NOT claim |
|---|---|---|
| **Energy autonomy** | % of electrical demand met by on-site solar + ESS dispatch | Off-grid independence — building is grid-tied + islanding-capable |
| **Non-potable reuse** | % of non-potable demand (toilets, irrigation) met by greywater/rainwater reclamation | Blackwater → potable — not permittable under SDWA/MECP ECA in Ontario |
| **Food (amenity)** | Resident-amenity produce yield, kg/day | Commercial food production or full caloric sufficiency |
| **Resilience Index** | Blended average of the three sub-scores above (0–100) | A single "autonomy" number that obscures which systems are strong or limited |

### Right-sized to permit (Canada)

ATLAS-01 is designed around what is **defensible, fundable, and buildable** under
current Ontario/Canadian rules:

- **Water:** greywater + rainwater → non-potable reuse only (CSA B128 dual-plumbing,
  MECP Environmental Compliance Approval). Bulk cistern is basement-located; rooftop
  carries the pool only.
- **Food:** resident amenity / closed-loop (no external sale — avoids CFIA food-premises
  and provincial licensing). Value is lease-up, ESG, and resident wellbeing; revenue is $0.
- **Energy:** grid-tied + islanding (IEEE 1547 / LDC interconnection); ESS designed to
  current fire-code separation and ventilation requirements. Not off-grid.
- **Occupancy:** conventional market multi-unit residential (OBC Group C) with F/mechanical
  floors for plant and D/business for the commons. Clinic is telehealth + first-aid only
  (avoids Group B). Full data: [docs/ATLAS-data-model.md](./docs/ATLAS-data-model.md).

See [docs/ATLAS-derisking-plan.md](./docs/ATLAS-derisking-plan.md) for the full de-risking
decision record, and [docs/ATLAS-data-model.md](./docs/ATLAS-data-model.md) for the
expanded domain model (occupancy classification, resilience index, dwellings/beds/floors
distinction).

## Local-first by design

The app **renders on seed data with no database connected** — open it and the full
ATLAS‑01 habitat is there. Connect a [Neon](https://neon.tech) Postgres database via
`DATABASE_URL` to persist floors, incidents, and broadcasts. This mirrors the PRD
principle that the cloud app is an optimization, never a dependency.

## Stack

- **Next.js 14** (App Router, Route Handlers) + **TypeScript**
- **Three.js** via `@react-three/fiber` + `@react-three/drei` for the twin
- **Tailwind CSS** + bespoke ops-console styling (SF Pro / Apple iOS aesthetic)
- **Drizzle ORM** → **Neon** serverless Postgres
- Deployable to **Vercel**

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 — runs on seed data, no DB needed
npm run verify       # typecheck + lint + build + desktop/tablet/mobile e2e
```

### Optional: connect a database

```bash
cp .env.example .env        # set DATABASE_URL to a Neon connection string
npm run db:push             # create tables
npm run db:seed             # load the canonical ATLAS-01 data
```

## Routes

| Route | Purpose |
|---|---|
| `/` | Main Console — 3D twin, per-floor telemetry, KPI strip, incident feed, broadcast |
| `/fleet` | Fleet view — multi-building rollup with KPIs and compliance detail |
| `/simulator` | Building Simulator (F12) — live architectural cutaway with right-sized geometry |
| `/portfolio` | Portfolio — OpCo/PropCo structure, funding programs, approvals timeline |

## API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/floors` | `GET` | All floors, ordered bottom → top |
| `/api/incidents` | `GET` / `POST` | Read the feed / create an event |
| `/api/broadcasts` | `GET` / `POST` | Read history / send a resident broadcast |
| `/api/presence` | `GET` | Per-floor presence data (`?floor=key` to filter); seed fallback when RuView hardware is absent |

## Project layout

```
src/
  app/
    page.tsx              # server load (seed fallback) → Console
    fleet/page.tsx        # Fleet view (F7)
    simulator/page.tsx    # Building Simulator (F12)
    portfolio/page.tsx    # Portfolio — OpCo/PropCo + funding programs + approvals
    layout.tsx, globals.css
    api/{floors,incidents,broadcasts,sensors}/route.ts
  components/
    Console.tsx           # client orchestrator + mode controls
    HabitatTwin.tsx       # 3D twin, walk-through camera, AR launcher, annotations
    FloorPanel.tsx        # F2 per-floor telemetry + occupancy classification
    IncidentFeed.tsx      # F3 severity-ranked feed
    BroadcastComposer.tsx # F4 resident broadcast
    KpiStrip.tsx          # F5 building KPIs + Resilience Index
    SimulatorView.tsx     # F12 DOM chrome + controls
    BuildingSimulator.tsx # F12 architectural scene (three.js, ssr:false)
  lib/
    types.ts, ui.ts, annotations.ts
    data.ts               # data access with seed fallback
    finance.ts            # Entity / FundingProgram / ApprovalGate + seed data
    fleet.ts              # fleet buildings
    sensors.ts            # sensor-point ingestion/query (F11)
    ruview.ts             # RuView WiFi-CSI presence adapter (RUVIEW_API_URL → live; seed fallback)
    db/{schema,index,seed,seed-data}.ts
```

## Brand assets

The chrome-on-black habitat emblem (planet, orbital rings, skyline, Wi-Fi,
circuit traces) is authored as scalable SVG, with raster fallbacks baked from
it:

- `public/logo.svg` — full-detail emblem for marketing / large surfaces.
- `src/app/icon.svg` — simplified mark, tuned to stay legible at 16–32 px; used
  for the favicon and the NavBar brand. Next.js auto-links `icon.svg`,
  `favicon.ico`, and `apple-icon.png` from `src/app`.
- `public/icon-192.png`, `public/icon-512.png` — PWA / manifest icons.
- `public/og.png` — 1200×630 Open Graph / social card.

Raster files are committed, so the app ships with **no image-processing
dependency**. Regenerate them after editing either SVG:

```bash
npm i --no-save sharp png-to-ico && node scripts/gen-icons.mjs
```

## Deploy

The app runs the full Next.js server (API routes + optional Postgres), and is
deployable to any Node host. A [Render](https://render.com) Blueprint is included:

1. Push the repo to GitHub (done).
2. Render dashboard → **New → Blueprint** → connect this repo.
3. Render reads [`render.yaml`](./render.yaml) and provisions a free web service
   running `npm install && npm run build` then `npm run start`.
4. No env vars needed — it runs on seed data. Add `DATABASE_URL` (a Neon string)
   in the Render dashboard later to enable persistence.

> Also works one-click on Vercel/Netlify/Cloudflare Pages — it's a standard
> Next.js 14 app. `next start` honors the host's injected `$PORT`. A
> [`netlify.toml`](./netlify.toml) is included for Netlify's Next.js runtime.

## Program documents

Beyond the software, the venture is documented in [`docs/`](./docs/README.md):

- [Business Plan](./docs/BUSINESS_PLAN.md)
- [Budget & Fundraising](./docs/BUDGET_AND_FUNDRAISING.md)
- [Investor & Donor Pitch Deck](./docs/PITCH_DECK.md)
- [Enterprise Sales Playbook](./docs/ENTERPRISE_SALES_PLAYBOOK.md)
- [Enterprise Offer Sheet](./docs/ENTERPRISE_OFFER_SHEET.md)
- [Legal & Compliance Framework](./docs/LEGAL_COMPLIANCE.md)

## Safety model

ATLAS OS **advises and optimizes; it never holds a life-safety function.** Deterministic,
safety-rated controls (fire, egress, water, power cutoffs) and a human-in-the-loop always
own safety-critical actions — exactly as specified in the PRD control hierarchy.

---

_ATLAS is operationally independent, not legally exempt; it supplies fresh food, not all
calories; and its AI optimizes but never overrides safety._
