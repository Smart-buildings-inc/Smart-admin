"use client";

// F12 — Building Simulator (DOM chrome).
//
// Owns the page layout, the control bar, the per-floor telemetry readout and
// the live elevator indicator, and lazy-loads the WebGL building (no SSR).

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { Floor, FloorMetrics, Incident } from "@/lib/types";
import type { SimOptions } from "@/components/BuildingSimulator";
import { needColor } from "@/lib/ui";
import FullscreenLink from "@/components/FullscreenLink";

const BuildingSimulator = dynamic(() => import("@/components/BuildingSimulator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Booting Building Simulator…
    </div>
  ),
});

// Compact metric labels/formatters (mirrors FloorPanel's METRIC_META).
const METRIC_META: Record<keyof FloorMetrics, { label: string; fmt: (v: number) => string }> = {
  energyKw: { label: "Generation", fmt: (v) => `${v} kW` },
  loadKw: { label: "Load", fmt: (v) => `${v} kW` },
  batteryPct: { label: "Battery", fmt: (v) => `${v}%` },
  waterLph: { label: "Water flow", fmt: (v) => `${v} L/h` },
  waterReusePct: { label: "Water reuse", fmt: (v) => `${v}%` },
  foodKgDay: { label: "Food output", fmt: (v) => `${v} kg/day` },
  occupancy: { label: "Occupancy", fmt: (v) => `${v} present` },
  tempC: { label: "Temp", fmt: (v) => `${v} °C` },
  humidityPct: { label: "Humidity", fmt: (v) => `${v}%` },
  co2Ppm: { label: "CO₂", fmt: (v) => `${v} ppm` },
  pm25: { label: "PM2.5", fmt: (v) => `${v} µg/m³` },
};
const METRIC_ORDER = Object.keys(METRIC_META) as (keyof FloorMetrics)[];

