"use client";

// F12 — Building Simulator (DOM chrome).
//
// Owns the page layout, the control bar, the per-floor telemetry readout and
// the live elevator indicator, and lazy-loads the WebGL building (no SSR).

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Floor, FloorMetrics, Incident } from "@/lib/types";
import type { SimOptions } from "@/components/BuildingSimulator";
import ModelInspector, {
  type InspectorTransform,
  type InspectorMaterial,
  type InspectorAnimation,
  type FloorModelInfo,
  type InspectorActions,
  DEFAULT_TRANSFORM,
  DEFAULT_MATERIAL,
  DEFAULT_ANIMATION,
} from "@/components/ModelInspector";
import { needColor, occupancyGroupLabel, useScopeLabel } from "@/lib/ui";
import { PARALLAX_SCENES } from "@/lib/marketingParallax";
import FullscreenLink from "@/components/FullscreenLink";
import MarketingParallax from "@/components/MarketingParallax";
import { defaultTwinModel } from "@/components/GltfBuilding";
import { sceneStore, useSceneField, useSceneSelector, startDemo } from "@/lib/scene-store";
import type { SceneState } from "@/lib/scene-store";

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
  waterReusePct: { label: "Non-potable reuse", fmt: (v) => `${v}%` },
  foodKgDay: { label: "Food (amenity)", fmt: (v) => `${v} kg/day` },
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

type ResearchLens = NonNullable<SimOptions["researchLens"]>;

