"use client";

import { useMemo } from "react";
import type { Floor, Incident } from "@/lib/types";
import { severityColor, severityLabel, severityRank, timeAgo } from "@/lib/ui";
import { BellSimple, WarningCircle } from "@phosphor-icons/react";

// F3 — Security & incident feed. Severity-ranked; click an item to focus its floor.
export default function IncidentFeed({
  incidents,
  floors,
  onSelectFloor,
  selectedKey,
}: {
  incidents: Incident[];
  floors: Floor[];
  onSelectFloor: (key: string | null) => void;
  selectedKey: string | null;
}) {
  const floorName = useMemo(() => {
    const m = new Map(floors.map((f) => [f.key, f.name]));
    return (key: string | null) => (key ? m.get(key) ?? key : "Building-wide");
  }, [floors]);

  // Sort by urgency, then recency.
  const sorted = useMemo(
    () =>
      [...incidents].sort((a, b) => {
        const r = severityRank[a.severity] - severityRank[b.severity];
        return r !== 0 ? r : +new Date(b.createdAt) - +new Date(a.createdAt);
      }),
    [incidents],
  );

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <BellSimple
            aria-hidden
            weight="duotone"
            className="h-4 w-4 text-slate-500"
          />
          Incident feed
        </h2>
        <span className="rounded-full bg-ink-700 px-2 py-0.5 text-xs text-slate-300">
          {incidents.length}
        </span>
      </div>
      <ul className="flex-1 divide-y divide-ink-600/40 overflow-y-auto scroll-thin">
        {sorted.map((inc) => {
          const active = inc.floorKey && inc.floorKey === selectedKey;
          return (
            <li key={inc.id}>
              <button
                type="button"
                onClick={() => onSelectFloor(inc.floorKey)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal-info ${
                  active ? "bg-ink-800/80" : ""
                }`}
              >
                <span
                  title={severityLabel[inc.severity]}
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    inc.severity === "crit" ? "pulse" : ""
                  }`}
                  style={{ color: severityColor[inc.severity] }}
                >
                  <WarningCircle
                    aria-hidden
                    weight="duotone"
                    className="h-4 w-4"
                  />
                  <span className="sr-only">{severityLabel[inc.severity]}: </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-100">
                    {inc.title}
                  </span>
                  {inc.detail && (
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {inc.detail}
                    </span>
                  )}
                  <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-500">
                    {floorName(inc.floorKey)} · {timeAgo(inc.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {sorted.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            No incidents. All systems nominal.
          </li>
        )}
      </ul>
    </div>
  );
}