const NEEDS: { need: Floor["need"]; label: string }[] = [
  { need: "water", label: "Water" },
  { need: "energy", label: "Energy" },
  { need: "food", label: "Food" },
  { need: "shelter", label: "Shelter" },
  { need: "air", label: "Air" },
  { need: "health", label: "Health" },
  { need: "restoration", label: "Restoration" },
];

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "bg-white text-ink-950" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function SimulatorView({
  floors,
  incidents,
  dbConnected,
}: {
  floors: Floor[];
  incidents: Incident[];
  dbConnected: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [elevatorFloor, setElevatorFloor] = useState(0);
  const [options, setOptions] = useState<SimOptions>({
    night: false,
    cutaway: true,
    autoRotate: true,
    elevatorRunning: true,
  });
  const [pixel, setPixel] = useState(true);
  const [ascii, setAscii] = useState(false);

  const set = useCallback(
    (patch: Partial<SimOptions>) => setOptions((o) => ({ ...o, ...patch })),
    [],
  );

  const selectedFloor = useMemo(
    () => floors.find((f) => f.key === selectedKey) ?? null,
    [floors, selectedKey],
  );

  const elevatorFloorName = floors[elevatorFloor]?.name ?? "—";
  const metricEntries = selectedFloor
    ? METRIC_ORDER.filter((k) => selectedFloor.metrics[k] !== undefined)
    : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">Building Simulator</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            ATLAS‑01, operating live — every floor a human need, rendered in voxel.{" "}
            <span className="important">Watch the building breathe.</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
            dbConnected ? "bg-signal-ok/15 text-signal-ok" : "bg-ink-700 text-slate-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dbConnected ? "bg-signal-ok" : "bg-slate-500"}`} />
          {dbConnected ? "Database connected" : "Seed data (local-first)"}
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* Stage */}
        <section className="flex flex-col gap-4">
          <div
            data-testid="sim-stage"
            className="panel relative h-[1040px] overflow-hidden bg-ink-950 lg:h-[820px]"
          >
            <BuildingSimulator
              floors={floors}
              incidents={incidents}
              selectedKey={selectedKey}
              options={options}
              pixel={pixel}
              ascii={ascii}
              onSelect={setSelectedKey}
              onElevatorArrive={setElevatorFloor}
            />

            {/* Title chip */}
            <div className="pointer-events-none absolute left-4 top-4 text-xs text-slate-400">
              <div className="display text-sm text-slate-200">ATLAS‑01 · Live Twin</div>
              <div>Orbit to inspect · tap a floor for telemetry</div>
            </div>

            {/* Controls */}
            <div className="absolute right-3 top-3 z-10 flex items-start justify-end gap-2">
              <div className="flex flex-wrap justify-end gap-1 rounded-2xl border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <Toggle label={options.night ? "Night" : "Day"} active={options.night} onClick={() => set({ night: !options.night })} />
                <Toggle label="Cut-away" active={options.cutaway} onClick={() => set({ cutaway: !options.cutaway })} />
                <Toggle label="Pixel" active={pixel} onClick={() => setPixel((p) => !p)} />
                <Toggle label="ASCII" active={ascii} onClick={() => setAscii((a) => !a)} />
                <Toggle label="Orbit" active={options.autoRotate} onClick={() => set({ autoRotate: !options.autoRotate })} />
                <Toggle label="Elevator" active={options.elevatorRunning} onClick={() => set({ elevatorRunning: !options.elevatorRunning })} />
              </div>
              <FullscreenLink />
            </div>

            {/* Live elevator indicator */}
            <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/80 px-3 py-1.5 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-info" />
              <span className="text-slate-400">Elevator</span>
              <span className="font-mono font-semibold text-white">{elevatorFloorName}</span>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 z-10 hidden flex-wrap justify-end gap-x-3 gap-y-1 rounded-xl border border-ink-600/70 bg-ink-900/80 px-3 py-2 backdrop-blur sm:flex sm:max-w-[18rem]">
              {NEEDS.map(({ need, label }) => (
                <span key={need} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: needColor[need] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Telemetry side panel */}
        <section className="flex flex-col gap-4">
          <div className="panel panel-pad">
            <div className="kpi-label mb-1">Floor telemetry</div>
            {!selectedFloor ? (
              <p className="text-sm text-slate-400">
                Select a floor in the simulator to inspect its live metrics, or watch
                the elevator make its rounds.
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: needColor[selectedFloor.need] }} />
                      <h2 className="text-base font-semibold text-white">{selectedFloor.name}</h2>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {selectedFloor.category} · Level {selectedFloor.level}
                    </div>
                  </div>
                  {selectedFloor.residents > 0 && (
                    <div className="text-right">
                      <div className="font-mono text-lg font-semibold text-white">{selectedFloor.residents}</div>
                      <div className="kpi-label">residents</div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {metricEntries.map((key) => {
                    const meta = METRIC_META[key];
                    const value = selectedFloor.metrics[key] as number;
                    return (
                      <div key={key} className="rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-2">
                        <div className="kpi-label">{meta.label}</div>
                        <div className="font-mono text-sm font-semibold text-white">{meta.fmt(value)}</div>
                      </div>
                    );
                  })}
                  {metricEntries.length === 0 && (
                    <p className="col-span-2 text-sm text-slate-400">No telemetry reported for this floor.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="panel panel-pad text-sm text-slate-400">
            <div className="kpi-label mb-1.5">About this view</div>
            <p>
              A procedurally-built voxel twin of ATLAS‑01 rendered in three.js — a
              working elevator, switchback stairs, rooftop solar + reservoir, and
              residents going about their day. Toggle <span className="text-slate-200">Cut-away</span> for the
              dollhouse view, <span className="text-slate-200">Night</span> to see the windows glow,{" "}
              <span className="text-slate-200">Pixel</span> for the full retro branding, and{" "}
              <span className="text-slate-200">ASCII</span> for the signature glyph render.
            </p>
          </div>
        </section>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes, but never overrides safety.
      </footer>
    </main>
  );
}