const RESEARCH_LENSES: {
  lens: ResearchLens;
  label: string;
  title: string;
  source: string;
  body: string;
}[] = [
  {
    lens: "ops",
    label: "Ops",
    title: "Operational twin",
    source: "R3F + Drei production baseline",
    body: "The plain ATLAS operating view keeps telemetry, people, elevator movement, and floor selection visually dominant.",
  },
  {
    lens: "fluid",
    label: "Fluid",
    title: "Volumetric flow field",
    source: "Inspired by WebGL Fluid Simulation + Trinity",
    body: "Additive currents wrap the building like air, water, and heat flow studies without pulling in a heavy solver.",
  },
  {
    lens: "sdf",
    label: "SDF",
    title: "Morphing rooftop sculpture",
    source: "Inspired by Shader Park SDF workflows",
    body: "A procedural mesh breathes above the roof to preview how generative forms could react to real ATLAS signals.",
  },
  {
    lens: "hologram",
    label: "Holo",
    title: "Point-cloud halo",
    source: "Inspired by Potree + GaussianSplats3D",
    body: "A sparse holographic shell suggests LiDAR, scan, and capture-driven digital-twin overlays around the habitat.",
  },
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
      className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-white text-ink-950" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// Paradigm 3 — Time slider overlay.
function TimeOverlay() {
  const timeOfDay = useSceneField("timeOfDay");
  const timeSpeed = useSceneField("timeSpeed");
  const demoPhase = useSceneField("demoPhase");

  const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;
  const isDawn = timeOfDay >= 0.22 && timeOfDay < 0.35;
  const isDusk = timeOfDay >= 0.6 && timeOfDay < 0.78;
  const isDay = !isNight && !isDawn && !isDusk;

  // Sun/Moon icon
  let icon: string;
  if (isNight) icon = "\u{1F319}";
  else if (isDawn) icon = "\u{1F305}";
  else if (isDusk) icon = "\u{1F307}";
  else icon = "\u2600\uFE0F";

  // Format time of day as HH:MM
  const totalMinutes = Math.round(timeOfDay * 24 * 60);
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  const timeStr = `${hh}:${mm}`;

  const speeds = [
    { label: "\u23F8", speed: 0 },
    { label: "1\u00D7", speed: 1 },
    { label: "10\u00D7", speed: 10 },
    { label: "60\u00D7", speed: 60 },
  ];

  return (
    <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/85 px-3 py-1.5 text-xs backdrop-blur">
        <span className="text-base leading-none">{icon}</span>
        <span className="w-10 font-mono font-semibold text-white">{timeStr}</span>

        {/* Time scrub */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={timeOfDay}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            sceneStore.setState({ timeOfDay: v, timeSpeed: 0, _prevTimeOfDay: v });
          }}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-ink-600 accent-signal-info md:w-28"
          aria-label="Time of day"
        />

        {/* Speed buttons */}
        {speeds.map(({ label, speed }) => (
          <button
            key={speed}
            type="button"
            onClick={() => {
              sceneStore.setState({ timeSpeed: speed, isDemoMode: false, demoPhase: null });
            }}
            className={`rounded px-1.5 py-0.5 font-mono transition-colors ${
              Math.abs(timeSpeed - speed) < 0.01
                ? "bg-white text-ink-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}

        {/* Demo badge */}
        <DemoBadge phase={demoPhase} />
      </div>
    </div>
  );
}

function DemoBadge({ phase }: { phase: string | null }) {
  if (!phase) return null;
  const labels: Record<string, string> = {
    intro: "Orbiting\u2026",
    sunset: "Sunset\u2026",
    night: "Night glow\u2026",
  };
  return (
    <span className="ml-1 animate-pulse rounded-full bg-signal-info/20 px-2 py-0.5 text-[10px] font-semibold text-signal-info">
      {labels[phase] ?? "Demo"}
    </span>
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
    researchLens: "ops",
    detailedModels: true,
    source: defaultTwinModel(),
  });
  // Single render-mode switch: off = architectural detailed twin; "Pixel" =
  // retro figures + pixelation for a deliberate lightweight fallback.
  const [pixel, setPixel] = useState(false);
  const togglePixel = useCallback(() => {
    setPixel((on) => {
      const next = !on;
      setOptions((o) => ({ ...o, detailedModels: !next }));
      return next;
    });
  }, []);
  const [ascii, setAscii] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Inspector state
  const [inspectorTransform, setInspectorTransform] = useState<InspectorTransform>(DEFAULT_TRANSFORM);
  const [inspectorMaterial, setInspectorMaterial] = useState<InspectorMaterial>(DEFAULT_MATERIAL);
  const [inspectorAnimation, setInspectorAnimation] = useState<InspectorAnimation>(DEFAULT_ANIMATION);
  const [modelInfo] = useState<FloorModelInfo>({
    triangles: 0,
    textureMemMB: 0,
    objectCount: 0,
    materialCount: 0,
  });
  const stageRef = useRef<HTMLDivElement>(null);

  // Screenshot: capture the canvas inside the stage
  const onScreenshot = useCallback(() => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `atlas-screenshot-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, []);

  // Reset camera: toggle autoRotate off/on to reset orbit
  const onResetCamera = useCallback(() => {
    setOptions((o) => ({ ...o, autoRotate: false }));
    setTimeout(() => setOptions((o) => ({ ...o, autoRotate: options.autoRotate })), 50);
  }, [options.autoRotate]);

  const inspectorActions: InspectorActions = {
    onScreenshot,
    onResetCamera,
    onToggleAutoRotate: () => set({ autoRotate: !options.autoRotate }),
    autoRotate: options.autoRotate,
  };

  const set = useCallback(
    (patch: Partial<SimOptions>) => setOptions((o) => ({ ...o, ...patch })),
    [],
  );

  const selectedFloor = useMemo(
    () => floors.find((f) => f.key === selectedKey) ?? null,
    [floors, selectedKey],
  );
  const activeLens = options.researchLens ?? "ops";
  const activeLensInfo =
    RESEARCH_LENSES.find((mode) => mode.lens === activeLens) ?? RESEARCH_LENSES[0];

  const elevatorFloorName = floors[elevatorFloor]?.name ?? "—";
  const metricEntries = selectedFloor
    ? METRIC_ORDER.filter((k) => selectedFloor.metrics[k] !== undefined)
    : [];

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">Building Simulator</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            ATLAS‑01, operating live — every floor a human need, rendered as an architectural building twin.{" "}
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

      <MarketingParallax
        accent="#ffcf4d"
        compact
        label="ATLAS simulator habitat systems visual"
        layers={PARALLAX_SCENES.simulator}
      />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* Stage */}
        <section className="flex flex-col gap-4">
          <div
            ref={stageRef}
            data-testid="sim-stage"
            className="panel relative h-[min(78dvh,760px)] min-h-[560px] overflow-hidden bg-ink-950 sm:h-[760px] lg:h-[820px]"
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
              elevatorFloor={elevatorFloor}
              inspectorTransform={inspectorTransform}
              inspectorMaterial={inspectorMaterial}
              inspectorAnimation={inspectorAnimation}
            />

            {/* Model Inspector — rigging panel overlay */}
            <ModelInspector
              floors={floors}
              incidents={incidents}
              selectedKey={selectedKey}
              onSelectFloor={setSelectedKey}
              transform={inspectorTransform}
              onChangeTransform={setInspectorTransform}
              material={inspectorMaterial}
              onChangeMaterial={setInspectorMaterial}
              animation={inspectorAnimation}
              onChangeAnimation={setInspectorAnimation}
              modelInfo={modelInfo}
              actions={inspectorActions}
              open={inspectorOpen}
              onToggleOpen={() => setInspectorOpen((v) => !v)}
            />

            {/* Title chip */}
            <div className="pointer-events-none absolute left-4 top-4 hidden text-xs text-slate-400 sm:block">
              <div className="display text-sm text-slate-200">ATLAS‑01 · Live Twin</div>
              <div>Orbit to inspect · tap a floor for telemetry</div>
            </div>

            {/* Controls */}
            <div className="absolute right-3 top-3 z-10 flex items-start justify-end gap-2">
              <div className="flex min-w-0 flex-col items-end gap-2">
                <div className="flex max-w-[min(29rem,calc(100vw-2rem))] flex-wrap justify-end gap-1 rounded-2xl border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                  <Toggle label={options.night ? "Night" : "Day"} active={options.night} onClick={() => set({ night: !options.night })} />
                  <Toggle label="Cut-away" active={options.cutaway} onClick={() => set({ cutaway: !options.cutaway })} />
                  <Toggle label="Pixel" active={pixel} onClick={togglePixel} />
                  <Toggle label="ASCII" active={ascii} onClick={() => setAscii((a) => !a)} />
                  <Toggle label="Orbit" active={options.autoRotate} onClick={() => set({ autoRotate: !options.autoRotate })} />
                  <Toggle label="Elevator" active={options.elevatorRunning} onClick={() => set({ elevatorRunning: !options.elevatorRunning })} />
                  <Toggle label="Hero" active={options.source === "gltf"} onClick={() => set({ source: options.source === "gltf" ? "voxel" : "gltf" })} />
                  <Toggle label={options.compliance ? "✓ Code" : "Code"} active={!!options.compliance} onClick={() => set({ compliance: !options.compliance })} />
                  <Toggle label="🎬 Demo" active={false} onClick={startDemo} />
                </div>
                <div
                  aria-label="3D research lens"
                  className="flex max-w-[min(20rem,calc(100vw-2rem))] flex-wrap justify-end gap-1 rounded-2xl border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur"
                >
                  {RESEARCH_LENSES.map((mode) => (
                    <Toggle
                      key={mode.lens}
                      label={mode.label}
                      active={activeLens === mode.lens}
                      onClick={() => set({ researchLens: mode.lens })}
                    />
                  ))}
                </div>
              </div>
              <FullscreenLink />
            </div>

            {/* Live elevator indicator */}
            <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/80 px-3 py-1.5 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-info" />
              <span className="text-slate-400">Elevator</span>
              <span className="font-mono font-semibold text-white">{elevatorFloorName}</span>
            </div>

            {/* Paradigm 3 — Time slider */}
            <TimeOverlay />

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
                    {(selectedFloor.occupancyGroup !== undefined || selectedFloor.useScope !== undefined) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {selectedFloor.occupancyGroup !== undefined && (
                          <span className="text-xs uppercase tracking-wide text-slate-500">
                            {occupancyGroupLabel[selectedFloor.occupancyGroup]}
                          </span>
                        )}
                        {selectedFloor.occupancyGroup !== undefined && selectedFloor.useScope !== undefined && (
                          <span className="text-slate-600">·</span>
                        )}
                        {selectedFloor.useScope !== undefined && (
                          <span className="text-xs uppercase tracking-wide text-slate-500">
                            {useScopeLabel[selectedFloor.useScope]}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedFloor.regulatoryNotes && selectedFloor.regulatoryNotes.length > 0 && (
                      <div className="mt-1 text-xs italic text-slate-600">
                        {selectedFloor.regulatoryNotes[0]}
                      </div>
                    )}
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
              An architectural operating twin of ATLAS‑01 rendered in three.js — a
              curtain-wall frame, working elevator, switchback stairs, rooftop solar,
              detailed floor modules, and residents going about their day. Toggle <span className="text-slate-200">Cut-away</span> for the
              dollhouse view, <span className="text-slate-200">Night</span> to see the windows glow,{" "}
              <span className="text-slate-200">Pixel</span> only when you want the retro fallback, and{" "}
              <span className="text-slate-200">ASCII</span> for the signature glyph render.
            </p>
          </div>

          <div className="panel panel-pad text-sm text-slate-400">
            <div className="kpi-label mb-1.5">3D research lens</div>
            <div className="text-base font-semibold text-white">{activeLensInfo.title}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-signal-info">
              {activeLensInfo.source}
            </div>
            <p className="mt-2 leading-relaxed">{activeLensInfo.body}</p>
          </div>
        </section>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes, but never overrides safety.
      </footer>
    </main>
  );
}
