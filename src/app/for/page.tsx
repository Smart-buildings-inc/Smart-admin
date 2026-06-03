import type { Metadata } from "next";
import Link from "next/link";
import MarketingParallax from "@/components/MarketingParallax";
import { AUDIENCES } from "@/lib/audiences";
import { PARALLAX_SCENES } from "@/lib/marketingParallax";

// Solutions index — the hub for the seven audience marketing pages. Reuses the
// landing primitives; each card owns its audience accent and rises in.

export const metadata: Metadata = {
  title: "Solutions — ATLAS OS for every stakeholder",
  description:
    "ATLAS OS, framed for who you are: developers and owners, operators, residents, investors, and cities. One platform, seven points of view.",
};

export default function SolutionsIndex() {
  return (
    <main id="main" className="relative overflow-hidden px-4 pt-14 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pt-20 lg:px-6 lg:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-backdrop absolute inset-0" />
        <div className="absolute inset-0 flex items-start justify-center">
          <div className="aurora-spin mt-[-34vh] h-[80vh] w-[80vh] rounded-full bg-[conic-gradient(from_0deg,rgba(78,168,255,0.16),rgba(127,231,224,0.14),rgba(93,220,122,0.12),rgba(192,164,255,0.16),rgba(255,143,177,0.12),rgba(78,168,255,0.16))] blur-[90px]" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="kpi-label text-signal-info">Solutions</p>
          <h1 className="display mt-3 text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            One platform, <span className="gradient-text">seven points of view</span>.
          </h1>
          <p className="mt-4 text-pretty text-slate-300">
            The same self-sufficient habitat means something different depending on where
            you stand. Pick your seat.
          </p>
        </div>

        <MarketingParallax
          accent="#4ea8ff"
          compact
          className="mt-10"
          label="ATLAS OS solution layers across habitat, twin, and infrastructure"
          layers={PARALLAX_SCENES.solutions}
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <Link
              key={a.slug}
              href={`/for/${a.slug}`}
              style={{ ["--accent" as string]: a.accent, animationDelay: `${i * 70}ms` }}
              className="feature-card panel panel-pad rise-in group flex flex-col outline-none transition-transform duration-300 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold uppercase tracking-[0.14em]"
                  style={{ color: a.accent }}
                >
                  {a.eyebrow}
                </span>
                <span
                  aria-hidden
                  className="text-slate-500 transition-transform group-hover:translate-x-0.5"
                  style={{ color: a.accent }}
                >
                  →
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">
                {a.headline.lead}
                <span style={{ color: a.accent }}>{a.headline.accent}</span>
                {a.headline.tail}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{a.subhead}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
