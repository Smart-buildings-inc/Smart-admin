import Link from "next/link";
import { LEGAL_PAPERS } from "@/lib/documents";

// Shared site footer rendered beneath every page. Surfaces the document library
// and the legal documents so they're reachable from anywhere, and carries the
// operating-independence line used across the console views. Extra bottom
// padding clears the fixed MobileTabBar on phones.

const PRODUCT_LINKS = [
  { href: "/", label: "Console" },
  { href: "/simulator", label: "Simulator" },
  { href: "/fleet", label: "Fleet" },
  { href: "/for", label: "Solutions" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-ink-600/40 bg-ink-950/60 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 pt-10 sm:grid-cols-4 lg:px-6">
        <div className="col-span-2 sm:col-span-1">
          <p className="display text-sm font-extrabold tracking-tight text-white">ATLAS OS</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            The Habitat Twin — building operations for self-sufficient ATLAS habitats.
          </p>
        </div>

        <div>
          <p className="kpi-label mb-3">Product</p>
          <ul className="space-y-2 text-sm">
            {PRODUCT_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-slate-400 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="kpi-label mb-3">Documents</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/documents" className="text-slate-400 transition-colors hover:text-white">
                Document library
              </Link>
            </li>
            <li>
              <Link href="/legal" className="text-slate-400 transition-colors hover:text-white">
                Legal &amp; compliance
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="kpi-label mb-3">Legal</p>
          <ul className="space-y-2 text-sm">
            {LEGAL_PAPERS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/legal/${p.legalRoute}`}
                  className="text-slate-400 transition-colors hover:text-white"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-2 border-t border-ink-600/30 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <p>© {year} Smart Buildings Inc. · ATLAS Habitat Initiative.</p>
        <p className="text-slate-600">
          ATLAS is operationally independent, not legally exempt · AI optimizes, never overrides safety.
        </p>
      </div>
    </footer>
  );
}
