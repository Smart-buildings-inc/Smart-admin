import type { Floor, FloorMetrics, FloorPresence, Incident } from "@/lib/types";
import {
  needColor,
  occupancyGroupLabel,
  severityColor,
  severityLabel,
  timeAgo,
  useScopeLabel,
} from "@/lib/ui";
import PresenceBadge from "@/components/PresenceBadge";

// Maps each metric key to a human label + formatter. Only present keys render.
const METRIC_META: Record<
  keyof FloorMetrics,
  { label: string; fmt: (v: number) => string }
> = {
  energyKw: { label: "Generation", fmt: (v) => `${v} kW` },
  loadKw: { label: "Load", fmt: (v) => `${v} kW` },
  batteryPct: { label: "Battery", fmt: (v) => `${v}%` },
  waterLph: { label: "Water flow", fmt: (v) => `${v} L/h` },
  waterReusePct: { label: "Non-potable reuse", fmt: (v) => `${v}%` },
  foodKgDay: { label: "Food (amenity)", fmt: (v) => `${v} kg/day` },
  occupancy: { label: "Occupancy", fmt: (v) => `${v} present` },
  tempC: { label: "Temperature", fmt: (v) => `${v} °C` },
  humidityPct: { label: "Humidity", fmt: (v) => `${v}%` },
  co2Ppm: { label: "CO₂", fmt: (v) => `${v} ppm` },
  pm25: { label: "PM2.5", fmt: (v) => `${v} µg/m³` },
};

const METRIC_ORDER = Object.keys(METRIC_META) as (keyof FloorMetrics)[];

// F2 — Per-floor telemetry panel.
export default function FloorPanel({
  floor,
  incidents,
  presence,
}: {
  floor: Floor | null;
  incidents: Incident[];
  presence?: FloorPresence;
}) {
  if (!floor) {
    return (
      <div className="panel panel-pad h-full">
        <div className="kpi-label mb-1">Floor telemetry</div>
        <p className="text-sm text-slate-400">
          Select a floor on the twin to inspect its live metrics.
        </p>
      </div>
    );
  }

  const color = needColor[floor.need];
  const floorIncidents = incidents.filter((i) => i.floorKey === floor.key);
  const metricEntries = METRIC_ORDER.filter(
    (k) => floor.metrics[k] !== undefined,
  );

  return (
    <div className="panel panel-pad h-full overflow-y-auto scroll-thin">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h2 className="text-base font-semibold text-white">{floor.name}</h2>
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {floor.category} · Level {floor.level}
          </div>
          {/* Classification chips: occupancy group + use scope (optional) */}
          {(floor.occupancyGroup ?? floor.useScope) ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {floor.occupancyGroup ? (
                <span className="inline-block rounded border border-ink-600/60 bg-ink-700/60 px-1.5 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                  {occupancyGroupLabel[floor.occupancyGroup]}
                </span>
              ) : null}
              {floor.useScope ? (
                <span className="inline-block rounded border border-ink-600/60 bg-ink-700/60 px-1.5 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                  {useScopeLabel[floor.useScope]}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {floor.residents > 0 && (
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-white">
              {floor.residents}
            </div>
            <div className="kpi-label">residents</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metricEntries.map((key) => {
          const meta = METRIC_META[key];
          const value = floor.metrics[key] as number;
          return (
            <div
              key={key}
              className="rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-2"
            >
              <div className="kpi-label">{meta.label}</div>
              <div className="font-mono text-sm font-semibold text-white">
                {meta.fmt(value)}
              </div>
            </div>
          );
        })}
        {metricEntries.length === 0 && (
          <p className="col-span-2 text-sm text-slate-400">
            No telemetry reported for this floor.
          </p>
        )}
      </div>

      {/* F-RuView: Presence subsection — fully conditional, renders only when data available */}
      {presence !== undefined && (
        <div className="mt-3">
          <div className="annotation mb-1.5 text-xs uppercase tracking-wide text-slate-500">
            Presence · WiFi sensing
          </div>
          <PresenceBadge presence={presence} />
        </div>
      )}

      {/* Dwellings / beds summary for residential floors (optional) */}
      {(floor.dwellings != null || floor.beds != null) ? (
        <div className="mt-3 text-xs text-slate-400">
          {[
            floor.dwellings != null ? `${floor.dwellings} dwellings` : null,
            floor.beds != null ? `${floor.beds} beds` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      ) : null}

      {/* Regulatory / compliance notes (optional) */}
      {floor.regulatoryNotes && floor.regulatoryNotes.length > 0 ? (
        <div className="mt-3">
          <div className="annotation mb-1 text-xs uppercase tracking-wide text-slate-500">
            Compliance
          </div>
          <ul className="space-y-0.5">
            {floor.regulatoryNotes.map((note, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-slate-400"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {floorIncidents.length > 0 && (
        <div className="mt-4">
          <div className="kpi-label mb-1.5">
            Active on this floor · {floorIncidents.length}
          </div>
          <ul className="space-y-1.5">
            {floorIncidents.map((inc) => (
              <li
                key={inc.id}
                className="flex items-start gap-2 rounded-md border border-ink-600/50 bg-ink-800/40 px-2.5 py-1.5 text-xs"
              >
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: severityColor[inc.severity] }}
                  title={severityLabel[inc.severity]}
                />
                <span className="flex-1">
                  <span className="text-slate-200">{inc.title}</span>
                  <span className="ml-1 text-slate-500">
                    · {timeAgo(inc.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
