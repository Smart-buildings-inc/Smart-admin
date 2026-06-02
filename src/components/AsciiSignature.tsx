"use client";

// Framed home for the ASCII signature animation. Lazy-loads the WebGL AsciiTower
// (no SSR) and, until it's up — and for reduced-motion / no-WebGL fallbacks —
// shows a hand-set static ASCII tower so there is always a signature on screen
// (and something for SSR / e2e to assert against).

import dynamic from "next/dynamic";

const AsciiTower = dynamic(() => import("@/components/AsciiTower"), {
  ssr: false,
  loading: () => <AsciiFallback />,
});

// Static ASCII ATLAS tower — the resting state of the signature.
const STATIC_ART = `        /\\
      .:#@#:.
    .:========:.
    | @ @ @ @ |   restoration
    |::::::::::|   health
    |+*+*+*+*+*|   air
    |#%#%#%#%#%|   shelter
    |@@@@@@@@@@|   food
    |==========|   energy
    |::::::::::|   water
   /============\\
  '--- ATLAS ---'`;

function AsciiFallback() {
  return (
    <pre
      aria-hidden
      className="ascii-surface ascii-fallback m-0 select-none whitespace-pre text-center text-[10px] leading-[1.05] sm:text-xs"
    >
      {STATIC_ART}
    </pre>
  );
}

export default function AsciiSignature({
  className = "",
  caption = "ATLAS‑01 · rendered live in ASCII",
  resolution,
}: {
  className?: string;
  caption?: string;
  resolution?: number;
}) {
  return (
    <figure
      className={`ascii-frame relative overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-950/80 ${className}`}
    >
      {/* terminal chrome */}
      <div className="flex items-center gap-2 border-b border-ink-600/50 bg-ink-900/70 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-signal-crit/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-signal-warn/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-signal-ok/80" />
        <span className="ml-2 font-mono text-[11px] text-slate-400">
          atlas-os / render — ascii
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink-600/70 bg-ink-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-ok pulse" />
          live
        </span>
      </div>

      {/* render surface */}
      <div className="ascii-stage relative grid h-[320px] place-items-center sm:h-[420px]">
        <AsciiTower resolution={resolution} />
      </div>

      <figcaption className="border-t border-ink-600/50 bg-ink-900/70 px-4 py-2 text-center font-mono text-[11px] text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}
