"use client";

import type { FloorPresence } from "@/lib/types";

// F-RuView — Presentational badge for per-floor WiFi-CSI presence data.
// Renders a compact card row that fits natively inside FloorPanel's panel-pad
// layout. Privacy-by-design: only WiFi channel-state-information is used;
// no cameras are involved.
export default function PresenceBadge({
  presence,
}: {
  presence: FloorPresence;
}) {
  const { occupied, personCount, confidencePct, breathingBpm, heartBpm, source } =
    presence;

  return (
    <div className="rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-2.5">
      {/* Status row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              occupied ? "bg-signal-ok" : "bg-slate-500"
            }`}
          />
          <span
            className={`text-sm font-semibold ${
              occupied ? "text-signal-ok" : "text-slate-400"
            }`}
          >
            {occupied ? "Occupied" : "Clear"}
          </span>
        </div>

        {/* Source tag */}
        <span className="rounded border border-ink-600/50 bg-ink-700/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">
          {source === "ruview" ? "Live" : "Seed"}
        </span>
      </div>

      {/* Count + confidence */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-mono text-sm font-semibold text-white">
          {personCount} present
        </span>
        <span className="text-xs text-slate-400">{confidencePct}% confidence</span>
      </div>

      {/* Vitals — only when hardware reports them */}
      {(heartBpm !== undefined || breathingBpm !== undefined) && (
        <div className="mt-1.5 text-xs text-slate-400">
          <span className="mr-1 text-signal-ok">♥</span>
          {heartBpm !== undefined && (
            <span>{heartBpm} bpm</span>
          )}
          {heartBpm !== undefined && breathingBpm !== undefined && (
            <span className="mx-1 text-slate-600">·</span>
          )}
          {breathingBpm !== undefined && (
            <span>breathing {breathingBpm} / min</span>
          )}
        </div>
      )}

      {/* Privacy / provenance footer */}
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-ink-600/40 pt-1.5">
        <span className="text-[10px] text-slate-500">WiFi sensing · RuView</span>
        <span className="text-slate-700">·</span>
        <span className="text-[10px] text-slate-500">no cameras</span>
      </div>
    </div>
  );
}
