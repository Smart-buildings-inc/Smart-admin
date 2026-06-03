"use client";

// F-Advisor: AI Ops Advisor panel.
//
// Displays ranked Recommendations produced by src/lib/advisor.ts.
// Works fully on-device (heuristic engine, no API key required).
// Shows an "AI" badge when any recommendation is source:"ai".

import type { Recommendation, RecCategory } from "@/lib/advisor";

// ---------------------------------------------------------------------------
// Severity dot
// ---------------------------------------------------------------------------

const SEVERITY_DOT_CLASS: Record<Recommendation["severity"], string> = {
  crit: "bg-signal-crit pulse",
  warn: "bg-signal-warn",
  info: "bg-signal-info",
  ok: "bg-signal-ok",
};

const SEVERITY_LABEL: Record<Recommendation["severity"], string> = {
  crit: "Critical",
  warn: "Warning",
  info: "Info",
  ok: "OK",
};

// ---------------------------------------------------------------------------
// Category chip colors (subtle, legible on dark surface)
// ---------------------------------------------------------------------------

const CATEGORY_CHIP_CLASS: Record<RecCategory, string> = {
  energy: "bg-need-energy/15 text-need-energy",
  water: "bg-need-water/15 text-need-water",
  food: "bg-need-food/15 text-need-food",
  air: "bg-need-air/15 text-need-air",
  presence: "bg-need-health/15 text-need-health",
  ops: "bg-ink-600 text-slate-300",
};

const CATEGORY_LABEL: Record<RecCategory, string> = {
  energy: "Energy",
  water: "Water",
  food: "Food",
  air: "Air",
  presence: "Presence",
  ops: "Ops",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdvisorPanel({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const hasAi = recommendations.some((r) => r.source === "ai");

  return (
    <div className="panel flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          {/* Simple sparkle icon via Unicode to avoid new icon imports */}
          <span aria-hidden className="text-signal-info">
            ✦
          </span>
          AI Ops Advisor
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            hasAi
              ? "bg-signal-info/15 text-signal-info"
              : "bg-ink-700 text-slate-400"
          }`}
        >
          {hasAi ? "AI · live" : "heuristic · on-device"}
        </span>
      </div>

      {/* Recommendation list */}
      <ul className="flex-1 divide-y divide-ink-600/40 overflow-y-auto scroll-thin">
        {recommendations.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            All systems nominal.
          </li>
        )}

        {recommendations.map((rec) => (
          <li key={rec.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              {/* Severity dot */}
              <span
                title={SEVERITY_LABEL[rec.severity]}
                aria-label={SEVERITY_LABEL[rec.severity]}
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT_CLASS[rec.severity]}`}
              />

              <div className="min-w-0 flex-1 space-y-1">
                {/* Title + category chip row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    {rec.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_CHIP_CLASS[rec.category]}`}
                  >
                    {CATEGORY_LABEL[rec.category]}
                  </span>
                </div>

                {/* Rationale */}
                <p className="text-xs text-slate-400 leading-snug">
                  {rec.rationale}
                </p>

                {/* Footer: estimated impact + floor name */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {rec.estimatedImpact && (
                    <span className="text-[11px] font-medium text-signal-info">
                      {rec.estimatedImpact}
                    </span>
                  )}
                  {rec.floorKey && (
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      {rec.floorKey}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
