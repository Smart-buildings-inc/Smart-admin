import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AsciiSignature from "@/components/AsciiSignature";
import { AUDIENCES } from "@/lib/audiences";

// Marketing / overview landing page ("Overview" in the nav). A unicorn-SaaS
// style presentation of ATLAS OS: a layered grid+aurora hero with an in-browser
// console product-shot, a "built on" tech strip, an operating-loop walkthrough,
// an icon-driven feature bento, a vertical tower visualization of the seven
// needs, and a closing CTA. Pure presentation — renders on static content, no
// data layer needed. Reuses the shared palette (ink/signal/need) and the
// .gradient-text / .aurora-spin / .grid-backdrop / .feature-card / .sheen /
// .rise-in primitives in globals.css. All motion honors prefers-reduced-motion.

export const metadata: Metadata = {
  title: "ATLAS OS — One building. Every human need, online.",
  description:
    "ATLAS OS is the operating system for self-sufficient habitats: a live 3D digital twin, per-floor telemetry, incident triage, and resident broadcast — for a single tower or a whole fleet.",
};

const STATS: { value: string; label: string }[] = [
  { value: "8", label: "Human needs, one per floor" },
  { value: "99.98%", label: "Habitat uptime, twin-monitored" },
  { value: "<15s", label: "Incident-to-feed latency" },
  { value: "1→∞", label: "From one tower to a fleet" },
];

// The actual stack — honest, and it doubles as a credibility strip.
const BUILT_ON: string[] = [
  "Next.js 14",
  "React 18",
  "three.js",
  "Drizzle ORM",
  "Neon Postgres",
  "Playwright",
];

// Operating loop: how the platform thinks, end to end.
const LOOP: { step: string; title: string; body: string; color: string }[] = [
  {
    step: "01",
    title: "Sense",
    body: "Brick / Haystack-tagged sensor points stream in from every floor — your existing building schema, native.",
    color: "#3aa0ff",
  },
  {
    step: "02",
    title: "Model",
    body: "Telemetry renders straight into a live 3D twin, color-coded by the human need each floor serves.",
    color: "#7fe7e0",
  },
  {
    step: "03",
    title: "Triage",
    body: "ok / info / warn / crit events surface in a ranked feed the moment they fire, polled continuously.",
    color: "#ff5d5d",
  },
  {
    step: "04",
    title: "Broadcast",
    body: "Reach every resident in one message — mirrored into the feed as a permanent record of the call.",
    color: "#c0a4ff",
  },
];

type Feature = {
  tag: string;
  title: string;
  body: string;
  color: string; // hex accent (tag text + hover bloom)
  icon: ReactNode;
  span?: boolean; // wide (2-col) bento cell
};

// Compact Lucide-style stroke icons (inherit currentColor from the tag tint).
const I = {
  cube: (
    <path d="M21 7.5 12 3 3 7.5m18 0L12 12M21 7.5v9L12 21m0-9L3 7.5M12 12v9M3 7.5v9L12 21" />
  ),
  gauge: <path d="M12 14 16 9M4 18a8 8 0 1 1 16 0M9 18h6" />,
  alert: <path d="M12 9v4m0 4h.01M10.3 4.3 2.6 17.6A2 2 0 0 0 4.3 21h15.4a2 2 0 0 0 1.7-3.4L13.7 4.3a2 2 0 0 0-3.4 0Z" />,
  broadcast: (
    <path d="M5 12a7 7 0 0 1 2-5m10 0a7 7 0 0 1 0 10M7 17a7 7 0 0 1 0-10m10 0a7 7 0 0 1 2 5M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 0v7" />
  ),
  cpu: <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3M3 15h3m12-6h3m-3 6h3M6 6h12v12H6zM10 10h4v4h-4z" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4-9 5-9-5" />,
  buildings: <path d="M3 21h18M5 21V7l7-4v18M19 21V11l-7-4M9 9h.01M9 13h.01M9 17h.01" />,
};

