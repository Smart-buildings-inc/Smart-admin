import type { Metadata } from "next";
import Link from "next/link";
import DocumentsExplorer from "@/components/DocumentsExplorer";
import { PAPERS, LEGAL_PAPERS } from "@/lib/documents";

// Public document library — every ATLAS OS paper (business, technical, legal)
// in one in-page PDF reader. The core legal documents also link out to their
// dedicated HTML routes under /legal.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documents — ATLAS OS",
  description:
    "ATLAS OS papers in one place — business plan, pitch deck, requirements, and the full legal & compliance set, readable inline and downloadable as PDF.",
};

export default function DocumentsPage({
  searchParams,
}: {
  searchParams?: { doc?: string };
}) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 lg:px-6 lg:py-12">
      <header className="mb-8">
        <p className="kpi-label mb-2">ATLAS OS</p>
        <h1 className="display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
          Document <span className="important">Library</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Every ATLAS OS paper in one place — read inline or download the PDF. Covers the{" "}
          <span className="text-slate-300">legal &amp; compliance</span> set, the{" "}
          <span className="text-slate-300">business &amp; fundraising</span> documents, and the{" "}
          <span className="text-slate-300">technical requirements</span>. The core legal
          documents also have plain-page versions under{" "}
          <Link
            href="/legal"
            className="font-medium text-signal-info underline-offset-4 hover:underline"
          >
            /legal
          </Link>
          .
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {PAPERS.length} documents · {LEGAL_PAPERS.length} with dedicated legal pages. Generated
          drafts — review with qualified counsel before relying on them.
        </p>
      </header>

      <DocumentsExplorer initialSlug={searchParams?.doc} />
    </main>
  );
}
