import Link from "next/link";
import { getLegalPaper, pdfPath, LEGAL_PAPERS, type LegalSlug } from "@/lib/documents";
import { LEGAL_HTML } from "@/lib/documents.generated";

// Renders one legal document as a first-class HTML page (good for SEO and
// accessibility) from the pre-generated markdown HTML, with a download link to
// the matching PDF. Theme-aware via the .doc-prose rules in globals.css.

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LegalDoc({ route }: { route: LegalSlug }) {
  const paper = getLegalPaper(route);
  if (!paper) return null;

  // The generated HTML leads with an <h1> title — drop it; the masthead below
  // already renders the title, and a single H1 per page is better for a11y/SEO.
  const html = (LEGAL_HTML[route] ?? "").replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, "");
  const pdf = pdfPath(paper.slug);

  return (
    <main className="mx-auto max-w-[820px] px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12 lg:px-6 lg:py-12">
      <nav className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/legal" className="hover:text-signal-info">
          Legal
        </Link>
        <span aria-hidden>/</span>
        <span className="text-slate-400">{paper.title}</span>
      </nav>

      <header className="mb-7 border-b border-ink-600/50 pb-6">
        <p className="kpi-label mb-2">ATLAS OS · Legal</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
            {paper.title}
          </h1>
          <a
            href={pdf}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-signal-info px-3.5 py-2 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            <DownloadIcon className="h-4 w-4" />
            Download PDF
          </a>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{paper.description}</p>
      </header>

      <article className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />

      <footer className="mt-10 border-t border-ink-600/50 pt-6">
        <p className="mb-4 text-xs text-slate-500">
          This is a generated draft for review by qualified counsel — not legal advice.
        </p>
        <div className="flex flex-wrap gap-2">
          {LEGAL_PAPERS.map((p) => (
            <Link
              key={p.slug}
              href={`/legal/${p.legalRoute}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                p.slug === paper.slug
                  ? "border-signal-info/50 bg-ink-800/70 text-white"
                  : "border-ink-600/60 bg-ink-800/50 text-slate-300 hover:bg-ink-700 hover:text-white"
              }`}
            >
              {p.title}
            </Link>
          ))}
          <Link
            href="/documents"
            className="rounded-lg border border-ink-600/60 bg-ink-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-ink-700 hover:text-white"
          >
            All documents →
          </Link>
        </div>
      </footer>
    </main>
  );
}
