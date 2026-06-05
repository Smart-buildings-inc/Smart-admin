"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Floor, Incident } from "@/lib/types";
import type { SimOptions } from "@/components/BuildingSimulator";
import { defaultTwinModel } from "@/components/GltfBuilding";
import { needColor } from "@/lib/ui";

const BuildingSimulator = dynamic(() => import("@/components/BuildingSimulator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-ink-950 text-sm text-slate-500">
      Loading pitch world...
    </div>
  ),
});

export type QualityTier = "low" | "balanced" | "high";

type Mission = {
  id: string;
  floorKey: string;
  label: string;
  title: string;
  brief: string;
  payoff: string;
  metric: string;
  points: string[];
};

const PITCH_MISSIONS: Mission[] = [
  {
    id: "water-loop",
    floorKey: "reclamation-core",
    label: "Water",
    title: "Close the non-potable water loop",
    brief:
      "ATLAS tracks reuse where it is actually permittable: greywater and rainwater serving toilets, irrigation, and process loads.",
    payoff:
      "The pitch is stronger because the sustainability claim is scoped, measurable, and ready for a regulator or lender to audit.",
    metric: "92% reuse",
    points: ["CSA B128 scope", "MECP ECA path", "Basement reservoir"],
  },
  {
    id: "energy-islanding",
    floorKey: "power-ops-core",
    label: "Energy",
    title: "Keep the building online through grid stress",
    brief:
      "The energy floor models solar generation, battery state, live load, and island-capable operation without pretending the tower is fully off-grid.",
    payoff:
      "Operators get a practical resilience story: grid-tied efficiency during normal days, islanding when the city needs the asset to stay awake.",
    metric: "78% battery",
    points: ["Grid-tied", "Island capable", "ESS compliance"],
  },
  {
    id: "food-resilience",
    floorKey: "vertical-farm",
    label: "Food",
    title: "Turn food production into an operating signal",
    brief:
      "Amenity food output is measured in kg/day and tied to lighting, humidity, and water demand, so the farm behaves like infrastructure.",
    payoff:
      "The investor story becomes tangible: lower service burden, differentiated resident experience, and a data trail for continuous optimization.",
    metric: "86 kg/day",
    points: ["Grow cycles", "Humidity separation", "No external-sale risk"],
  },
  {
    id: "resident-shelter",
    floorKey: "residences-b",
    label: "Shelter",
    title: "Operate homes as living parts of the twin",
    brief:
      "Residential floors carry dwellings, beds, occupancy, comfort, and load data instead of being a static stack of apartments.",
    payoff:
      "That makes resident experience visible to operations while keeping the building finance model grounded in real units and capacity.",
    metric: "14 dwellings",
    points: ["Group C use", "Comfort telemetry", "Load visibility"],
  },
  {
    id: "air-health",
    floorKey: "the-lung",
    label: "Air",
    title: "Make indoor health measurable",
    brief:
      "The Lung surfaces CO2, particulate, humidity, and occupancy readings as a shared health layer for every resident above it.",
    payoff:
      "This is where the platform moves from smart-building dashboard to trust layer: no vague wellness claims, just live building evidence.",
    metric: "410 ppm CO2",
    points: ["Air handling", "PM2.5", "Privacy-safe presence"],
  },
  {
    id: "community-care",
    floorKey: "commons-clinic",
    label: "Care",
    title: "Close the loop with people",
    brief:
      "Clinic and commons signals connect incidents, broadcasts, and resident communication so operations can act before small events become outages.",
    payoff:
      "The project teaches itself: sense, model, triage, broadcast, and learn through one operating system for the habitat.",
    metric: "15s loop",
    points: ["Incident feed", "Broadcast record", "Operator-ready UI"],
  },
];