const FEATURES: Feature[] = [
  {
    tag: "F1 · Digital Twin",
    title: "A living 3D model of the building",
    body: "Orbit or walk through an interactive WebGL twin of ATLAS-01. Every floor is rendered from live telemetry — selectable, color-coded by the human need it serves, and pulsing when something needs attention.",
    color: "#7fe7e0",
    icon: I.cube,
    span: true,
  },
  {
    tag: "F5 · KPIs",
    title: "Building vitals at a glance",
    body: "Aggregated KPIs roll sparse per-floor metrics into a single, always-on ops strip.",
    color: "#ffcf4d",
    icon: I.gauge,
  },
  {
    tag: "F3 · Incident Triage",
    title: "Catch incidents in seconds",
    body: "A live feed surfaces ok / info / warn / crit events the moment they fire, polled continuously so the room is never stale.",
    color: "#ff5d5d",
    icon: I.alert,
  },
  {
    tag: "F4 · Broadcast",
    title: "Reach every resident instantly",
    body: "Compose and send a habitat-wide broadcast; it mirrors straight into the incident feed for a permanent record.",
    color: "#c0a4ff",
    icon: I.broadcast,
  },
  {
    tag: "F11 · Sensors",
    title: "Brick / Haystack-tagged ingestion",
    body: "Tagged sensor points stream in and query out cleanly — your existing building schema, native.",
    color: "#3aa0ff",
    icon: I.cpu,
  },
  {
    tag: "F12 · Simulator",
    title: "A pixel-perfect operating twin",
    body: "A procedural voxel ATLAS-01 — cut-away floors, a working elevator, switchback stairs, rooftop solar and reservoir, and voxel residents going about their day.",
    color: "#5ddc7a",
    icon: I.layers,
    span: true,
  },
  {
    tag: "F7 · Fleet",
    title: "One pane for many buildings",
    body: "Roll every habitat up into a single fleet view and drop into any tower in a click.",
    color: "#ffd9a0",
    icon: I.buildings,
  },
];

