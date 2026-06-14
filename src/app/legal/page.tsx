import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_PAPERS, pdfPath } from "@/lib/documents";

// Legal hub — links to each first-class legal document page plus its PDF, and
// points to the full document library for the rest of the paper set.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal — ATLAS OS",
  description:
    "ATLAS OS legal documents — Privacy Policy, Terms of Service, and Data Processing Addendum. Readable inline and downloadable as PDF.",
};

export default function LegalIndexPage() {
  return (
    <main className="mx-auto max-w-[900px] px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 lg:px-6 lg:py-12">
      <header className="mb-8">
        <p className="kpi-label mb-2">ATLAS OS</p>
        <h1 className="display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
          Legal &amp; <span className="important">Compliance</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          The documents that govern how ATLAS OS is used and how data is handled. Each is available
          as a plain web page and as a downloadable PDF. For the complete paper set — business,
          technical, and the rest of the compliance docs — see the{" "}
          <Link
            href="/documents"
            className="font-medium text-signal-info underline-offset-4 hover:underline"
          >
            document library
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Generated drafts — review with qualified counsel before publication.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LEGAL_PAPERS.map((p) => (
          <li key={p.slug} className="panel panel-pad flex h-full flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/legal/${p.legalRoute}`}
                className="text-base font-semibold text-white outline-none hover:text-signal-info focus-visible:underline"
              >
                {p.title}
              </Link>
              <span aria-hidden className="text-slate-500">
                →
              </span>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-slate-400">{p.description}</p>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <Link
                href={`/legal/${p.legalRoute}`}
                className="font-medium text-signal-info underline-offset-4 hover:underline"
              >
                Read page
              </Link>
              <a
                href={pdfPath(p.slug)}
                download
                className="font-medium text-slate-400 underline-offset-4 hover:text-white hover:underline"
              >
                Download PDF
              </a>
            </div>
          </li>
        ))}
      </ul>

      {/* Pre-consultation briefing (cross-disciplinary council deliverable) */}
      <div className="mt-8 panel p-4">
        <p className="text-sm signal-ok font-medium">Building Permit Pre-Consultation</p>
        <p className="text-sm ink-60 mt-1">
          View the{" "}
          <a href="/docs/PRE_CONSULTATION_BRIEFING.md" className="signal-ok underline">
            ATLAS-01 Pre-Consultation Briefing
          </a>{" "}
          prepared for CBO and MECP meetings.
        </p>
      </div>
    </main>
  );
}
