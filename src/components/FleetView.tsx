"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Building, BuildingStatus } from "@/lib/types";

// F7 — Fleet view. A real Leaflet map of every ATLAS building across the
// network (Canada → US), plotting status-colored markers that pulse when not
// fully online. The map itself lives in <FleetMap> (Leaflet needs `window`, so
// it is loaded client-only), with our own attribution in place of Leaflet's.

const FleetMap = dynamic(() => import("@/components/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Loading fleet map…
    </div>
  ),
});

const STATUS_COLOR: Record<BuildingStatus, string> = {
  online: "#3ddc97", // signal.ok
  degraded: "#ffb340", // signal.warn
  offline: "#ff5d5d", // signal.crit
};

const STATUS_LABEL: Record<BuildingStatus, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
};

function statusToneClass(status: BuildingStatus): string {
  return status === "online"
    ? "text-signal-ok"
    : status === "degraded"
      ? "text-signal-warn"
      : "text-signal-crit";
}

function FleetKpi({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "ok" | "warn" | "crit";
}) {
  const toneClass =
    tone === "crit"
      ? "text-signal-crit"
      : tone === "warn"
        ? "text-signal-warn"
        : tone === "ok"
          ? "text-signal-ok"
          : "text-white";
  return (
    <div className="panel panel-pad min-w-[8.5rem] flex-1">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${toneClass}`}>
        {value}
        {suffix ? (
          <span className="ml-0.5 text-sm font-normal text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function FleetView({
  buildings,
  dbConnected,
}: {
  buildings: Building[];
  dbConnected: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => buildings.find((b) => b.id === selectedId) ?? null,
    [buildings, selectedId],
  );

  const summary = useMemo(() => {
    const totalResidents = buildings.reduce((s, b) => s + b.residents, 0);
    const totalIncidents = buildings.reduce((s, b) => s + b.openIncidents, 0);
    const avgAutonomy = buildings.length
      ? Math.round(
          buildings.reduce((s, b) => s + b.autonomyPct, 0) / buildings.length,
        )
      : 0;
    return {
      count: buildings.length,
      totalResidents,
      totalIncidents,
      avgAutonomy,
    };
  }, [buildings]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">
            ATLAS&nbsp;Fleet
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Every ATLAS building, one map.{" "}
            <span className="important">Housing as a network.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
              dbConnected
                ? "bg-signal-ok/15 text-signal-ok"
                : "bg-ink-700 text-slate-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dbConnected ? "bg-signal-ok" : "bg-slate-500"
              }`}
            />
            {dbConnected ? "Database connected" : "Seed data (local-first)"}
          </span>
        </div>
      </header>

      {/* Fleet KPI summary strip */}
      <div className="flex flex-wrap gap-3">
        <FleetKpi label="Buildings" value={summary.count} />
        <FleetKpi label="Residents" value={summary.totalResidents} />
        <FleetKpi
          label="Avg autonomy"
          value={summary.avgAutonomy}
          suffix="%"
          tone={
            summary.avgAutonomy >= 90
              ? "ok"
              : summary.avgAutonomy >= 70
                ? "warn"
                : "crit"
          }
        />
        <FleetKpi
          label="Open incidents"
          value={summary.totalIncidents}
          tone={
            summary.totalIncidents === 0
              ? "ok"
              : summary.totalIncidents <= 4
                ? "warn"
                : "crit"
          }
        />
      </div>

      {/* Map + detail */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* Map panel */}
        <div className="panel relative z-0 h-[360px] overflow-hidden sm:h-[480px] lg:h-auto">
          <FleetMap
            buildings={buildings}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {/* Legend */}
          <div className="pointer-events-none absolute left-4 top-4 z-[500] flex flex-col gap-1.5 rounded-lg border border-ink-600/60 bg-ink-900/80 px-3 py-2 text-xs backdrop-blur">
            {(["online", "degraded", "offline"] as BuildingStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2 text-slate-300">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[s] }}
                />
                {STATUS_LABEL[s]}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="panel panel-pad scroll-thin overflow-y-auto">
          {selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR[selected.status] }}
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-[0.14em] ${statusToneClass(
                      selected.status,
                    )}`}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
                <h2 className="display mt-1 text-xl text-white">
                  {selected.name}
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {selected.location.label}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <div className="panel panel-pad">
                  <div className="kpi-label">Autonomy</div>
                  <div
                    className={`kpi-value ${
                      selected.autonomyPct >= 90
                        ? "text-signal-ok"
                        : selected.autonomyPct >= 70
                          ? "text-signal-warn"
                          : "text-signal-crit"
                    }`}
                  >
                    {selected.autonomyPct}
                    <span className="ml-0.5 text-sm font-normal text-slate-400">
                      %
                    </span>
                  </div>
                </div>
                <div className="panel panel-pad">
                  <div className="kpi-label">Residents</div>
                  <div className="kpi-value">{selected.residents}</div>
                </div>
                <div className="panel panel-pad">
                  <div className="kpi-label">Units</div>
                  <div className="kpi-value">{selected.unitCount}</div>
                </div>
                <div className="panel panel-pad">
                  <div className="kpi-label">Open incidents</div>
                  <div
                    className={`kpi-value ${
                      selected.openIncidents === 0
                        ? "text-signal-ok"
                        : selected.openIncidents <= 2
                          ? "text-signal-warn"
                          : "text-signal-crit"
                    }`}
                  >
                    {selected.openIncidents}
                  </div>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-slate-500">
                Lat {selected.location.lat.toFixed(4)}, Lng{" "}
                {selected.location.lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <span className="text-base text-slate-300">
                Select a building
              </span>
              <span>
                Tap any marker on the map to inspect its live rollup metrics.
              </span>
            </div>
          )}
        </div>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes,
        but never overrides safety.
      </footer>
    </main>
  );
}