// Building floors, ordered top → base (rooftop restoration down to water utilities).
const TOWER: { name: string; metric: string; color: string; fill: number }[] = [
  { name: "Restoration", metric: "Open · calm", color: "#ffd9a0", fill: 70 },
  { name: "Knowledge", metric: "Forum live", color: "#8aa0ff", fill: 84 },
  { name: "Health", metric: "24/7 staffed", color: "#ff8fb1", fill: 88 },
  { name: "Air", metric: "99.4% AQI", color: "#7fe7e0", fill: 99 },
  { name: "Shelter", metric: "312 residents", color: "#c0a4ff", fill: 78 },
  { name: "Food", metric: "1.2 t / week", color: "#5ddc7a", fill: 82 },
  { name: "Energy", metric: "99% autonomy", color: "#ffcf4d", fill: 99 },
  { name: "Water", metric: "96% reuse", color: "#3aa0ff", fill: 96 },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate px-4 pt-16 pb-16 sm:pt-24 lg:px-6 lg:pt-32 lg:pb-20">
        {/* Engineering grid + aurora glow stacked behind the hero. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="grid-backdrop absolute inset-0" />
          <div className="absolute inset-0 flex items-start justify-center">
            <div className="aurora-spin mt-[-32vh] h-[82vh] w-[82vh] rounded-full bg-[conic-gradient(from_0deg,rgba(78,168,255,0.18),rgba(127,231,224,0.16),rgba(93,220,122,0.14),rgba(192,164,255,0.18),rgba(255,143,177,0.14),rgba(78,168,255,0.18))] blur-[90px]" />
          </div>
          {/* Ambient drifting orbs. */}
          <div className="drift absolute left-[12%] top-[28%] h-2 w-2 rounded-full bg-need-air/70 blur-[1px]" />
          <div className="drift absolute right-[16%] top-[20%] h-1.5 w-1.5 rounded-full bg-need-shelter/70 blur-[1px] [animation-delay:-3s]" />
          <div className="drift absolute left-[22%] top-[60%] h-1.5 w-1.5 rounded-full bg-need-food/70 blur-[1px] [animation-delay:-5s]" />
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-signal-ok pulse" />
            Habitat Twin · live on seed data, no DB required
          </span>

          <h1 className="display mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            One building.{" "}
            <span className="gradient-text">Every human need,</span> online.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            ATLAS OS is the operating system for self-sufficient habitats — a
            single tower modeled as one floor per human need, rendered as an
            interactive 3D digital twin with live telemetry, incident triage,
            and resident broadcast.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="sheen group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink-950 shadow-lg shadow-signal-info/10 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              Launch the Console
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="/simulator"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/50 px-6 py-3 text-sm font-bold text-slate-100 backdrop-blur transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              Explore the Simulator
            </Link>
          </div>
        </div>

        {/* Signature: the voxel ATLAS tower, rendered live as colored ASCII. */}
        <div className="mx-auto mt-16 max-w-2xl">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            The signature render
          </p>
          <AsciiSignature />
        </div>

        {/* In-browser console product-shot. Pure CSS/SVG — no screenshots. */}
        <ConsoleMockup />

        {/* Built on — credibility strip. */}
        <div className="mx-auto mt-14 max-w-4xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Built on a modern, open stack
          </p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {BUILT_ON.map((t) => (
              <li
                key={t}
                className="text-sm font-semibold text-slate-400 transition-colors hover:text-slate-200"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Stat strip */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-ink-900/70 p-5 text-center backdrop-blur transition-colors hover:bg-ink-800/70"
            >
              <div className="gradient-text display text-3xl font-extrabold tabular-nums sm:text-4xl">
                {s.value}
              </div>
              <div className="kpi-label mt-2 normal-case tracking-normal">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- The operating loop */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="kpi-label text-signal-info">The operating loop</p>
            <h2 className="display mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Sense, model, triage, <span className="gradient-text">broadcast</span>.
            </h2>
            <p className="mt-4 text-pretty text-slate-300">
              One closed loop runs the whole building — from a single tagged
              sensor point all the way to a message in every resident&apos;s hand.
            </p>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((l) => (
              <li key={l.step} className="panel panel-pad relative flex flex-col">
                <span
                  className="font-mono text-xs font-bold tabular-nums"
                  style={{ color: l.color }}
                >
                  {l.step}
                </span>
                <span
                  aria-hidden
                  className="mt-3 h-1 w-8 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <h3 className="mt-4 text-lg font-bold text-white">{l.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{l.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- Features */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="kpi-label text-signal-info">The platform</p>
            <h2 className="display mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Everything ops needs, in{" "}
              <span className="gradient-text">one console</span>.
            </h2>
            <p className="mt-4 text-pretty text-slate-300">
              From the 3D twin down to a single tagged sensor point — ATLAS OS
              ships the full operating loop for a living building.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article
                key={f.tag}
                style={{ ["--accent" as string]: f.color }}
                className={`feature-card panel panel-pad group flex flex-col transition-transform duration-300 hover:-translate-y-0.5 ${
                  f.span ? "sm:col-span-2" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-600/70 bg-ink-800/70"
                    style={{ color: f.color }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      {f.icon}
                    </svg>
                  </span>
                  <div
                    className="text-xs font-bold uppercase tracking-[0.14em]"
                    style={{ color: f.color }}
                  >
                    {f.tag}
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Need floors */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto grid max-w-5xl items-center gap-10 panel panel-pad sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="kpi-label text-signal-info">The model</p>
            <h2 className="display mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Eight floors.{" "}
              <span className="gradient-text">Eight systems of life.</span>
            </h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-300">
              Each floor is one human need, color-coded across the twin, the KPI
              strip, and every incident — so the whole team reads the building
              the same way, top to bottom.
            </p>
            <Link
              href="/simulator"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-need-air transition-colors hover:text-white"
            >
              Walk the floors in the simulator
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Vertical tower: stacked, color-coded floors with live-style metrics. */}
          <ul className="space-y-1.5">
            {TOWER.map((floor, i) => (
              <li
                key={floor.name}
                className="rise-in group flex items-center gap-3 rounded-lg border border-ink-600/50 bg-ink-900/50 px-3 py-2.5 transition-colors hover:border-ink-600 hover:bg-ink-800/60"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span
                  aria-hidden
                  className="h-7 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: floor.color }}
                />
                <span className="w-24 shrink-0 text-sm font-semibold text-slate-100">
                  {floor.name}
                </span>
                {/* Fill bar */}
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${floor.fill}%`, backgroundColor: floor.color }}
                  />
                </span>
                <span className="hidden w-28 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400 sm:block">
                  {floor.metric}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- Who it's for */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="kpi-label text-signal-info">Who it&apos;s for</p>
            <h2 className="display mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              One platform, <span className="gradient-text">five points of view</span>.
            </h2>
            <p className="mt-4 text-pretty text-slate-300">
              The same self-sufficient habitat reads differently depending on where you
              stand. See ATLAS OS framed for your seat.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <Link
                key={a.slug}
                href={`/for/${a.slug}`}
                style={{ ["--accent" as string]: a.accent, animationDelay: `${i * 60}ms` }}
                className="feature-card panel panel-pad rise-in group flex items-center justify-between gap-3 outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-signal-info"
              >
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: a.accent }}
                  >
                    {a.eyebrow}
                  </div>
                  <div className="mt-1 text-base font-bold text-white">For {a.nav}</div>
                </div>
                <span
                  aria-hidden
                  className="shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: a.accent }}
                >
                  →
                </span>
              </Link>
            ))}
            <Link
              href="/for"
              className="panel panel-pad rise-in flex items-center justify-between gap-3 text-slate-300 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-signal-info"
              style={{ animationDelay: `${AUDIENCES.length * 60}ms` }}
            >
              <span className="text-base font-bold">All solutions</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="px-4 pb-24 lg:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-ink-600/60 bg-ink-900/70 p-10 text-center backdrop-blur sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(600px_300px_at_50%_-20%,rgba(78,168,255,0.18),transparent),radial-gradient(500px_300px_at_50%_120%,rgba(93,220,122,0.12),transparent)]"
          />
          <h2 className="display text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Step inside the <span className="gradient-text">habitat twin</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-slate-300">
            No setup, no database, no waiting. The console renders fully on live
            seed data — open it and start operating.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              Open the Console
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/fleet"
              className="inline-flex w-full items-center justify-center rounded-full border border-ink-600/70 bg-ink-900/50 px-7 py-3 text-sm font-bold text-slate-100 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              See the Fleet
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-5xl text-center text-xs text-slate-500">
          ATLAS OS — Habitat Twin · Building the future. Creating lasting spaces.
        </p>
      </section>
    </main>
  );
}

