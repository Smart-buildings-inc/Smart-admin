import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Audience marketing pages — content model.
//
// Five intentional landing pages, one per buyer/user we sell to. Each is the
// same template (see components/MarketingPage.tsx) driven by the config below,
// so messaging stays on-brand and the pages never drift structurally. Accents
// are drawn from the need-palette so every audience owns one of the seven
// colors the rest of the product already speaks in.
// ---------------------------------------------------------------------------

export type Stat = { value: string; label: string };
export type Value = { tag: string; title: string; body: string; icon: ReactNode };
export type Step = { step: string; title: string; body: string };

export type Audience = {
  slug: string; // route under /for/<slug>
  nav: string; // short label for switchers / nav
  eyebrow: string; // small all-caps kicker
  accent: string; // hex, from the need palette
  metaTitle: string;
  metaDescription: string;
  headline: { lead: string; accent: string; tail: string };
  subhead: string;
  stats: Stat[];
  values: Value[];
  steps: { kicker: string; items: Step[] };
  signatureCaption: string;
  quote: { text: string; who: string; role: string };
  cta: { title: string; body: string };
};

// Compact Lucide-style stroke icons (inherit currentColor from the accent).
const I = {
  blueprint: <path d="M3 4h18v16H3zM3 9h18M8 9v11M8 13h5M8 16h5" />,
  rocket: (
    <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a5 5 0 0 1 1-3c2.5-4 8-5 8-5s-1 5.5-5 8a5 5 0 0 1-3 1M9 11l4 4M9 11l-3 1m7 7 1-3" />
  ),
  gauge: <path d="M12 14 16 9M4 18a8 8 0 1 1 16 0M9 18h6" />,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />,
  leaf: <path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 11-4 16-9 16M4 21c4-7 8-9 11-10" />,
  shield: <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3ZM9 12l2 2 4-4" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4-9 5-9-5" />,
  trend: <path d="M3 17l6-6 4 4 8-8M21 7v5h-5" />,
  coins: <path d="M8 8a5 3 0 1 0 0-.01M3 8v8a5 3 0 0 0 10 0M13 11a5 3 0 0 0 8 2.5M16 5a5 3 0 1 0 0-.01M21 8v8a5 3 0 0 1-5 2.6" />,
  cpu: <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3M3 15h3m12-6h3m-3 6h3M6 6h12v12H6zM10 10h4v4h-4z" />,
  building: <path d="M3 21h18M5 21V5l7-2v18M19 21V9l-7-2M9 8h.01M9 12h.01M9 16h.01" />,
  heart: <path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20Z" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11ZM9 14a3 3 0 0 0 3 3" />,
  globe: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />,
  scale: <path d="M12 3v18M7 21h10M5 7h14M5 7l-2 6a3 3 0 0 0 6 0L7 7m12 0-2 6a3 3 0 0 0 6 0l-2-6" />,
  users: <path d="M16 18a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 18a3 3 0 0 0-4-2.8M18 11a2.5 2.5 0 0 0 0-5" />,
  sun: <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />,
};

