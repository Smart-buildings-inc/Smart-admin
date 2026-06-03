"use client";

// Dedicated full-screen 3D viewer for ATLAS-01 (/simulate/atlas-01).
//
// Renders the F12 voxel Building Simulator edge-to-edge on every device — phone,
// tablet, desktop — as a true full-viewport showcase. The console twin and the
// simulator stage both link here via their "fullscreen viewer" control. Minimal
// chrome: an exit affordance (← / Esc), the simulator option toggles, a live
// elevator readout, the need legend, and a tap-to-inspect floor chip.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Floor, Incident } from "@/lib/types";
import type { SimOptions } from "@/components/BuildingSimulator";
import { defaultTwinModel } from "@/components/GltfBuilding";
import { needColor } from "@/lib/ui";

const BuildingSimulator = dynamic(() => import("@/components/BuildingSimulator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Booting ATLAS‑01…
    </div>
  ),
});

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

export default function FullscreenSimulator({
  floors,
  incidents,
}: {
  floors: Floor[];
  incidents: Incident[];
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [elevatorFloor, setElevatorFloor] = useState(0);
  const [options, setOptions] = useState<SimOptions>({
    night: false,
    cutaway: true,
    autoRotate: true,
    elevatorRunning: true,
    detailedModels: false,
    source: defaultTwinModel(),
  });
  // Single render-mode switch: "Pixel" = procedural voxel figures + pixelation;
  // off = crisp detailed glTF models. The two move together. Defaults to Pixel
  // here (and in the simulator) so first paint stays light — cloning the full
  // set of detailed residents on load janks navigation; the detailed look is
  // one tap away.
  const [pixel, setPixel] = useState(true);
  const togglePixel = useCallback(() => {
    setPixel((on) => {
      const next = !on;
      setOptions((o) => ({ ...o, detailedModels: !next }));
      return next;
    });
  }, []);
  const [ascii, setAscii] = useState(false);

  const set = useCallback(
    (patch: Partial<SimOptions>) => setOptions((o) => ({ ...o, ...patch })),
    [],
  );

  const exit = useCallback(() => {
    // Return to wherever the viewer was opened from; fall back to the simulator.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/simulator");
  }, [router]);

  // Esc closes the viewer (mirrors the in-page fullscreen UX it replaces).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  // Lock body scroll while the overlay owns the screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const selectedFloor = useMemo(
    () => floors.find((f) => f.key === selectedKey) ?? null,
    [floors, selectedKey],
  );

  const elevatorFloorName = floors[elevatorFloor]?.name ?? "—";

  return (
    <div
      data-testid="fullscreen-stage"
      className="fixed inset-0 z-[90] h-[100dvh] w-[100vw] overflow-hidden bg-ink-950"
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

      {/* Top bar: exit (+ title) on the left, option toggles on the right. A
          single flex row so the wrapping toggle cluster never overlaps exit. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exit}
            aria-label="Exit fullscreen viewer"
            title="Exit (Esc)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-600/70 bg-ink-900/80 text-slate-200 backdrop-blur transition-colors hover:bg-ink-800 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="pointer-events-none hidden text-xs text-slate-400 sm:block">
            <div className="display text-sm text-slate-200">ATLAS‑01 · Live Twin</div>
            <div>Orbit to inspect · tap a floor for telemetry</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-1 rounded-2xl border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
          <Toggle label={options.night ? "Night" : "Day"} active={options.night} onClick={() => set({ night: !options.night })} />
          <Toggle label="Cut-away" active={options.cutaway} onClick={() => set({ cutaway: !options.cutaway })} />
          <Toggle label="Pixel" active={pixel} onClick={togglePixel} />
          <Toggle label="ASCII" active={ascii} onClick={() => setAscii((a) => !a)} />
          <Toggle label="Orbit" active={options.autoRotate} onClick={() => set({ autoRotate: !options.autoRotate })} />
          <Toggle label="Elevator" active={options.elevatorRunning} onClick={() => set({ elevatorRunning: !options.elevatorRunning })} />
          <Toggle label="Hero" active={options.source === "gltf"} onClick={() => set({ source: options.source === "gltf" ? "voxel" : "gltf" })} />
        </div>
      </div>

      {/* Live elevator indicator + optional floor readout (bottom-left) */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/80 px-3 py-1.5 text-xs backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-info" />
          <span className="text-slate-400">Elevator</span>
          <span className="font-mono font-semibold text-white">{elevatorFloorName}</span>
        </div>
        {selectedFloor && (
          <div className="flex items-center gap-2 rounded-full border border-ink-600/70 bg-ink-900/80 px-3 py-1.5 text-xs backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: needColor[selectedFloor.need] }} />
            <span className="font-semibold text-white">{selectedFloor.name}</span>
            <span className="text-slate-400">Level {selectedFloor.level}</span>
          </div>
        )}
      </div>

      {/* Need legend (bottom-right, hidden on the narrowest phones) */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 hidden flex-wrap justify-end gap-x-3 gap-y-1 rounded-xl border border-ink-600/70 bg-ink-900/80 px-3 py-2 backdrop-blur sm:flex sm:max-w-[18rem]">
        {NEEDS.map(({ need, label }) => (
          <span key={need} className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: needColor[need] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
