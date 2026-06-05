"use client";

import { useEffect, useState } from "react";
import {
  PAPERS,
  papersByGroup,
  pdfPath,
  getPaper,
  type PaperDoc,
} from "@/lib/documents";

// In-page PDF reader for the ATLAS OS document set. A grouped sidebar (collapses
// to a chip rail on mobile) drives a single embedded PDF pane with a toolbar
// (download · open in new tab · prev/next). The active paper is mirrored to the
// URL hash so a specific paper is shareable. Theme-aware via the shared ink-*/
// panel utilities — renders correctly in both dark and light modes.

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M14 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4 10 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
    </svg>
  );
}

const SECTIONS = papersByGroup();

export default function DocumentsExplorer({ initialSlug }: { initialSlug?: string }) {
  const fallback = PAPERS[0]?.slug ?? "";
  const [active, setActive] = useState<string>(
    initialSlug && getPaper(initialSlug) ? initialSlug : fallback,
  );

  // Honour a #slug hash on mount and respond to back/forward navigation.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && getPaper(h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function select(slug: string) {
    setActive(slug);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${slug}`);
    }
  }

  const paper: PaperDoc | undefined = getPaper(active) ?? PAPERS[0];
  const flat = PAPERS;
  const idx = paper ? flat.findIndex((p) => p.slug === paper.slug) : 0;
  const prev = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined;
  const url = paper ? pdfPath(paper.slug) : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:block">
        <nav aria-label="Documents" className="panel panel-pad scroll-thin max-h-[78vh] overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.group} className="mb-5 last:mb-0">
              <p className="kpi-label mb-2">{section.label}</p>
              <ul className="space-y-1">
                {section.papers.map((p) => {
                  const on = p.slug === active;
                  return (
                    <li key={p.slug}>
                      <button
                        type="button"
                        onClick={() => select(p.slug)}
                        aria-current={on ? "true" : undefined}
                        className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          on
                            ? "bg-ink-800/70 text-white ring-1 ring-signal-info/50"
                            : "text-slate-300 hover:bg-ink-800/50 hover:text-white"
                        }`}
                      >
                        <FileIcon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-signal-info" : "text-slate-500"}`} />
                        <span className="min-w-0">
                          <span className="block font-medium leading-snug">{p.title}</span>
                          {p.internal ? (
                            <span className="mt-0.5 inline-block rounded bg-signal-warn/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-warn">
                              Internal
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile selector */}
      <div className="lg:hidden">
        <label htmlFor="doc-select" className="kpi-label mb-1.5 block">
          Select a document
        </label>
        <select
          id="doc-select"
          value={active}
          onChange={(e) => select(e.target.value)}
          className="w-full rounded-xl border border-ink-600/60 bg-ink-900/70 px-3 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
        >
          {SECTIONS.map((section) => (
            <optgroup key={section.group} label={section.label}>
              {section.papers.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                  {p.internal ? " · internal" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Viewer pane */}
      <section className="panel flex min-w-0 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-600/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-white">{paper?.title}</h2>
              {paper?.internal ? (
                <span className="rounded bg-signal-warn/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-warn">
                  Internal
                </span>
              ) : null}
            </div>
            {paper?.description ? (
              <p className="truncate text-xs text-slate-400">{paper.description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600/60 bg-ink-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-ink-700 hover:text-white"
            >
              <ExternalIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open</span>
            </a>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-info px-3 py-1.5 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>

        {/* Embedded PDF */}
        <div className="relative h-[68vh] min-h-[420px] w-full bg-ink-950/40">
          {paper ? (
            <object key={url} data={`${url}#view=FitH`} type="application/pdf" className="h-full w-full">
              <iframe src={url} title={`${paper.title} (PDF)`} className="h-full w-full border-0" />
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-slate-300">
                  Your browser can&apos;t display this PDF inline.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-signal-info px-4 py-2 text-sm font-semibold text-ink-950"
                >
                  <ExternalIcon className="h-4 w-4" />
                  Open {paper.title}
                </a>
              </div>
            </object>
          ) : null}
        </div>

        {/* Prev / next footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink-600/50 px-4 py-3">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && select(prev.slug)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors enabled:hover:text-white disabled:opacity-40"
          >
            <span aria-hidden>←</span>
            <span className="max-w-[40vw] truncate sm:max-w-[16rem]">{prev ? prev.title : "Start"}</span>
          </button>
          <span className="font-mono text-[11px] text-slate-500">
            {idx + 1} / {flat.length}
          </span>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && select(next.slug)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors enabled:hover:text-white disabled:opacity-40"
          >
            <span className="max-w-[40vw] truncate sm:max-w-[16rem]">{next ? next.title : "End"}</span>
            <span aria-hidden>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
