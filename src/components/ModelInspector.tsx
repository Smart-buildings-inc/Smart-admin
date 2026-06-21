"use client";

import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { Floor, Incident } from "@/lib/types";
import { needColor } from "@/lib/ui";

// ── Inspector state types ───────────────────────────────────────────────

export interface InspectorTransform {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
}

export interface InspectorMaterial {
  wireframe: boolean;
  opacity: number;
  accentTint: string;
}

export interface InspectorAnimation {
  playing: boolean;
  speed: number;
  loop: boolean;
  activeClip: string | null;
}

export interface FloorModelInfo {
  triangles: number;
  textureMemMB: number;
  objectCount: number;
  materialCount: number;
}

export interface InspectorActions {
  onScreenshot: () => void;
  onResetCamera: () => void;
  onToggleAutoRotate: () => void;
  autoRotate: boolean;
}

export const DEFAULT_TRANSFORM: InspectorTransform = {
  positionX: 0,
  positionY: 0.04,
  positionZ: 0,
  rotationY: 0,
  scale: 1.35,
};

export const DEFAULT_MATERIAL: InspectorMaterial = {
  wireframe: false,
  opacity: 1,
  accentTint: "#ffffff",
};

export const DEFAULT_ANIMATION: InspectorAnimation = {
  playing: false,
  speed: 1,
  loop: true,
  activeClip: null,
};

const SAMPLE_ANIMATIONS = ["Spin", "Blink", "Sway", "Breathe", "Pulse"];
const EMPTY_MODEL_INFO: FloorModelInfo = {
  triangles: 0,
  textureMemMB: 0,
  objectCount: 0,
  materialCount: 0,
};

// ── Helper: derive floor status from incidents ─────────────────────────

function floorStatus(
  floorKey: string,
  incidents: Incident[],
): "ok" | "warn" | "crit" {
  const floorIncidents = incidents.filter(
    (i) => i.floorKey === floorKey,
  );
  if (floorIncidents.some((i) => i.severity === "crit")) return "crit";
  if (floorIncidents.some((i) => i.severity === "warn")) return "warn";
  return "ok";
}

function statusColor(status: "ok" | "warn" | "crit"): string {
  if (status === "crit") return "#ff5d5d";
  if (status === "warn") return "#ffb340";
  return "#3ddc97";
}

// ── Sub-components ──────────────────────────────────────────────────────

function AccordionSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink-600/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-200 transition-colors"
      >
        {title}
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min = -100,
  max = 100,
  step = 0.1,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const fixed = step < 1 ? 1 : 0;

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-[10px] font-medium uppercase text-slate-500">
        {label}
      </span>
      <div className="flex flex-1 items-center rounded-md border border-ink-600/50 bg-ink-800/60">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="grid h-7 w-6 place-items-center text-xs text-slate-400 hover:text-white transition-colors rounded-l-md hover:bg-ink-700/60"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(clamp(v));
          }}
          className="h-7 w-full min-w-0 bg-transparent text-center font-mono text-xs text-white [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="grid h-7 w-6 place-items-center text-xs text-slate-400 hover:text-white transition-colors rounded-r-md hover:bg-ink-700/60"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      {suffix && (
        <span className="w-4 text-right text-[10px] text-slate-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  suffix = "",
  onReset,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase text-slate-500 w-14 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-ink-600 accent-signal-info"
        aria-label={label}
      />
      <span className="w-10 text-right font-mono text-[11px] text-white tabular-nums">
        {value.toFixed(step < 1 ? 2 : 0)}
        {suffix}
      </span>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-white hover:bg-ink-700/60 transition-colors"
          aria-label={`Reset ${label}`}
        >
          reset
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function ModelInspector({
  floors,
  incidents,
  selectedKey,
  onSelectFloor,
  transform,
  onChangeTransform,
  material,
  onChangeMaterial,
  animation,
  onChangeAnimation,
  modelInfo = EMPTY_MODEL_INFO,
  actions,
  open,
  onToggleOpen,
}: {
  floors: Floor[];
  incidents: Incident[];
  selectedKey: string | null;
  onSelectFloor: (key: string | null) => void;
  transform: InspectorTransform;
  onChangeTransform: (t: InspectorTransform) => void;
  material: InspectorMaterial;
  onChangeMaterial: (m: InspectorMaterial) => void;
  animation: InspectorAnimation;
  onChangeAnimation: (a: InspectorAnimation) => void;
  modelInfo?: FloorModelInfo;
  actions: InspectorActions;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const selectedFloor = useMemo(
    () => floors.find((f) => f.key === selectedKey) ?? null,
    [floors, selectedKey],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Floor statuses derived from incidents
  const floorStatuses = useMemo(() => {
    const map = new Map<string, "ok" | "warn" | "crit">();
    floors.forEach((f) => map.set(f.key, floorStatus(f.key, incidents)));
    return map;
  }, [floors, incidents]);

  // Transform setters
  const setTransform = useCallback(
    (patch: Partial<InspectorTransform>) => {
      onChangeTransform({ ...transform, ...patch });
    },
    [transform, onChangeTransform],
  );

  const resetTransform = useCallback(() => {
    onChangeTransform({ ...DEFAULT_TRANSFORM });
  }, [onChangeTransform]);

  // Material setters
  const setMaterial = useCallback(
    (patch: Partial<InspectorMaterial>) => {
      onChangeMaterial({ ...material, ...patch });
    },
    [material, onChangeMaterial],
  );

  const resetMaterial = useCallback(() => {
    onChangeMaterial({ ...DEFAULT_MATERIAL });
  }, [onChangeMaterial]);

  // Animation setters
  const setAnim = useCallback(
    (patch: Partial<InspectorAnimation>) => {
      onChangeAnimation({ ...animation, ...patch });
    },
    [animation, onChangeAnimation],
  );

  // Derive accent hex from floor
  const floorAccent = selectedFloor ? needColor[selectedFloor.need] : "#4ea8ff";

  // Aesthetic floor sort: by level, bottom→top
  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.level - b.level),
    [floors],
  );

  return (
    <>
      {/* Toggle tab button — always visible */}
      <button
        type="button"
        onClick={onToggleOpen}
        aria-label={open ? "Close inspector" : "Open inspector"}
        aria-expanded={open}
        className={`absolute right-0 top-32 z-20 flex h-10 items-center gap-1.5 rounded-l-lg border border-r-0 border-ink-600/60 bg-ink-900/90 px-2.5 text-xs font-semibold text-slate-300 backdrop-blur transition-all hover:text-white ${
          open ? "translate-x-0" : "-translate-x-0"
        }`}
        style={{
          transform: open ? "translateX(0)" : "translateX(calc(100% - 320px))",
          right: open ? "calc(320px + 0.5rem)" : "0.5rem",
        }}
      >
        <svg
          viewBox="0 0 14 14"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 2l5 5-5 5" />
        </svg>
        <span className="hidden sm:inline">Rig</span>
      </button>

      {/* Side panel */}
      <aside
        className={`absolute right-1 top-2 bottom-2 z-20 w-[320px] flex-col overflow-hidden rounded-xl border border-ink-600/60 bg-ink-900/95 shadow-elevation-4 backdrop-blur-lg transition-all duration-300 ${
          open ? "flex opacity-100 translate-x-0" : "hidden opacity-0 translate-x-4"
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-600/40 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-white">Model Rigging</h2>
            <p className="text-[10px] text-slate-500">
              Inspect &amp; control the 3D model
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-white hover:bg-ink-800/60 transition-colors"
            aria-label="Close inspector"
          >
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {/* ── 0. No floor selected placeholder ── */}
          {!selectedFloor && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <svg
                viewBox="0 0 40 40"
                className="mb-3 h-12 w-12 text-slate-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="6" y="4" width="28" height="32" rx="3" />
                <path d="M10 14h20M10 20h14m4 0h2M10 26h20" />
              </svg>
              <p className="text-sm font-semibold text-slate-400">
                No floor selected
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Select a floor in the 3D view or use the buttons below.
              </p>
            </div>
          )}

          {/* Select a floor when none selected — show grid */}
          {!selectedFloor && (
            <div className="px-4 pb-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Quick select
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {sortedFloors.map((floor) => {
                  const status = floorStatuses.get(floor.key) ?? "ok";
                  const accent = needColor[floor.need];
                  return (
                    <button
                      key={floor.key}
                      type="button"
                      onClick={() => onSelectFloor(floor.key)}
                      className="flex items-center gap-2 rounded-lg border border-ink-600/40 bg-ink-800/40 px-2.5 py-2 text-left transition-colors hover:border-ink-500/60 hover:bg-ink-800/70"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200">
                        {floor.name}
                      </span>
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: statusColor(status) }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full inspector content when a floor is selected */}
          {selectedFloor && (
            <>
              {/* ── 1. Floor Selector ── */}
              <AccordionSection title="Floor Selector" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-1.5">
                  {sortedFloors.map((floor) => {
                    const active = floor.key === selectedKey;
                    const status = floorStatuses.get(floor.key) ?? "ok";
                    const accent = needColor[floor.need];
                    return (
                      <button
                        key={floor.key}
                        type="button"
                        onClick={() => onSelectFloor(floor.key)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                          active
                            ? "border-white/30 bg-white/15 shadow-glow-accent"
                            : "border-ink-600/40 bg-ink-800/40 hover:border-ink-500/60 hover:bg-ink-800/70"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200">
                          {floor.name}
                        </span>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: active ? "#3ddc97" : statusColor(status),
                          }}
                          title={status.toUpperCase()}
                        />
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* ── 2. Transform Controls ── */}
              <AccordionSection title="Transform" defaultOpen={true}>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Position
                    </p>
                    <NumberStepper
                      label="X"
                      value={transform.positionX}
                      min={-10}
                      max={10}
                      onChange={(v) => setTransform({ positionX: v })}
                    />
                    <NumberStepper
                      label="Y"
                      value={transform.positionY}
                      min={-10}
                      max={10}
                      onChange={(v) => setTransform({ positionY: v })}
                    />
                    <NumberStepper
                      label="Z"
                      value={transform.positionZ}
                      min={-10}
                      max={10}
                      onChange={(v) => setTransform({ positionZ: v })}
                    />
                  </div>
                  <SliderControl
                    label="Rotate Y"
                    value={transform.rotationY}
                    min={-180}
                    max={180}
                    step={1}
                    suffix="°"
                    onChange={(v) => setTransform({ rotationY: v })}
                    onReset={() => setTransform({ rotationY: 0 })}
                  />
                  <SliderControl
                    label="Scale"
                    value={transform.scale}
                    min={0.5}
                    max={3}
                    step={0.01}
                    suffix="x"
                    onChange={(v) => setTransform({ scale: v })}
                    onReset={() => setTransform({ scale: 1.35 })}
                  />
                  <button
                    type="button"
                    onClick={resetTransform}
                    className="w-full rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-1.5 text-center text-[11px] font-semibold text-slate-300 transition-colors hover:bg-ink-700/60 hover:text-white"
                  >
                    Reset All
                  </button>
                </div>
              </AccordionSection>

              {/* ── 3. Material Override ── */}
              <AccordionSection title="Material" defaultOpen={true}>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={material.wireframe}
                      onChange={(e) => setMaterial({ wireframe: e.target.checked })}
                      className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-signal-info"
                    />
                    <span className="text-[11px] text-slate-300">Wireframe overlay</span>
                  </label>

                  <SliderControl
                    label="Opacity"
                    value={material.opacity}
                    min={0.1}
                    max={1}
                    step={0.01}
                    onChange={(v) => setMaterial({ opacity: v })}
                    onReset={() => setMaterial({ opacity: 1 })}
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase text-slate-500">
                      Accent
                    </span>
                    <label className="relative flex-1">
                      <input
                        ref={fileInputRef}
                        type="color"
                        value={material.accentTint}
                        onChange={(e) =>
                          setMaterial({ accentTint: e.target.value })
                        }
                        className="h-7 w-full cursor-pointer rounded-md border border-ink-600/50 bg-ink-800/60"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={resetMaterial}
                    className="w-full rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-1.5 text-center text-[11px] font-semibold text-slate-300 transition-colors hover:bg-ink-700/60 hover:text-white"
                  >
                    Reset Materials
                  </button>
                </div>
              </AccordionSection>

              {/* ── 4. Animation Controls ── */}
              <AccordionSection title="Animation" defaultOpen={false}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnim({ playing: !animation.playing })}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                        animation.playing
                          ? "border-signal-ok/40 bg-signal-ok/15 text-signal-ok"
                          : "border-ink-600/50 bg-ink-800/50 text-slate-300 hover:bg-ink-700/60 hover:text-white"
                      }`}
                    >
                      {animation.playing ? "Pause" : "Play"}
                    </button>
                  </div>

                  <SliderControl
                    label="Speed"
                    value={animation.speed}
                    min={0.1}
                    max={5}
                    step={0.1}
                    suffix="x"
                    onChange={(v) => setAnim({ speed: v })}
                    onReset={() => setAnim({ speed: 1 })}
                  />

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={animation.loop}
                      onChange={(e) => setAnim({ loop: e.target.checked })}
                      className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-signal-info"
                    />
                    <span className="text-[11px] text-slate-300">Loop</span>
                  </label>

                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Available clips
                    </p>
                    <div className="space-y-1">
                      {SAMPLE_ANIMATIONS.map((clip) => {
                        const active = animation.activeClip === clip;
                        return (
                          <button
                            key={clip}
                            type="button"
                            onClick={() =>
                              setAnim({
                                activeClip: active ? null : clip,
                                playing: !active,
                              })
                            }
                            className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                              active
                                ? "border-signal-info/40 bg-signal-info/15 text-signal-info"
                                : "border-ink-600/40 bg-ink-800/40 text-slate-300 hover:border-ink-500/60"
                            }`}
                          >
                            <svg
                              viewBox="0 0 12 12"
                              className="h-3 w-3 shrink-0"
                              fill="currentColor"
                            >
                              {active ? (
                                <rect x="2" y="2" width="3" height="8" rx="0.5" />
                              ) : (
                                <polygon points="3,2 10,6 3,10" />
                              )}
                            </svg>
                            <span className="text-[11px] font-medium">{clip}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </AccordionSection>

              {/* ── 5. Info Panel ── */}
              <AccordionSection title="Model Info" defaultOpen={false}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: floorAccent }}
                    />
                    <span className="text-sm font-semibold text-white">
                      {selectedFloor.name}
                    </span>
                  </div>
                  <p className="kpi-label">Floor Key: {selectedFloor.key}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-lg border border-ink-600/40 bg-ink-800/40 px-2.5 py-2">
                      <div className="kpi-label">Triangles</div>
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {modelInfo.triangles.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink-600/40 bg-ink-800/40 px-2.5 py-2">
                      <div className="kpi-label">Texture Mem</div>
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {modelInfo.textureMemMB.toFixed(1)} MB
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink-600/40 bg-ink-800/40 px-2.5 py-2">
                      <div className="kpi-label">Objects</div>
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {modelInfo.objectCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-ink-600/40 bg-ink-800/40 px-2.5 py-2">
                      <div className="kpi-label">Materials</div>
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {modelInfo.materialCount}
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              {/* ── 6. Export Controls ── */}
              <AccordionSection title="View &amp; Export" defaultOpen={false}>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={actions.onScreenshot}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-signal-info/40 bg-signal-info/15 px-3 py-2 text-[11px] font-semibold text-signal-info transition-colors hover:bg-signal-info/25"
                  >
                    <svg
                      viewBox="0 0 14 14"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="1.5" y="3.5" width="11" height="9" rx="1.5" />
                      <circle cx="7" cy="7" r="2" />
                    </svg>
                    Screenshot
                  </button>

                  <button
                    type="button"
                    onClick={actions.onResetCamera}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-ink-700/60 hover:text-white"
                  >
                    <svg
                      viewBox="0 0 14 14"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M7 3v8M3 7h8M1 13l4-4m8-4l-4 4" />
                    </svg>
                    Reset Camera
                  </button>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actions.autoRotate}
                      onChange={actions.onToggleAutoRotate}
                      className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-signal-info"
                    />
                    <span className="text-[11px] text-slate-300">Auto-Rotate</span>
                  </label>
                </div>
              </AccordionSection>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
