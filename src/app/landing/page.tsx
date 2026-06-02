import Link from "next/link";
import type { Metadata } from "next";

// Marketing / overview landing page ("Overview" in the nav). A unicorn-SaaS
// style presentation of ATLAS OS: animated gradient hero, stat strip, feature
// bento, per-need floor rail, and a closing CTA. Pure presentation — renders on
// static content, no data layer needed. Reuses the shared palette (ink/signal/
// need) and the .gradient-text / .aurora-spin primitives in globals.css.

export const metadata: Metadata = {
  title: "ATLAS OS — One building. Every human need, online.",
  description:
    "ATLAS OS is the operating system for self-sufficient habitats: a live 3D digital twin, per-floor telemetry, incident triage, and resident broadcast — for a single tower or a whole fleet.",
};

const STATS: { value: string; label: string }[] = [
  { value: "7", label: "Human needs, one per floor" },
  { value: "99.98%", label: "Habitat uptime, twin-monitored" },
  { value: "<15s", label: "Incident-to-feed latency" },
  { value: "1→∞", label: "From one tower to a fleet" },
];

type Feature = {
  tag: string;
  title: string;
  body: string;
  accent: string; // tailwind text color class
  span?: boolean; // wide (2-col) bento cell
};

const FEATURES: Feature[] = [
  {
    tag: "F1 · Digital Twin",
    title: "A living 3D model of the building",
    body: "Orbit or walk through an interactive WebGL twin of ATLAS-01. Every floor is rendered from live telemetry — selectable, color-coded by the human need it serves, and pulsing when something needs attention.",
    accent: "text-need-air",
    span: true,
  },
  {
    tag: "F5 · KPIs",
    title: "Building vitals at a glance",
    body: "Aggregated KPIs roll sparse per-floor metrics into a single, always-on ops strip.",
    accent: "text-need-energy",
  },
  {
    tag: "F3 · Incident Triage",
    title: "Catch incidents in seconds",
    body: "A live feed surfaces ok / info / warn / crit events the moment they fire, polled continuously so the room is never stale.",
    accent: "text-signal-crit",
  },
  {
    tag: "F4 · Broadcast",
    title: "Reach every resident instantly",
    body: "Compose and send a habitat-wide broadcast; it mirrors straight into the incident feed for a permanent record.",
    accent: "text-need-shelter",
  },
  {
    tag: "F11 · Sensors",
    title: "Brick / Haystack-tagged ingestion",
    body: "Tagged sensor points stream in and query out cleanly — your existing building schema, native.",
    accent: "text-need-water",
  },
  {
    tag: "F12 · Simulator",
    title: "A pixel-perfect operating twin",
    body: "A procedural voxel ATLAS-01 — cut-away floors, a working elevator, switchback stairs, rooftop solar and reservoir, and voxel residents going about their day.",
    accent: "text-need-food",
    span: true,
  },
  {
    tag: "F7 · Fleet",
    title: "One pane for many buildings",
    body: "Roll every habitat up into a single fleet view and drop into any tower in a click.",
    accent: "text-need-restoration",
  },
];

const NEEDS: { name: string; color: string }[] = [
  { name: "Water", color: "bg-need-water" },
  { name: "Energy", color: "bg-need-energy" },
  { name: "Food", color: "bg-need-food" },
  { name: "Shelter", color: "bg-need-shelter" },
  { name: "Air", color: "bg-need-air" },
  { name: "Health", color: "bg-need-health" },
  { name: "Restoration", color: "bg-need-restoration" },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative isolate px-4 pt-16 pb-20 sm:pt-24 lg:px-6 lg:pt-32 lg:pb-28">
        {/* Aurora glow behind the hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 flex items-start justify-center overflow-hidden"
        >
          <div className="aurora-spin mt-[-30vh] h-[80vh] w-[80vh] rounded-full bg-[conic-gradient(from_0deg,rgba(78,168,255,0.18),rgba(127,231,224,0.16),rgba(93,220,122,0.14),rgba(192,164,255,0.18),rgba(255,143,177,0.14),rgba(78,168,255,0.18))] blur-[80px]" />
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
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink-950 shadow-lg shadow-signal-info/10 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
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

        {/* Stat strip */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-ink-900/70 p-5 text-center backdrop-blur">
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
                className={`panel panel-pad group relative flex flex-col transition-colors hover:border-ink-600 ${
                  f.span ? "sm:col-span-2" : ""
                }`}
              >
                <div className={`text-xs font-bold uppercase tracking-[0.14em] ${f.accent}`}>
                  {f.tag}
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">{f.title}</h3>
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
        <div className="mx-auto max-w-5xl panel panel-pad sm:p-10">
          <div className="text-center">
            <h2 className="display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Seven floors. <span className="gradient-text">Seven systems of life.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm text-slate-300">
              Each floor is one human need, color-coded across the twin, the KPI
              strip, and every incident — so the whole team reads the building
              the same way.
            </p>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
            {NEEDS.map((n) => (
              <li
                key={n.name}
                className="inline-flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/60 px-4 py-2 text-sm font-semibold text-slate-100"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${n.color}`} />
                {n.name}
              </li>
            ))}
          </ul>
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
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
