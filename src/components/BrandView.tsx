"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

import {
  BRAND,
  COLOR_GROUPS,
  FONT_STACK,
  LOGO_ASSETS,
  MONO_STACK,
  TYPE_RAMP,
  VOICE,
} from "@/lib/brand";

// Brand identity / living style-guide page body. Renders every brand token from
// `@/lib/brand` (the single source of truth shared with the downloadable kit at
// `/api/brand/zip`): hero, logo/mark, color swatches (click-to-copy), the type
// ramp, voice & tone, and a closing download CTA. Rendered inside the server
// `/brand` page's <main>, so this component emits sections only — no NavBar and
// no max-width wrapper (the parent supplies those).

/** Tracks which key was last copied so each control shows its own feedback. */
function useCopy(): { copied: string | null; copy: (key: string, text: string) => void } {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((key: string, text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => {
        // Only clear if this key is still the active one.
        setCopied((current) => (current === key ? null : current));
      }, 1200);
    });
  }, []);

  return { copied, copy };
}

const PILL =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink-950 shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info";

export default function BrandView() {
  const { copied, copy } = useCopy();

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* 1 — Hero ------------------------------------------------------------ */}
      <section className="space-y-5">
        <Image
          src="/logo.svg"
          alt="ATLAS OS mark"
          width={96}
          height={96}
          priority
          unoptimized
          className="h-24 w-24 rounded-2xl"
        />
        <div className="kpi-label">Brand</div>
        <h1 className="display text-4xl leading-tight text-white sm:text-6xl">
          ATLAS <span className="important">OS</span>
          <span className="ml-3 align-middle text-2xl font-semibold text-slate-500 sm:text-3xl">
            {BRAND.short}
          </span>
        </h1>
        <p className="important text-xl sm:text-2xl">{BRAND.tagline}</p>
        <p className="max-w-2xl text-base leading-relaxed text-slate-300">
          {BRAND.description}
        </p>
        <div className="pt-1">
          <a
            href="/api/brand/zip"
            download
            data-testid="brand-download-zip"
            className={PILL}
          >
            <span aria-hidden>↓</span> Download brand kit (.zip)
          </a>
        </div>
      </section>

      {/* 2 — Logo / mark ---------------------------------------------------- */}
      <section className="space-y-5">
        <h2 className="display text-2xl text-white sm:text-3xl">Logo &amp; mark</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="panel panel-pad flex flex-col items-center justify-center gap-6 bg-ink-950/60">
            <div className="grid h-44 w-full place-items-center rounded-2xl border border-ink-600/50 bg-ink-950">
              <Image
                src="/logo.svg"
                alt="ATLAS OS full mark"
                width={128}
                height={128}
                unoptimized
                className="h-32 w-32"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-xl border border-ink-600/50 bg-ink-900">
                <Image
                  src="/icon.svg"
                  alt="ATLAS OS compact icon"
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  fetch("/icon.svg")
                    .then((r) => r.text())
                    .then((svg) => copy("icon-svg", svg))
                }
                className={`rounded-full border border-ink-600/70 bg-ink-800/60 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-ink-700 hover:text-white ${FOCUS}`}
              >
                {copied === "icon-svg" ? "Copied" : "Copy SVG"}
              </button>
            </div>
          </div>
          <div className="panel panel-pad space-y-4">
            <p className="text-base leading-relaxed text-slate-300">
              {BRAND.markStory}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LOGO_ASSETS.map((asset) => (
                <a
                  key={asset.path}
                  href={asset.path}
                  download
                  className={`block rounded-xl border border-ink-600/50 bg-ink-800/50 px-4 py-3 transition-transform hover:-translate-y-0.5 hover:bg-ink-700/50 ${FOCUS}`}
                >
                  <div className="text-sm font-semibold text-white">
                    {asset.label}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{asset.note}</div>
                  <div className="mt-1 font-mono text-[11px] text-signal-info">
                    ↓ {asset.path}
                  </div>
                </a>
              ))}
            </div>
            <p className="rounded-xl border border-ink-600/50 bg-ink-800/40 px-4 py-3 text-xs leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-200">Clear space &amp; don&apos;ts:</span>{" "}
              keep clear space equal to the cube&apos;s top face around the mark.
              Never stretch, rotate, or recolor the AOS cube, and never place dark
              text on Ink surfaces.
            </p>
          </div>
        </div>
      </section>

      {/* 3 — Color ---------------------------------------------------------- */}
      <section className="space-y-8">
        <h2 className="display text-2xl text-white sm:text-3xl">Color</h2>
        {COLOR_GROUPS.map((group) => (
          <div key={group.id} className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{group.title}</h3>
              <p className="max-w-2xl text-sm text-slate-400">{group.blurb}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.colors.map((color) => {
                const key = `${color.name}-${color.hex}`;
                const isCopied = copied === key;
                // Swatch contrast text is keyed to the (fixed) brand color, so
                // use literal hex utilities that the light-theme overrides won't flip.
                const onText =
                  color.on === "light" ? "text-[#0b121a]" : "text-[#ffffff]";
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid="color-swatch"
                    onClick={() => copy(key, color.hex)}
                    aria-label={`Copy ${color.name} ${color.hex.toUpperCase()}`}
                    className={`group panel overflow-hidden p-0 text-left transition-transform hover:-translate-y-0.5 ${FOCUS}`}
                  >
                    <div
                      className={`relative flex h-20 items-end justify-between px-3 py-2 ${onText}`}
                      style={{ backgroundColor: color.hex }}
                    >
                      <span className="font-mono text-xs font-semibold">
                        {color.name}
                      </span>
                      <span className="text-[11px] font-semibold opacity-80">
                        {isCopied ? "Copied" : "Copy"}
                      </span>
                    </div>
                    <div className="space-y-0.5 px-3 py-2">
                      <div className="font-mono text-xs uppercase text-slate-200">
                        {color.hex.toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-400">{color.use}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* 4 — Typography ----------------------------------------------------- */}
      <section className="space-y-6">
        <h2 className="display text-2xl text-white sm:text-3xl">Typography</h2>
        <div className="space-y-3">
          {TYPE_RAMP.map((item) => (
            <div
              key={item.role}
              className="panel panel-pad flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="kpi-label">{item.role}</div>
                <div
                  className={`${item.className ?? "text-xl text-white"} truncate`}
                >
                  {item.sample}
                </div>
              </div>
              <div className="shrink-0 font-mono text-xs text-slate-400">
                {item.spec}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: "font-stack", label: "Font stack", value: FONT_STACK },
              { key: "mono-stack", label: "Mono stack", value: MONO_STACK },
            ] as const
          ).map((block) => (
            <button
              key={block.key}
              type="button"
              onClick={() => copy(block.key, block.value)}
              className={`panel panel-pad text-left transition-transform hover:-translate-y-0.5 ${FOCUS}`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="kpi-label">{block.label}</span>
                <span className="text-[11px] font-semibold text-signal-info">
                  {copied === block.key ? "Copied" : "Copy"}
                </span>
              </div>
              <code className="block break-words font-mono text-xs leading-relaxed text-slate-200">
                {block.value}
              </code>
            </button>
          ))}
        </div>
      </section>

      {/* 5 — Voice & tone --------------------------------------------------- */}
      <section className="space-y-6">
        <h2 className="display text-2xl text-white sm:text-3xl">Voice &amp; tone</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {VOICE.pillars.map((pillar) => (
            <div key={pillar.title} className="panel panel-pad space-y-1.5">
              <div className="text-sm font-semibold text-white">
                {pillar.title}
              </div>
              <p className="text-sm leading-relaxed text-slate-400">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel panel-pad space-y-2.5">
            <div className="text-sm font-semibold text-signal-ok">Do</div>
            <ul className="space-y-2">
              {VOICE.dos.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                  <span aria-hidden className="mt-0.5 font-bold text-signal-ok">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel panel-pad space-y-2.5">
            <div className="text-sm font-semibold text-signal-crit">Don&apos;t</div>
            <ul className="space-y-2">
              {VOICE.donts.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                  <span aria-hidden className="mt-0.5 font-bold text-signal-crit">
                    ✕
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6 — Footer CTA ----------------------------------------------------- */}
      <section className="panel panel-pad flex flex-col items-start gap-4 bg-ink-900/50 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          Everything on this page is exported in the kit — tokens, logos, and
          guidelines.
        </p>
        <a href="/api/brand/zip" download className={`${PILL} shrink-0`}>
          <span aria-hidden>↓</span> Download brand kit (.zip)
        </a>
      </section>
    </div>
  );
}
