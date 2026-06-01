# ATLAS OS — the Habitat Twin

> **Smart-admin** — _a smart admin that controls the entire building and every layer._

The building operations platform for **Project ATLAS**: autonomous, self-sufficient
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
| **F2** | Per-floor telemetry | Tap a floor → live energy / water / food / occupancy / climate metrics |
| **F3** | Security & incident feed | Severity-ranked, live; click an event to focus its floor |
| **F4** | Resident broadcast | Compose + send notifications; mirrored into the incident feed |
| **F5** | Building KPI strip | Autonomy %, battery, solar, water reuse, food output, residents, open incidents |
| **+** | **Guided walk-through** | Animated camera descent from the rooftop pool down to the underground Reclamation Core, with futuristic bold-italic annotation callouts (arrows + quotes) |
| **+** | **WebXR AR mode** | "Enter AR" on compatible devices (Android / Chrome WebXR). iOS Safari lacks WebXR — use the guided walk-through there |
| **+** | **12 penthouses + shared rooftop pool** | A penthouse floor of up to 12 premium dwellings sharing the Skydeck pool directly overhead |

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
```

### Optional: connect a database

```bash
cp .env.example .env        # set DATABASE_URL to a Neon connection string
npm run db:push             # create tables
npm run db:seed             # load the canonical ATLAS-01 data
```

## API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/floors` | `GET` | All floors, ordered bottom → top |
| `/api/incidents` | `GET` / `POST` | Read the feed / create an event |
| `/api/broadcasts` | `GET` / `POST` | Read history / send a resident broadcast |

## Project layout

```
src/
  app/
    page.tsx              # server load (seed fallback) → Console
    layout.tsx, globals.css
    api/{floors,incidents,broadcasts}/route.ts
  components/
    Console.tsx           # client orchestrator + mode controls
    HabitatTwin.tsx       # 3D twin, walk-through camera, AR launcher, annotations
    FloorPanel.tsx        # F2 per-floor telemetry
    IncidentFeed.tsx      # F3 severity-ranked feed
    BroadcastComposer.tsx # F4 resident broadcast
    KpiStrip.tsx          # F5 building KPIs
  lib/
    types.ts, ui.ts, annotations.ts
    data.ts               # data access with seed fallback
    db/{schema,index,seed,seed-data}.ts
```

## Safety model

ATLAS OS **advises and optimizes; it never holds a life-safety function.** Deterministic,
safety-rated controls (fire, egress, water, power cutoffs) and a human-in-the-loop always
own safety-critical actions — exactly as specified in the PRD control hierarchy.

---

_ATLAS is operationally independent, not legally exempt; it supplies fresh food, not all
calories; and its AI optimizes but never overrides safety._
