"use client";

import { useMemo, useState } from "react";
import type { Building, BuildingStatus, EcaStatus } from "@/lib/types";

// F7 — Fleet view. A zoomed-out, stylized map of every ATLAS building across
// the network (Canada → US). No real map library: we normalize lat/lng into the
// SVG viewbox and plot status-colored markers, pulsing when not fully online.

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

// Viewbox for the stylized plot.
const VW = 1000;
const VH = 640;
const PAD = 60;

// Geographic bounds covering the seeded Canadian + US cities, with a little
// margin so markers never sit on the very edge.
const LAT_MIN = 40;
const LAT_MAX = 53;
const LNG_MIN = -126;
const LNG_MAX = -71;

function project(lat: number, lng: number): { x: number; y: number } {
  const tx = (lng - LNG_MIN) / (LNG_MAX - LNG_MIN);
  const ty = (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  return {
    x: PAD + tx * (VW - PAD * 2),
    // Latitude grows north (up), so invert for screen-space y.
    y: PAD + (1 - ty) * (VH - PAD * 2),
  };
}

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

/** Human-readable label + tone for an MECP ECA status value. */
function ecaDisplay(status: EcaStatus): {
  label: string;
  tone: "ok" | "warn" | "info" | "crit";
} {
  switch (status) {
    case "approved":
      return { label: "Approved", tone: "ok" };
    case "in-review":
      return { label: "In review", tone: "warn" };
    case "pre-consultation":
      return { label: "Pre-consultation", tone: "info" };
    case "not-started":
      return { label: "Not started", tone: "crit" };
  }
}

/** Maps a tone name to the matching Tailwind text colour class. */
function toneText(tone: "ok" | "warn" | "info" | "crit"): string {
  switch (tone) {
    case "ok":
      return "text-signal-ok";
    case "warn":
      return "text-signal-warn";
    case "crit":
      return "text-signal-crit";
    case "info":
      return "text-signal-info";
  }
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
        <div className="panel relative h-[360px] overflow-hidden sm:h-[480px] lg:h-auto">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            className="h-full w-full"
            role="img"
            aria-label="ATLAS fleet map"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern
                id="fleet-grid"
                width="50"
                height="50"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="rgba(120,160,200,0.08)"
                  strokeWidth="1"
                />
              </pattern>
              <radialGradient id="fleet-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(78,168,255,0.10)" />
                <stop offset="100%" stopColor="rgba(78,168,255,0)" />
              </radialGradient>
            </defs>

            <rect width={VW} height={VH} fill="url(#fleet-glow)" />
            <rect width={VW} height={VH} fill="url(#fleet-grid)" />

            {/* Connecting lines from each building back to ATLAS-01 (network). */}
            {(() => {
              const hub = buildings.find((b) => b.id === "atlas-01");
              if (!hub) return null;
              const h = project(hub.location.lat, hub.location.lng);
              return buildings
                .filter((b) => b.id !== hub.id)
                .map((b) => {
                  const p = project(b.location.lat, b.location.lng);
                  return (
                    <line
                      key={`link-${b.id}`}
                      x1={h.x}
                      y1={h.y}
                      x2={p.x}
                      y2={p.y}
                      stroke="rgba(120,160,200,0.16)"
                      strokeWidth="1"
                      strokeDasharray="4 5"
                    />
                  );
                });
            })()}

            {/* Building markers */}
            {buildings.map((b) => {
              const { x, y } = project(b.location.lat, b.location.lng);
              const color = STATUS_COLOR[b.status];
              const active = b.id === selectedId;
              const pulsing = b.status !== "online";
              return (
                <g
                  key={b.id}
                  transform={`translate(${x} ${y})`}
                  onClick={() => setSelectedId(b.id)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`${b.name} — ${STATUS_LABEL[b.status]}`}
                >
                  {/* Halo */}
                  <circle
                    r={active ? 22 : 16}
                    fill={color}
                    opacity={active ? 0.22 : 0.14}
                    className={pulsing ? "pulse" : undefined}
                  />
                  {/* Core dot */}
                  <circle
                    r={active ? 8 : 6}
                    fill={color}
                    stroke="#070b10"
                    strokeWidth="1.5"
                  />
                  <text
                    x={0}
                    y={-24}
                    textAnchor="middle"
                    fill={active ? "#ffffff" : "#cbd5e1"}
                    fontSize="13"
                    fontWeight={active ? 700 : 500}
                  >
                    {b.location.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute left-4 top-4 flex flex-col gap-1.5 rounded-lg border border-ink-600/60 bg-ink-900/80 px-3 py-2 text-xs backdrop-blur">
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
                  <div className="kpi-label">Energy autonomy</div>
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
                  <div className="kpi-label">Floors</div>
                  <div className="kpi-value">{selected.unitCount}</div>
                </div>
                {selected.dwellings !== undefined ? (
                  <div className="panel panel-pad">
                    <div className="kpi-label">Dwellings</div>
                    <div className="kpi-value">{selected.dwellings}</div>
                  </div>
                ) : null}
                {selected.beds !== undefined ? (
                  <div className="panel panel-pad">
                    <div className="kpi-label">Beds</div>
                    <div className="kpi-value">{selected.beds}</div>
                  </div>
                ) : null}
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
                {selected.gridTied !== undefined ? (
                  <div className="panel panel-pad">
                    <div className="kpi-label">Grid</div>
                    <div
                      className={`kpi-value ${
                        selected.gridTied && selected.islandCapable
                          ? "text-signal-ok"
                          : !selected.gridTied
                            ? "text-signal-crit"
                            : "text-white"
                      }`}
                    >
                      {selected.gridTied && selected.islandCapable
                        ? "Tied + island"
                        : selected.gridTied
                          ? "Grid-tied"
                          : "Off-grid"}
                    </div>
                  </div>
                ) : null}
              </dl>

              {/* Compliance section — only rendered when compliance data is present */}
              {selected.compliance ? (
                <div className="flex flex-col gap-2">
                  {/* Section header */}
                  <h3 className="kpi-label text-[0.625rem] uppercase tracking-[0.14em] text-slate-500">
                    Permitting &amp; compliance
                  </h3>
                  <div className="panel panel-pad flex flex-col gap-2">
                    {/* Elevators */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Elevators</span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.elevators >= 2
                            ? "text-signal-ok"
                            : "text-signal-warn"
                        }`}
                      >
                        {selected.compliance.elevators}
                      </span>
                    </div>
                    {/* Firefighter elevator */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        Firefighter elevator
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.firefighterElevator
                            ? "text-signal-ok"
                            : "text-signal-warn"
                        }`}
                      >
                        {selected.compliance.firefighterElevator ? "Yes" : "No"}
                      </span>
                    </div>
                    {/* Exit stairs */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Exit stairs</span>
                      <span className="text-xs font-semibold text-white">
                        {selected.compliance.exitStairs}
                      </span>
                    </div>
                    {/* Sprinklered */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Sprinklered</span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.sprinklered
                            ? "text-signal-ok"
                            : "text-signal-crit"
                        }`}
                      >
                        {selected.compliance.sprinklered ? "Yes" : "No"}
                      </span>
                    </div>
                    {/* Barrier-free (AODA) */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        Barrier-free (AODA)
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.barrierFree
                            ? "text-signal-ok"
                            : "text-signal-warn"
                        }`}
                      >
                        {selected.compliance.barrierFree ? "Yes" : "No"}
                      </span>
                    </div>
                    {/* Dual plumbing (CSA B128) */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        Dual plumbing (CSA B128)
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.dualPlumbing
                            ? "text-signal-ok"
                            : "text-signal-warn"
                        }`}
                      >
                        {selected.compliance.dualPlumbing ? "Yes" : "No"}
                      </span>
                    </div>
                    {/* MECP ECA status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">MECP ECA</span>
                      {(() => {
                        const { label, tone } = ecaDisplay(
                          selected.compliance.mecpEcaStatus,
                        );
                        return (
                          <span
                            className={`text-xs font-semibold ${toneText(tone)}`}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    {/* Reservoir location */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Reservoir</span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.reservoirLocation === "basement"
                            ? "text-signal-ok"
                            : "text-signal-warn"
                        }`}
                      >
                        {selected.compliance.reservoirLocation === "basement"
                          ? "Basement"
                          : "Roof"}
                      </span>
                    </div>
                    {/* ESS fire-code */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        ESS fire-code
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          selected.compliance.essFireCompliant
                            ? "text-signal-ok"
                            : "text-signal-crit"
                        }`}
                      >
                        {selected.compliance.essFireCompliant ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

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