const VALUE_STACK = [
  { label: "Product", value: "3D digital twin", color: "#7fe7e0" },
  { label: "Operations", value: "Triage + broadcast", color: "#ffb340" },
  { label: "Asset", value: "Resilience index", color: "#5ddc7a" },
  { label: "Scale", value: "Tower to fleet", color: "#c0a4ff" },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function formatFloorMetric(floor: Floor | undefined, mission: Mission) {
  if (!floor) return mission.metric;
  if (floor.dwellings) return `${floor.dwellings} dwellings`;
  if (floor.metrics.batteryPct !== undefined) return `${floor.metrics.batteryPct}% battery`;
  if (floor.metrics.waterReusePct !== undefined) return `${floor.metrics.waterReusePct}% reuse`;
  if (floor.metrics.foodKgDay !== undefined) return `${floor.metrics.foodKgDay} kg/day`;
  if (floor.metrics.co2Ppm !== undefined) return `${floor.metrics.co2Ppm} ppm CO2`;
  if (floor.metrics.occupancy !== undefined) return `${floor.metrics.occupancy} present`;
  return mission.metric;
}

function QualityButton({
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
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info ${
        active
          ? "bg-white text-ink-950"
          : "border border-ink-600/70 bg-ink-900/70 text-slate-300 hover:bg-ink-800 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function PitchGame({
  floors,
  incidents,
  initialQuality = "balanced",
}: {
  floors: Floor[];
  incidents: Incident[];
  initialQuality?: QualityTier;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    PITCH_MISSIONS[0]?.floorKey ?? null,
  );
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [quality, setQuality] = useState<QualityTier>(initialQuality);
  const [night, setNight] = useState(false);
  const [elevatorFloor, setElevatorFloor] = useState(0);

  const activeMission = PITCH_MISSIONS[activeIndex];
  const floorByKey = useMemo(
    () => new Map(floors.map((floor) => [floor.key, floor])),
    [floors],
  );
  const activeFloor = floorByKey.get(activeMission.floorKey);
  const selectedFloor = selectedKey ? floorByKey.get(selectedKey) : undefined;
  const elevatorFloorName = floors[elevatorFloor]?.name ?? "Mission deck";
  const score = Math.round((completed.size / PITCH_MISSIONS.length) * 100);

  const options = useMemo<SimOptions>(
    () => ({
      night,
      cutaway: true,
      autoRotate: !reducedMotion,
      elevatorRunning: !reducedMotion && quality !== "low",
      researchLens:
        quality === "high" ? "hologram" : quality === "balanced" ? "fluid" : "ops",
      detailedModels: quality !== "low",
      source: quality === "low" ? "voxel" : defaultTwinModel(),
    }),
    [night, quality, reducedMotion],
  );

  const setMission = useCallback((index: number) => {
    const mission = PITCH_MISSIONS[index];
    setActiveIndex(index);
    setSelectedKey(mission.floorKey);
  }, []);

  const handleSelect = useCallback((key: string | null) => {
    setSelectedKey(key);
    if (!key) return;
    const missionIndex = PITCH_MISSIONS.findIndex((mission) => mission.floorKey === key);
    if (missionIndex >= 0) setActiveIndex(missionIndex);
  }, []);

  const completeActiveMission = useCallback(() => {
    setCompleted((current) => {
      const next = new Set(current);
      next.add(activeMission.id);
      return next;
    });
  }, [activeMission.id]);

  const nextMission = useCallback(() => {
    const nextIndex = (activeIndex + 1) % PITCH_MISSIONS.length;
    setMission(nextIndex);
  }, [activeIndex, setMission]);

  const selectedMetric = formatFloorMetric(selectedFloor ?? activeFloor, activeMission);
  const activeNeedColor = activeFloor ? needColor[activeFloor.need] : "#7fe7e0";
  const activeComplete = completed.has(activeMission.id);

  return (
    <main
      id="main"
      className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-ink-950 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-4rem)] md:pb-0"
    >
      <div
        data-testid="pitch-stage"
        className="absolute inset-0 bg-ink-950"
        aria-label="Interactive 3D ATLAS pitch world"
      >
        <BuildingSimulator
          floors={floors}
          incidents={incidents}
          selectedKey={selectedKey}
          options={options}
          pixel={quality === "low"}
          ascii={false}
          onSelect={handleSelect}
          onElevatorArrive={setElevatorFloor}
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,11,16,0.88),rgba(7,11,16,0.24)_44%,rgba(7,11,16,0.74)),linear-gradient(0deg,rgba(7,11,16,0.9),transparent_36%)]"
      />

      <section className="pointer-events-none absolute inset-0 z-10 p-3 sm:p-4 lg:p-6">
        <div className="pointer-events-auto max-h-[48dvh] w-full overflow-y-auto rounded-xl border border-ink-600/70 bg-ink-900/82 p-4 shadow-2xl backdrop-blur sm:max-h-[calc(100dvh-10rem)] sm:w-[27rem] lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-800/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: activeNeedColor }}
              />
              Mission {activeIndex + 1}/{PITCH_MISSIONS.length}
            </span>
            <button
              type="button"
              onClick={() => setNight((value) => !value)}
              aria-pressed={night}
              className="min-h-9 rounded-lg border border-ink-600/70 bg-ink-900/70 px-3 text-xs font-bold text-slate-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              {night ? "Day" : "Night"}
            </button>
          </div>

          <h1 className="display mt-4 text-3xl leading-tight text-white sm:text-4xl">
            ATLAS Pitch Quest
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Play through the building systems that make the project investable,
            operable, and easier to explain in one room.
          </p>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-ink-600/60 bg-ink-950/60 p-3">
            <div>
              <div className="kpi-label">Mission score</div>
              <div
                data-testid="pitch-progress"
                className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700"
                aria-label={`Pitch mission score ${score}%`}
              >
                <div
                  className="h-full rounded-full bg-signal-ok transition-[width]"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
            <div className="font-mono text-2xl font-bold text-white tabular-nums">
              {score}%
            </div>
          </div>

          <article aria-live="polite" className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold text-ink-950"
                style={{ backgroundColor: activeNeedColor }}
              >
                {activeMission.label}
              </span>
              <span className="rounded-full border border-ink-600/70 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                {selectedMetric}
              </span>
              {activeComplete && (
                <span className="rounded-full bg-signal-ok/15 px-2.5 py-1 text-[11px] font-bold text-signal-ok">
                  Captured
                </span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-extrabold leading-tight text-white">
              {activeMission.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {activeMission.brief}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {activeMission.payoff}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {activeMission.points.map((point) => (
                <li
                  key={point}
                  className="rounded-lg border border-ink-600/70 bg-ink-950/60 px-2.5 py-1 text-xs font-semibold text-slate-300"
                >
                  {point}
                </li>
              ))}
            </ul>
          </article>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={completeActiveMission}
              className="min-h-11 flex-1 rounded-xl bg-white px-4 text-sm font-extrabold text-ink-950 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              Scan selected mission
            </button>
            <button
              type="button"
              onClick={nextMission}
              className="min-h-11 flex-1 rounded-xl border border-ink-600/70 bg-ink-900/80 px-4 text-sm font-extrabold text-slate-100 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              Next mission
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="kpi-label mr-1 normal-case tracking-normal">Quality</span>
            {(["low", "balanced", "high"] as QualityTier[]).map((tier) => (
              <QualityButton
                key={tier}
                label={tier[0].toUpperCase() + tier.slice(1)}
                active={quality === tier}
                onClick={() => setQuality(tier)}
              />
            ))}
          </div>
        </div>

        <aside className="pointer-events-auto absolute right-6 top-6 hidden w-[21rem] rounded-xl border border-ink-600/70 bg-ink-900/80 p-4 shadow-2xl backdrop-blur xl:block">
          <div className="kpi-label">Pitch stack</div>
          <div className="mt-3 space-y-3">
            {VALUE_STACK.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-lg border border-ink-600/60 bg-ink-950/50 px-3 py-2"
              >
                <span className="text-xs font-semibold text-slate-400">{item.label}</span>
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-ink-600/60 bg-ink-950/50 p-3">
            <div className="kpi-label">Selected floor</div>
            <div className="mt-1 font-mono text-sm font-bold text-white">
              {selectedFloor?.name ?? activeFloor?.name ?? "None"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Elevator now at {elevatorFloorName}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/"
              className="rounded-lg border border-ink-600/70 bg-ink-950/50 px-3 py-2 text-center text-xs font-bold text-slate-200 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              Console
            </Link>
            <Link
              href="/documents"
              className="rounded-lg border border-ink-600/70 bg-ink-950/50 px-3 py-2 text-center text-xs font-bold text-slate-200 transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
            >
              Documents
            </Link>
          </div>
        </aside>

        <nav
          aria-label="Pitch missions"
          className="pointer-events-auto absolute inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-4 lg:inset-x-6"
        >
          <div className="scroll-thin flex gap-2 overflow-x-auto rounded-xl border border-ink-600/70 bg-ink-900/82 p-2 shadow-2xl backdrop-blur">
            {PITCH_MISSIONS.map((mission, index) => {
              const floor = floorByKey.get(mission.floorKey);
              const missionColor = floor ? needColor[floor.need] : "#7fe7e0";
              const active = index === activeIndex;
              const done = completed.has(mission.id);
              return (
                <button
                  key={mission.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMission(index)}
                  className={`min-w-[10rem] rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info ${
                    active
                      ? "border-white bg-white text-ink-950"
                      : "border-ink-600/70 bg-ink-950/50 text-slate-200 hover:bg-ink-800"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                      {mission.label}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${done ? "ring-2 ring-signal-ok/35" : ""}`}
                      style={{ backgroundColor: done ? "#3ddc97" : missionColor }}
                    />
                  </span>
                  <span className="mt-1 block truncate text-sm font-extrabold">
                    {floor?.name ?? mission.title}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </section>
    </main>
  );
}