export const AUDIENCES: Audience[] = [
  // ----------------------------------------------------------------- 1. Devs
  {
    slug: "developers",
    nav: "Developers",
    eyebrow: "For developers & owners",
    accent: "#ffcf4d", // energy
    metaTitle: "ATLAS OS for Developers & Owners — Buildings that run themselves",
    metaDescription:
      "Hand over a building that operates itself. ATLAS OS gives every project a live operating twin from day one, on an open Brick/Haystack stack, ready to scale from one tower to a fleet.",
    headline: { lead: "Deliver buildings that ", accent: "run themselves", tail: "." },
    subhead:
      "Model the building once — one floor per human need — and hand over a living operating twin on day one. Less commissioning risk, lower opex, and an asset that's fleet-ready from the start.",
    stats: [
      { value: "~30%", label: "Lower operating cost vs. a conventional tower" },
      { value: "Day 1", label: "Operating twin live at handover" },
      { value: "1→∞", label: "Same model scales tower to fleet" },
    ],
    values: [
      {
        tag: "De-risk delivery",
        title: "Commission against the twin",
        body: "Validate every system — water, energy, food, air — against a live 3D model before and during handover. Catch the gap on screen, not in a callback.",
        icon: I.blueprint,
      },
      {
        tag: "Open stack",
        title: "Brick / Haystack-native",
        body: "Tagged sensor points map straight onto your existing building schema. No proprietary lock-in, no rip-and-replace integration project.",
        icon: I.cpu,
      },
      {
        tag: "Operating twin",
        title: "Handover that keeps working",
        body: "The same twin you sold the vision with becomes the console operators run the building from. The story and the system are one artifact.",
        icon: I.layers,
      },
      {
        tag: "Portfolio-ready",
        title: "One tower, then the fleet",
        body: "Roll a second, fifth, fiftieth building into a single fleet view with no re-platforming. The model was built to multiply.",
        icon: I.building,
      },
    ],
    steps: {
      kicker: "From drawing to operating asset",
      items: [
        { step: "01", title: "Model", body: "Lay out the tower as seven systems of life — the twin is authored alongside the building." },
        { step: "02", title: "Commission", body: "Bring systems online against live telemetry, verified floor by floor in the twin." },
        { step: "03", title: "Operate", body: "Hand operators a console that's already running — autonomy, KPIs, incidents, broadcast." },
      ],
    },
    signatureCaption: "Your tower, modeled once — operating twin from day one",
    quote: {
      text: "We stopped selling a building and started handing over a system that runs itself.",
      who: "Development partner",
      role: "ATLAS-grade habitat",
    },
    cta: {
      title: "Build the asset, ship the twin",
      body: "See how a single model carries a project from pitch to handover to a living operations console.",
    },
  },

  // ------------------------------------------------------------- 2. Operators
  {
    slug: "operators",
    nav: "Operators",
    eyebrow: "For operators & facility teams",
    accent: "#7fe7e0", // air
    metaTitle: "ATLAS OS for Operators — The whole building in one breath",
    metaDescription:
      "Run the entire habitat from one pane: a live 3D twin, per-floor telemetry, sub-15-second incident triage, and habitat-wide broadcast. Built for the team on shift.",
    headline: { lead: "See the whole building ", accent: "in one breath", tail: "." },
    subhead:
      "A single ops console for the people on shift: orbit the live twin, read every floor's vitals, catch incidents the moment they fire, and reach every resident in one message.",
    stats: [
      { value: "<15s", label: "Incident-to-feed latency" },
      { value: "99.98%", label: "Twin-monitored uptime" },
      { value: "7→1", label: "Seven systems, one pane of glass" },
    ],
    values: [
      {
        tag: "Live twin",
        title: "The building, rendered live",
        body: "Orbit or walk through a 3D model fed by real telemetry. Floors glow by status and pulse the instant something needs you.",
        icon: I.gauge,
      },
      {
        tag: "Triage",
        title: "Catch it in seconds",
        body: "A ranked feed surfaces ok / info / warn / crit events as they happen, polled continuously so the room is never stale.",
        icon: I.bell,
      },
      {
        tag: "Broadcast",
        title: "Reach everyone at once",
        body: "Compose a habitat-wide message and send — it mirrors straight into the incident feed as a permanent record of the call.",
        icon: I.users,
      },
      {
        tag: "Telemetry",
        title: "Every floor's vitals",
        body: "Generation, load, battery, water reuse, AQI, occupancy — sparse per-floor metrics rolled into KPIs you can trust at a glance.",
        icon: I.cpu,
      },
    ],
    steps: {
      kicker: "How a shift runs",
      items: [
        { step: "01", title: "Scan", body: "Open the console — KPIs and the twin show the building's whole state at a glance." },
        { step: "02", title: "Triage", body: "An event fires; the feed ranks it and the twin points you straight to the floor." },
        { step: "03", title: "Act", body: "Resolve, then broadcast the all-clear to residents — logged automatically." },
      ],
    },
    signatureCaption: "ATLAS-01, live — every floor a human need",
    quote: {
      text: "I used to chase five dashboards. Now the building tells me where to look.",
      who: "Operations lead",
      role: "On-shift, ATLAS-01",
    },
    cta: {
      title: "Run the building from one console",
      body: "Open the live console on seed data — no setup, no database — and see a shift the ATLAS way.",
    },
  },

  // ------------------------------------------------------------- 3. Residents
  {
    slug: "residents",
    nav: "Residents",
    eyebrow: "For residents & communities",
    accent: "#c0a4ff", // shelter
    metaTitle: "ATLAS OS for Residents — A home that takes care of you",
    metaDescription:
      "Clean air, reused water, food grown in-building, and a team that reaches you the moment it matters. ATLAS habitats are designed around seven human needs — and they're transparent about all of them.",
    headline: { lead: "A home that ", accent: "takes care of you", tail: "." },
    subhead:
      "Every ATLAS building is organized around seven human needs — water, energy, food, shelter, air, health, restoration — and it's honest with you about all of them, in real time.",
    stats: [
      { value: "99.4%", label: "Air quality, monitored continuously" },
      { value: "96%", label: "Water reused on-site" },
      { value: "24/7", label: "Health floor, always staffed" },
    ],
    values: [
      {
        tag: "Air",
        title: "Breathe easy, knowingly",
        body: "Live air-quality on every floor, with a living atrium that actually cleans the air you share. No black boxes.",
        icon: I.leaf,
      },
      {
        tag: "Water & food",
        title: "Grown and reused close to home",
        body: "Water reclaimed on-site and produce grown floors below you — fresher, with a footprint you can see.",
        icon: I.drop,
      },
      {
        tag: "Care",
        title: "Help that already knows the building",
        body: "A 24/7 health floor and a team that gets the all-clear to you in seconds when something changes.",
        icon: I.heart,
      },
      {
        tag: "Restoration",
        title: "Room to actually rest",
        body: "Skydeck, quiet hours, shared green space — restoration is a floor here, not an afterthought.",
        icon: I.sun,
      },
    ],
    steps: {
      kicker: "What living here feels like",
      items: [
        { step: "01", title: "Transparent", body: "See your building's air, water, and energy the same way the operators do." },
        { step: "02", title: "Responsive", body: "Broadcasts reach you instantly — quiet hours, maintenance, the all-clear." },
        { step: "03", title: "Restorative", body: "A whole floor exists so you have somewhere to breathe and reset." },
      ],
    },
    signatureCaption: "Seven floors, seven systems of life — your home",
    quote: {
      text: "It's the first place I've lived that tells me the truth about the air I'm breathing.",
      who: "Resident",
      role: "Shelter floor, ATLAS-01",
    },
    cta: {
      title: "Step inside the habitat",
      body: "Walk the seven floors in the live simulator and see how the building looks after the people in it.",
    },
  },

  // ------------------------------------------------------------- 4. Investors
  {
    slug: "investors",
    nav: "Investors",
    eyebrow: "For investors & partners",
    accent: "#5ddc7a", // food
    metaTitle: "ATLAS OS for Investors — Habitats that compound",
    metaDescription:
      "A resilient, software-defined asset class: lower opex, near-grid-independent operation, and a model that scales from a single tower to an entire fleet on one platform.",
    headline: { lead: "Habitats that ", accent: "compound", tail: "." },
    subhead:
      "ATLAS turns a building into a software-defined, self-sufficient asset — lower operating cost, resilient through outages, and engineered to multiply from one tower into a fleet on a single platform.",
    stats: [
      { value: "~30%", label: "Opex reduction vs. comparable assets" },
      { value: "99%", label: "Energy autonomy, grid-optional" },
      { value: "1→∞", label: "One platform, tower to fleet" },
    ],
    values: [
      {
        tag: "Returns",
        title: "Opex out, NOI up",
        body: "Self-generated energy, reused water, and in-building food cut the recurring costs that quietly erode net operating income.",
        icon: I.trend,
      },
      {
        tag: "Resilience",
        title: "An asset that stays up",
        body: "Designed to run grid-optional and incident-aware, so value isn't hostage to a single utility or a bad night.",
        icon: I.shield,
      },
      {
        tag: "Scale",
        title: "Underwrite the fleet, not the one-off",
        body: "The same model and console roll across every building, so a portfolio reads as one coherent, comparable asset class.",
        icon: I.scale,
      },
      {
        tag: "ESG",
        title: "Reporting that's already instrumented",
        body: "Autonomy, water reuse, and air quality are measured continuously — sustainability claims backed by live telemetry, not estimates.",
        icon: I.leaf,
      },
    ],
    steps: {
      kicker: "The investment thesis",
      items: [
        { step: "01", title: "Lower the floor", body: "Self-sufficiency strips recurring opex and utility exposure out of the model." },
        { step: "02", title: "Raise the ceiling", body: "Resilient, instrumented operation protects NOI and supports premium positioning." },
        { step: "03", title: "Multiply", body: "One platform turns a single asset into a scalable, comparable fleet." },
      ],
    },
    signatureCaption: "One model, measured live — from a tower to a fleet",
    quote: {
      text: "It reads less like a building and more like an asset that improves with every unit we add.",
      who: "Capital partner",
      role: "ATLAS portfolio",
    },
    cta: {
      title: "See the fleet thesis",
      body: "Roll a single tower up into the fleet view and see how the model compounds across a portfolio.",
    },
  },

  // ------------------------------------------------------------- 5. Cities
  {
    slug: "cities",
    nav: "Cities",
    eyebrow: "For cities & public sector",
    accent: "#3aa0ff", // water
    metaTitle: "ATLAS OS for Cities — Resilient housing, measured and accountable",
    metaDescription:
      "Self-sufficient housing that stays online through outages and reports its own sustainability — energy autonomy, water reuse, and air quality, measured continuously and accountable by design.",
    headline: { lead: "Resilient housing, ", accent: "measured and accountable", tail: "." },
    subhead:
      "Housing that carries its own weight: near grid-independent, water-reusing, and air-clean by design — with every sustainability and resilience metric measured live, not promised in a report.",
    stats: [
      { value: "99%", label: "Energy autonomy, grid-optional" },
      { value: "96%", label: "Water reused on-site" },
      { value: "Live", label: "Sustainability metrics, continuously reported" },
    ],
    values: [
      {
        tag: "Resilience",
        title: "Stays online when the grid doesn't",
        body: "Self-generated power and on-site water keep essential systems running through outages — housing that's part of the city's resilience, not a liability in a crisis.",
        icon: I.shield,
      },
      {
        tag: "Accountability",
        title: "Metrics you can actually audit",
        body: "Energy autonomy, water reuse, and air quality stream from tagged sensor points — open, continuous, and verifiable, not annual estimates.",
        icon: I.gauge,
      },
      {
        tag: "Sustainability",
        title: "Lower load on shared infrastructure",
        body: "Reused water and self-generated energy ease demand on grids and mains — measurable relief for the systems around the building.",
        icon: I.globe,
      },
      {
        tag: "Standards",
        title: "Open by design",
        body: "Built on Brick / Haystack tagging, so the data integrates with the systems your agencies already run.",
        icon: I.cpu,
      },
    ],
    steps: {
      kicker: "Housing as public infrastructure",
      items: [
        { step: "01", title: "Self-sufficient", body: "Each building generates power, reuses water, and grows food — easing shared load." },
        { step: "02", title: "Resilient", body: "Grid-optional operation keeps essential systems up through outages." },
        { step: "03", title: "Accountable", body: "Every resilience and sustainability metric is measured live and open to audit." },
      ],
    },
    signatureCaption: "Self-sufficient by design — measured in the open",
    quote: {
      text: "Housing that reports its own resilience changes what we can promise residents.",
      who: "Public-sector partner",
      role: "Resilient housing program",
    },
    cta: {
      title: "Housing that carries its weight",
      body: "Explore the live console and see how self-sufficiency and accountability are built into every floor.",
    },
  },
];

export const AUDIENCE_BY_SLUG = new Map(AUDIENCES.map((a) => [a.slug, a]));