// In-browser console product-shot — a stylized, CSS/SVG rendering of the live
// console (window chrome, KPI tiles, mini incident feed, and a glowing tower).
// Decorative; hidden from assistive tech via aria-hidden.
function ConsoleMockup() {
  const kpis: { label: string; value: string; color: string }[] = [
    { label: "Autonomy", value: "99%", color: "#ffcf4d" },
    { label: "Water reuse", value: "96%", color: "#3aa0ff" },
    { label: "Air AQI", value: "99.4", color: "#7fe7e0" },
    { label: "Residents", value: "312", color: "#c0a4ff" },
  ];
  const feed: { sev: string; color: string; text: string }[] = [
    { sev: "crit", color: "#ff5d5d", text: "Energy · inverter 3 derate" },
    { sev: "warn", color: "#ffb340", text: "Water · UV lamp nearing EOL" },
    { sev: "info", color: "#4ea8ff", text: "Broadcast · quiet hours at 22:00" },
    { sev: "ok", color: "#3ddc97", text: "Air · scrubber cycle complete" },
  ];

  return (
    <div aria-hidden className="mx-auto mt-16 max-w-4xl">
      <div className="relative overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-900/80 shadow-2xl shadow-black/50 backdrop-blur">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-ink-600/60 bg-ink-800/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal-crit/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-warn/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal-ok/80" />
          <span className="ml-2 font-mono text-[11px] text-slate-400">
            atlas-os / console · ATLAS-01
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink-600/70 bg-ink-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-ok pulse" />
            live
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-5">
          {/* Left: KPI tiles + mini feed */}
          <div className="sm:col-span-3">
            <div className="grid grid-cols-2 gap-2.5">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg border border-ink-600/50 bg-ink-800/50 p-3"
                >
                  <div className="kpi-label">{k.label}</div>
                  <div
                    className="mt-1 font-mono text-2xl font-semibold tabular-nums"
                    style={{ color: k.color }}
                  >
                    {k.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-ink-600/50 bg-ink-800/40 p-3">
              <div className="kpi-label mb-2">Incident feed</div>
              <ul className="space-y-1.5">
                {feed.map((f) => (
                  <li key={f.text} className="flex items-center gap-2 text-[12px] text-slate-300">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                    <span className="truncate">{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: glowing tower */}
          <div className="relative sm:col-span-2">
            <div className="flex h-full flex-col justify-end gap-1.5 rounded-lg border border-ink-600/50 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(78,168,255,0.08),transparent)] p-3">
              {TOWER.map((floor) => (
                <div key={floor.name} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 truncate text-[10px] font-medium text-slate-400">
                    {floor.name}
                  </span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-sm bg-ink-700">
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${floor.fill}%`,
                        backgroundColor: floor.color,
                        boxShadow: `0 0 12px ${floor.color}`,
                      }}
                    />
                  </span>
                </div>
              ))}
              <div className="mt-1 text-center font-mono text-[10px] text-slate-500">
                ATLAS-01 · 8 floors
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
