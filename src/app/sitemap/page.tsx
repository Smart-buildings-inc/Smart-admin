import type { Metadata } from "next";
import Link from "next/link";
import { SITE_ROUTES, getBaseUrl } from "@/lib/routes";

// Human-readable site map. Mirrors the same SITE_ROUTES registry that powers
// sitemap.xml / robots.txt, so it never drifts out of sync.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Site Map — ATLAS OS",
  description: "An index of every section of the ATLAS OS habitat operations console.",
};

export default function SiteMapPage() {
  const baseUrl = getBaseUrl();

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 lg:px-6 lg:py-12">
      <header className="mb-8">
        <p className="kpi-label mb-2">ATLAS OS</p>
        <h1 className="display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
          Site <span className="important">Map</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Every section of the habitat operations console. This index stays in sync with the
          machine-readable{" "}
          <a
            href="/sitemap.xml"
            className="font-medium text-signal-info underline-offset-4 hover:underline"
          >
            sitemap.xml
          </a>{" "}
          and{" "}
          <a
            href="/robots.txt"
            className="font-medium text-signal-info underline-offset-4 hover:underline"
          >
            robots.txt
          </a>
          , which resolve to{" "}
          <span className="font-mono text-slate-300">{baseUrl}</span> automatically.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SITE_ROUTES.map((route) => (
          <li key={route.path}>
            <Link
              href={route.path}
              className="panel panel-pad group flex h-full flex-col gap-1.5 outline-none transition-colors hover:border-signal-info/50 focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-white">{route.title}</span>
                <span
                  aria-hidden
                  className="text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-signal-info"
                >
                  →
                </span>
              </div>
              <span className="font-mono text-xs text-slate-500">{route.path}</span>
              <span className="text-sm leading-relaxed text-slate-400">{route.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
