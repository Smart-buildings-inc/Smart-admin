import Link from "next/link";
import type { Audience } from "@/lib/audiences";
import { AUDIENCES } from "@/lib/audiences";
import AsciiSignature from "@/components/AsciiSignature";
import Reveal from "@/components/Reveal";

// Shared template for the seven /for/<audience> marketing pages. Pure
// presentation — server-rendered on static content — reusing the landing
// primitives (.gradient-text / .aurora-spin / .grid-backdrop / .feature-card /
// .sheen / .rise-in / .beam) so every audience page is choreographed the same
// way, only the accent and the words change. The accent is injected as the
// `--accent` custom property and as inline color so each page owns one of the
// seven need-palette colors. All motion honors prefers-reduced-motion.

export default function MarketingPage({ audience }: { audience: Audience }) {
  const a = audience;

  return (
    <main
      style={{ ["--accent" as string]: a.accent }}
      className="relative overflow-hidden pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0"
    >
      {/* --------------------------------------------------------------- Hero */}
      <section className="relative isolate px-4 pt-14 pb-16 sm:pt-20 lg:px-6 lg:pt-28 lg:pb-20">
        {/* Accent-tinted aurora + engineering grid + drifting orbs. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="grid-backdrop absolute inset-0" />
          <div className="absolute inset-0 flex items-start justify-center">
            <div
              className="aurora-spin mt-[-34vh] h-[80vh] w-[80vh] rounded-full blur-[90px]"
              style={{
                background: `conic-gradient(from 0deg, ${a.accent}33, transparent 35%, ${a.accent}22 60%, transparent 85%, ${a.accent}33)`,
              }}
            />
          </div>
          <div
            className="drift absolute left-[14%] top-[26%] h-2 w-2 rounded-full blur-[1px]"
            style={{ backgroundColor: a.accent }}
          />
          <div
            className="drift absolute right-[16%] top-[20%] h-1.5 w-1.5 rounded-full blur-[1px] [animation-delay:-3s]"
            style={{ backgroundColor: a.accent }}
          />
          <div
            className="drift absolute left-[24%] top-[58%] h-1.5 w-1.5 rounded-full blur-[1px] [animation-delay:-5s]"
            style={{ backgroundColor: a.accent }}
          />
        </div>

        {/* Audience switcher. */}
        <AudienceSwitcher current={a.slug} />

        <div className="mx-auto mt-8 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/60 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 backdrop-blur">
            <span className="h-2 w-2 rounded-full pulse" style={{ backgroundColor: a.accent }} />
            {a.eyebrow}
          </span>

          <h1 className="display mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {a.headline.lead}
            <span className="relative inline-block">
              <span style={{ color: a.accent }}>{a.headline.accent}</span>
              <span
                aria-hidden
                className="beam absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
                style={{ backgroundColor: a.accent }}
              />
            </span>
            {a.headline.tail}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            {a.subhead}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="sheen group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink-950 shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
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

        {/* Stat strip — staggered rise-in. */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-600/40 sm:grid-cols-3">
          {a.stats.map((s, i) => (
            <div
              key={s.label}
              className="rise-in bg-ink-900/70 p-5 text-center backdrop-blur transition-colors hover:bg-ink-800/70"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="display text-3xl font-extrabold tabular-nums sm:text-4xl"
                style={{ color: a.accent }}
              >
                {s.value}
              </div>
              <div className="kpi-label mt-2 normal-case tracking-normal">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Values */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="kpi-label" style={{ color: a.accent }}>
              Why {a.nav.toLowerCase()} choose ATLAS
            </p>
            <h2 className="display mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              What you actually get.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {a.values.map((v, i) => (
              <Reveal
                key={v.tag}
                delay={i * 80}
                className="feature-card panel panel-pad group flex flex-col transition-transform duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-600/70 bg-ink-800/70"
                    style={{ color: a.accent }}
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
                      {v.icon}
                    </svg>
                  </span>
                  <div
                    className="text-xs font-bold uppercase tracking-[0.14em]"
                    style={{ color: a.accent }}
                  >
                    {v.tag}
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Steps */}
      <section className="px-4 pb-20 lg:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="kpi-label" style={{ color: a.accent }}>
            {a.steps.kicker}
          </p>
          <Reveal>
            <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {a.steps.items.map((l) => (
                <li key={l.step} className="panel panel-pad relative flex flex-col">
                <span className="font-mono text-xs font-bold tabular-nums" style={{ color: a.accent }}>
                  {l.step}
                </span>
                <span
                  aria-hidden
                  className="mt-3 h-1 w-8 rounded-full"
                  style={{ backgroundColor: a.accent }}
                />
                <h3 className="mt-4 text-lg font-bold text-white">{l.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{l.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- ASCII signature */}
      <section className="px-4 pb-20 lg:px-6">
        <Reveal className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            The signature render
          </p>
          <AsciiSignature caption={a.signatureCaption} />
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- Quote */}
      <section className="px-4 pb-20 lg:px-6">
        <Reveal>
        <figure className="mx-auto max-w-3xl panel panel-pad text-center sm:p-10">
          <blockquote className="text-balance text-xl font-bold leading-snug text-white sm:text-2xl">
            “{a.quote.text}”
          </blockquote>
          <figcaption className="mt-4 text-sm text-slate-400">
            <span className="font-semibold text-slate-200">{a.quote.who}</span> · {a.quote.role}
          </figcaption>
        </figure>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="px-4 pb-24 lg:px-6">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-ink-600/60 bg-ink-900/70 p-10 text-center backdrop-blur sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-60"
            style={{
              background: `radial-gradient(600px 300px at 50% -20%, ${a.accent}2e, transparent), radial-gradient(500px 300px at 50% 120%, ${a.accent}1f, transparent)`,
            }}
          />
          <h2 className="display text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {a.cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-slate-300">{a.cta.body}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="sheen inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              Open the Console
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/for"
              className="inline-flex w-full items-center justify-center rounded-full border border-ink-600/70 bg-ink-900/50 px-7 py-3 text-sm font-bold text-slate-100 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info sm:w-auto"
            >
              All solutions
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

// Pill row linking across the seven audiences, current one highlighted.
function AudienceSwitcher({ current }: { current: string }) {
  return (
    <nav
      aria-label="Audiences"
      className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2"
    >
      <Link
        href="/for"
        className="rounded-full border border-ink-600/70 bg-ink-900/50 px-3 py-1 text-xs font-semibold text-slate-400 transition-colors hover:text-white"
      >
        Solutions
      </Link>
      {AUDIENCES.map((o) => {
        const active = o.slug === current;
        return (
          <Link
            key={o.slug}
            href={`/for/${o.slug}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "border-transparent text-ink-950"
                : "border-ink-600/70 bg-ink-900/50 text-slate-300 hover:text-white"
            }`}
            style={active ? { backgroundColor: o.accent } : undefined}
          >
            {o.nav}
          </Link>
        );
      })}
    </nav>
  );
}
