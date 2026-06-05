"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Broadcast,
  BuildingKpis,
  Floor,
  FloorPresence,
  Incident,
  SensorPoint,
} from "@/lib/types";
import type { Recommendation } from "@/lib/advisor";
import type { AnalyticsSummary } from "@/lib/analytics";
import type { TwinMode } from "@/components/HabitatTwin";
import {
  CubeFocus,
  DotsNine,
  PersonSimpleWalk,
  TextT,
} from "@phosphor-icons/react";
import KpiStrip from "@/components/KpiStrip";
import FloorPanel from "@/components/FloorPanel";
import IncidentFeed from "@/components/IncidentFeed";
import BroadcastComposer from "@/components/BroadcastComposer";
import AdvisorPanel from "@/components/AdvisorPanel";
import FullscreenLink from "@/components/FullscreenLink";
import LogoLoader from "@/components/LogoLoader";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import Copilot from "@/components/Copilot";

// The twin is client/WebGL-only — load it without SSR.
const HabitatTwin = dynamic(() => import("@/components/HabitatTwin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <LogoLoader compact showWordmark={false} />
      <span className="sr-only">Loading Habitat Twin</span>
    </div>
  ),
});

function StageControlButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold transition-colors sm:w-auto sm:grid-cols-[auto_auto] sm:gap-1.5 sm:px-3 sm:py-1 ${
        active
          ? "bg-white text-ink-950"
          : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

type WindowId =
  | "habitat"
  | "metrics"
  | "incidents"
  | "blueprint"
  | "brand"
  | "broadcast"
  | "analytics"
  | "copilot"
  | "documents";

type WindowMode = "normal" | "minimized" | "maximized" | "fullscreen" | "closed";

type DesktopWindowState = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  mode: WindowMode;
};

type DesktopBounds = { width: number; height: number };

const DESKTOP_LAYOUT_KEY = "atlas-desktop-windows:v1";
const DESKTOP_BREAKPOINT = "(min-width: 1024px)";
const WINDOW_IDS: WindowId[] = [
  "habitat",
  "metrics",
  "incidents",
  "blueprint",
  "brand",
  "broadcast",
  "analytics",
  "copilot",
  "documents",
];

const DEFAULT_WINDOW_STATES: Record<WindowId, DesktopWindowState> = {
  habitat: { x: 300, y: 70, w: 780, h: 540, z: 8, mode: "normal" },
  metrics: { x: 1080, y: 70, w: 420, h: 330, z: 6, mode: "normal" },
  incidents: { x: 1080, y: 420, w: 420, h: 360, z: 7, mode: "normal" },
  blueprint: { x: 120, y: 450, w: 720, h: 350, z: 9, mode: "normal" },
  brand: { x: 780, y: 500, w: 650, h: 360, z: 10, mode: "normal" },
  broadcast: { x: 180, y: 130, w: 430, h: 300, z: 2, mode: "closed" },
  analytics: { x: 640, y: 120, w: 500, h: 520, z: 3, mode: "closed" },
  copilot: { x: 900, y: 150, w: 420, h: 520, z: 4, mode: "closed" },
  documents: { x: 180, y: 150, w: 540, h: 420, z: 5, mode: "closed" },
};

const WINDOW_TITLES: Record<WindowId, string> = {
  habitat: "Habitat Twin",
  metrics: "System Metrics",
  incidents: "Incident Feed",
  blueprint: "Blueprint",
  brand: "Brand Assets",
  broadcast: "Broadcast",
  analytics: "Analytics",
  copilot: "AI Copilot",
  documents: "Documents",
};

const WINDOW_SUBTITLES: Record<WindowId, string> = {
  habitat: "3D operations",
  metrics: "Live KPIs",
  incidents: "Security",
  blueprint: "Plan set",
  brand: "Local kit",
  broadcast: "Resident notice",
  analytics: "Advisory",
  copilot: "Observe and advise",
  documents: "PDF library",
};

function useDesktopBreakpoint(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_BREAKPOINT);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function isWindowMode(value: unknown): value is WindowMode {
  return (
    value === "normal" ||
    value === "minimized" ||
    value === "maximized" ||
    value === "fullscreen" ||
    value === "closed"
  );
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function windowChromeBounds(bounds: DesktopBounds): DesktopBounds {
  return {
    width: Math.max(bounds.width || 1440, 1024),
    height: Math.max(bounds.height || 820, 640),
  };
}

function clampWindowState(
  state: DesktopWindowState,
  bounds: DesktopBounds,
): DesktopWindowState {
  const safeBounds = windowChromeBounds(bounds);
  const maxWidth = Math.max(360, safeBounds.width - 32);
  const maxHeight = Math.max(260, safeBounds.height - 128);
  const w = clamp(state.w, 360, maxWidth);
  const h = clamp(state.h, 260, maxHeight);
  return {
    ...state,
    w,
    h,
    x: clamp(state.x, 16, safeBounds.width - w - 16),
    y: clamp(state.y, 54, safeBounds.height - h - 96),
  };
}

function mergeSavedWindowStates(): Record<WindowId, DesktopWindowState> {
  if (typeof window === "undefined") return DEFAULT_WINDOW_STATES;

  const raw = window.localStorage.getItem(DESKTOP_LAYOUT_KEY);
  if (!raw) return DEFAULT_WINDOW_STATES;

  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<WindowId, Partial<DesktopWindowState>>
    >;
    const next = { ...DEFAULT_WINDOW_STATES };
    for (const id of WINDOW_IDS) {
      const saved = parsed[id];
      const fallback = DEFAULT_WINDOW_STATES[id];
      if (!saved) continue;
      next[id] = {
        x: finiteNumber(saved.x, fallback.x),
        y: finiteNumber(saved.y, fallback.y),
        w: finiteNumber(saved.w, fallback.w),
        h: finiteNumber(saved.h, fallback.h),
        z: finiteNumber(saved.z, fallback.z),
        mode: isWindowMode(saved.mode) ? saved.mode : fallback.mode,
      };
    }
    return next;
  } catch {
    return DEFAULT_WINDOW_STATES;
  }
}

function getRenderRect(
  state: DesktopWindowState,
  bounds: DesktopBounds,
): Pick<DesktopWindowState, "x" | "y" | "w" | "h"> {
  const safeBounds = windowChromeBounds(bounds);
  if (state.mode === "fullscreen") {
    return {
      x: 0,
      y: 40,
      w: safeBounds.width,
      h: safeBounds.height - 40,
    };
  }
  if (state.mode === "maximized") {
    return {
      x: 18,
      y: 56,
      w: safeBounds.width - 36,
      h: safeBounds.height - 144,
    };
  }
  return clampWindowState(state, safeBounds);
}

function IconGlyph({ id, className = "" }: { id: WindowId | "zip"; className?: string }) {
  const common = "h-7 w-7";
  if (id === "brand") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M5 7h7v16H5Z" fill="currentColor" opacity="0.95" />
        <path d="M13 4h10v19H13Z" fill="currentColor" opacity="0.55" />
        <path d="M15 8h4v11h-4Z" fill="currentColor" opacity="0.95" />
      </svg>
    );
  }
  if (id === "blueprint") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <rect x="4" y="5" width="20" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 10h12M8 14h5m4 0h3M8 18h12M13 10v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
      </svg>
    );
  }
  if (id === "zip") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M8 3h9l5 5v17H8Z" fill="currentColor" opacity="0.9" />
        <path d="M17 3v6h5" fill="none" stroke="rgba(15,23,42,.55)" strokeWidth="1.5" />
        <path d="M11 6h3v2h-3Zm3 2h3v2h-3Zm-3 2h3v2h-3Zm3 2h3v2h-3Zm-3 2h3v2h-3Z" fill="rgba(15,23,42,.7)" />
      </svg>
    );
  }
  if (id === "documents") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M7 3h11l4 4v20H7Z" fill="currentColor" opacity="0.9" />
        <path d="M18 3v6h5M11 13h10M11 17h10M11 21h7" fill="none" stroke="rgba(15,23,42,.62)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "habitat") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M14 3 5 8v10l9 5 9-5V8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M5 8l9 5 9-5M14 13v10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      </svg>
    );
  }
  if (id === "metrics" || id === "analytics") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M5 21h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 18v-5m6 5V8m6 10v-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "incidents") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M14 4 3 23h22Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 10v6m0 4v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "broadcast") {
    return (
      <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
        <path d="M4 16h5l10-6v16L9 20H4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M21 13c1.5 1.4 1.5 3.8 0 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" className={`${common} ${className}`} aria-hidden>
      <path d="M8 21c4-1 3-5 6-5s2 4 6 5M9 10a5 5 0 0 1 10 0v2H9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 24h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BlueprintWindow() {
  const rows = [
    ["A0.0", "Cover Sheet", "General", "B", "Today"],
    ["A1.1", "Site Plan", "Architectural", "B", "May 19"],
    ["A2.1", "Level 02 Plan", "Architectural", "C", "Today"],
    ["A2.2", "Level 03 Plan", "Architectural", "C", "Today"],
    ["M2.1", "Level 02 MEP", "Mechanical", "B", "May 19"],
  ];

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(230px,0.9fr)_minmax(320px,1.1fr)] gap-3 p-3">
      <div className="relative overflow-hidden rounded-lg border border-signal-info/25 bg-slate-950">
        <div className="absolute inset-4 rounded border border-signal-info/30" />
        <div className="absolute inset-8 border-l border-t border-slate-500/30" />
        <div className="absolute left-12 top-14 h-24 w-24 rounded-sm border border-slate-400/40" />
        <div className="absolute right-12 top-16 h-28 w-28 rounded-sm border border-slate-400/40" />
        <div className="absolute bottom-12 left-16 right-16 h-24 rounded-sm border border-slate-400/40" />
        <div className="absolute left-1/2 top-10 h-[78%] w-px bg-signal-info/40" />
        <div className="absolute left-8 right-8 top-1/2 h-px bg-signal-info/40" />
        <div className="absolute bottom-4 left-4 rounded-full border border-slate-500/50 px-2 py-1 font-mono text-[10px] text-slate-300">
          A2.1 1:100
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border border-ink-600/50 bg-ink-950/35">
        <div className="grid grid-cols-[64px_1fr_110px_52px_76px] border-b border-ink-600/50 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <span>Sheet</span>
          <span>Name</span>
          <span>Discipline</span>
          <span>Rev.</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-ink-600/35">
          {rows.map((row) => (
            <button
              key={row[0]}
              type="button"
              className={`grid w-full grid-cols-[64px_1fr_110px_52px_76px] px-3 py-2 text-left text-xs transition-colors hover:bg-ink-800/70 ${
                row[0] === "A2.1" ? "bg-signal-info/20 text-white" : "text-slate-300"
              }`}
            >
              {row.map((cell) => (
                <span key={cell} className="truncate">
                  {cell}
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandAssetsWindow() {
  const files = [
    ["atlas_primary.svg", "SVG"],
    ["atlas_icon.png", "PNG"],
    ["palette.json", "JSON"],
    ["typography.pdf", "PDF"],
    ["brand_guidelines.pdf", "PDF"],
    ["texture_glass.jpg", "JPG"],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600/50 bg-ink-950/35 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">All Assets</p>
          <p className="text-xs text-slate-400">Synced locally for the ATLAS desktop.</p>
        </div>
        <a
          href="/api/brand/zip"
          download
          className="shrink-0 rounded-lg bg-signal-info px-3 py-1.5 text-xs font-bold text-ink-950 transition-opacity hover:opacity-90"
        >
          Download zip
        </a>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto scroll-thin">
        {files.map(([name, type], index) => (
          <div
            key={name}
            className="flex min-h-[94px] flex-col justify-between rounded-lg border border-ink-600/50 bg-ink-800/55 p-3"
          >
            <div className={`h-8 w-10 rounded ${index % 3 === 0 ? "bg-signal-info/80" : index % 3 === 1 ? "bg-signal-ok/80" : "bg-white/80"}`} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-100">{name}</p>
              <p className="text-[11px] text-slate-500">{type}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsWindow() {
  const docs = [
    ["Owners Project Requirements", "/documents#owners-project-requirements"],
    ["Privacy Policy", "/legal/privacy"],
    ["Terms of Service", "/legal/terms"],
    ["Data Processing Addendum", "/legal/dpa"],
  ];

  return (
    <div className="h-full overflow-y-auto p-4 scroll-thin">
      <div className="mb-3 rounded-lg border border-ink-600/50 bg-ink-950/35 p-3">
        <p className="text-sm font-semibold text-white">Local document set</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          PDFs and legal files stay reachable from the desktop without leaving the OS shell.
        </p>
      </div>
      <div className="grid gap-2">
        {docs.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="flex items-center justify-between rounded-lg border border-ink-600/50 bg-ink-800/50 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-ink-700/60 hover:text-white"
          >
            <span className="truncate">{label}</span>
            <span className="font-mono text-[11px] text-slate-500">PDF</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function DesktopFile({
  label,
  id,
  onOpen,
  href,
}: {
  label: string;
  id: WindowId | "zip";
  onOpen?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid h-14 w-14 place-items-center rounded-xl border border-white/15 bg-white/12 text-slate-100 shadow-lg backdrop-blur">
        <IconGlyph id={id} />
      </span>
      <span className="w-24 text-center text-xs font-semibold leading-tight text-white drop-shadow">
        {label}
      </span>
    </>
  );

  const classes =
    "group flex w-28 flex-col items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info";

  if (href) {
    return (
      <a href={href} download className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={classes}>
      {content}
    </button>
  );
}

function DockButton({
  id,
  active,
  minimized,
  onClick,
}: {
  id: WindowId;
  active: boolean;
  minimized: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Restore ${WINDOW_TITLES[id]} window`}
      data-testid="desktop-dock-item"
      data-window-id={id}
      className={`group relative grid h-12 w-12 place-items-center rounded-xl border transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info ${
        active
          ? "border-white/25 bg-white text-ink-950"
          : "border-white/10 bg-white/12 text-slate-100 hover:bg-white/20"
      }`}
    >
      <IconGlyph id={id} className="h-6 w-6" />
      {(active || minimized) && (
        <span
          aria-hidden
          className={`absolute -bottom-1 h-1.5 w-1.5 rounded-full ${
            minimized ? "bg-signal-warn" : "bg-signal-info"
          }`}
        />
      )}
    </button>
  );
}

export default function Console({
  initialFloors,
  initialIncidents,
  initialBroadcasts,
  initialKpis,
  initialAnalytics,
  initialSensors,
  dbConnected,
}: {
  initialFloors: Floor[];
  initialIncidents: Incident[];
  initialBroadcasts: Broadcast[];
  initialKpis: BuildingKpis;
  initialAnalytics: AnalyticsSummary;
  initialSensors: SensorPoint[];
  dbConnected: boolean;
}) {
  const [floors] = useState<Floor[]>(initialFloors);
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [kpis, setKpis] = useState<BuildingKpis>(initialKpis);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<TwinMode>("orbit");
  // Render-mode switch: "Pixel" = retro pixel/poly look; off = crisp detailed
  // (glTF) rendering. Mirrors the Simulator's single switch.
  const [pixel, setPixel] = useState(false);
  const [ascii, setAscii] = useState(false);
  // F-RuView: keyed presence map (floorKey → FloorPresence). Empty until first fetch.
  const [presence, setPresence] = useState<Record<string, FloorPresence>>({});
  // F-Advisor: ranked operational recommendations (heuristic or AI).
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const selectedFloor = useMemo(
    () => floors.find((f) => f.key === selectedKey) ?? null,
    [floors, selectedKey],
  );

  const refresh = useCallback(async () => {
    try {
      const [incRes, kpiFloors] = await Promise.all([
        fetch("/api/incidents", { cache: "no-store" }),
        fetch("/api/floors", { cache: "no-store" }),
      ]);
      if (incRes.ok) {
        const { incidents } = (await incRes.json()) as { incidents: Incident[] };
        setIncidents(incidents);
        // Recompute the two incident-derived KPIs client-side.
        setKpis((prev) => ({
          ...prev,
          openIncidents: incidents.filter(
            (i) => i.severity === "crit" || i.severity === "warn",
          ).length,
        }));
      }
      void kpiFloors;
    } catch {
      /* keep last-known state on transient failure */
    }

    // F-RuView: fetch presence layer separately so a failure here never
    // disrupts the incidents/floors refresh above.
    fetch("/api/presence", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const { presence: list } = (await res.json()) as {
          presence: FloorPresence[];
        };
        const keyed = Object.fromEntries(list.map((p) => [p.floorKey, p]));
        setPresence(keyed);
      })
      .catch(() => {
        /* keep last-known presence on transient failure */
      });

    // F-Advisor: fetch advisor recommendations separately so a failure here
    // never disrupts incidents, floors, or presence.
    fetch("/api/advisor", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const { recommendations: recs } = (await res.json()) as {
          recommendations: Recommendation[];
        };
        setRecommendations(recs);
      })
      .catch(() => {
        /* keep last-known recommendations on transient failure */
      });
  }, []);

  // Light polling so the feed feels live.
  useEffect(() => {
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const startWalkthrough = useCallback(() => {
    setSelectedKey(null);
    setMode("walkthrough");
  }, []);

  const isDesktop = useDesktopBreakpoint();

  if (isDesktop) {
    return (
      <AtlasDesktop
        floors={floors}
        incidents={incidents}
        kpis={kpis}
        selectedKey={selectedKey}
        selectedFloor={selectedFloor}
        mode={mode}
        pixel={pixel}
        ascii={ascii}
        presence={presence}
        dbConnected={dbConnected}
        initialAnalytics={initialAnalytics}
        initialSensors={initialSensors}
        onSelectFloor={setSelectedKey}
        onSetMode={setMode}
        onSetPixel={setPixel}
        onSetAscii={setAscii}
        onStartWalkthrough={startWalkthrough}
        onRefresh={refresh}
      />
    );
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">
            ATLAS&nbsp;OS
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            One floor per human need, run by software.{" "}
            <span className="important">This is the future of housing.</span>
          </p>
        </div>
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
      </header>

      {/* KPI strip (F5) */}
      <KpiStrip kpis={kpis} />

      {/* Main grid: twin (F1) + floor panel (F2) | feed (F3) + broadcast (F4) */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="flex flex-col gap-4">
          <div
            data-testid="twin-stage"
            className="panel relative h-[920px] overflow-hidden bg-ink-950 lg:h-[760px]"
          >
            <HabitatTwin
              floors={floors}
              incidents={incidents}
              selectedKey={selectedKey}
              mode={mode}
              pixel={pixel}
              ascii={ascii}
              onSelect={setSelectedKey}
              onWalkthroughEnd={() => setMode("orbit")}
            />

            {/* Controls — iOS-style segmented mode buttons + fullscreen toggle */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
              <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <StageControlButton
                  active={mode === "orbit"}
                  label="Orbit"
                  onClick={() => setMode("orbit")}
                >
                  <CubeFocus aria-hidden weight="duotone" className="h-4 w-4" />
                </StageControlButton>
                <StageControlButton
                  active={mode === "walkthrough"}
                  label="Walk-through"
                  onClick={startWalkthrough}
                >
                  <PersonSimpleWalk
                    aria-hidden
                    weight="duotone"
                    className="h-4 w-4"
                  />
                </StageControlButton>
              </div>
              <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <StageControlButton
                  active={pixel}
                  label="Pixel"
                  onClick={() => setPixel((p) => !p)}
                >
                  <DotsNine aria-hidden weight="duotone" className="h-4 w-4" />
                </StageControlButton>
                <StageControlButton
                  active={ascii}
                  label="ASCII"
                  onClick={() => setAscii((a) => !a)}
                >
                  <TextT aria-hidden weight="duotone" className="h-4 w-4" />
                </StageControlButton>
              </div>
              <FullscreenLink />
            </div>
          </div>
          <FloorPanel
            floor={selectedFloor}
            incidents={incidents}
            presence={selectedKey ? presence[selectedKey] : undefined}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="h-[360px] lg:h-[460px]">
            <IncidentFeed
              incidents={incidents}
              floors={floors}
              onSelectFloor={(key) => {
                setMode("orbit");
                setSelectedKey(key);
              }}
              selectedKey={selectedKey}
            />
          </div>
          {/* F-Advisor: AI Ops Advisor panel — additive, below the incident feed */}
          <div className="min-h-[200px]">
            <AdvisorPanel recommendations={recommendations} />
          </div>
          <BroadcastComposer floors={floors} onSent={refresh} />

          {/* Analytics + anomaly detection (advisory only, per OPR §4) */}
          <AnalyticsPanel summary={initialAnalytics} sensors={initialSensors} />

          {/* AI ops copilot — observe-and-advise over live telemetry */}
          <div className="h-[460px]">
            <Copilot />
          </div>
        </section>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes,
        but never overrides safety.
      </footer>
    </main>
  );
}

function AtlasDesktop({
  floors,
  incidents,
  kpis,
  selectedKey,
  selectedFloor,
  mode,
  pixel,
  ascii,
  presence,
  dbConnected,
  initialAnalytics,
  initialSensors,
  onSelectFloor,
  onSetMode,
  onSetPixel,
  onSetAscii,
  onStartWalkthrough,
  onRefresh,
}: {
  floors: Floor[];
  incidents: Incident[];
  kpis: BuildingKpis;
  selectedKey: string | null;
  selectedFloor: Floor | null;
  mode: TwinMode;
  pixel: boolean;
  ascii: boolean;
  presence: Record<string, FloorPresence>;
  dbConnected: boolean;
  initialAnalytics: AnalyticsSummary;
  initialSensors: SensorPoint[];
  onSelectFloor: (key: string | null) => void;
  onSetMode: (mode: TwinMode) => void;
  onSetPixel: React.Dispatch<React.SetStateAction<boolean>>;
  onSetAscii: React.Dispatch<React.SetStateAction<boolean>>;
  onStartWalkthrough: () => void;
  onRefresh: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: WindowId;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const loadedRef = useRef(false);
  const [bounds, setBounds] = useState<DesktopBounds>({
    width: 1440,
    height: 820,
  });
  const [windows, setWindows] = useState<Record<WindowId, DesktopWindowState>>(
    DEFAULT_WINDOW_STATES,
  );
  const [activeWindow, setActiveWindow] = useState<WindowId>("brand");

  useEffect(() => {
    setWindows(mergeSavedWindowStates());
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    const measure = () => {
      const node = shellRef.current;
      if (!node) return;
      setBounds({ width: node.clientWidth, height: node.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    setWindows((current) => {
      const next = { ...current };
      for (const id of WINDOW_IDS) {
        next[id] = clampWindowState(next[id], bounds);
      }
      return next;
    });
  }, [bounds]);

  useEffect(() => {
    if (!loadedRef.current) return;
    window.localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(windows));
  }, [windows]);

  const nextZ = useCallback((state: Record<WindowId, DesktopWindowState>) => {
    return Math.max(...Object.values(state).map((win) => win.z)) + 1;
  }, []);

  const bringToFront = useCallback(
    (id: WindowId) => {
      setActiveWindow(id);
      setWindows((current) => ({
        ...current,
        [id]: { ...current[id], z: nextZ(current) },
      }));
    },
    [nextZ],
  );

  const openWindow = useCallback(
    (id: WindowId) => {
      setActiveWindow(id);
      setWindows((current) => {
        const currentWindow = current[id];
        return {
          ...current,
          [id]: {
            ...currentWindow,
            mode:
              currentWindow.mode === "closed" || currentWindow.mode === "minimized"
                ? "normal"
                : currentWindow.mode,
            z: nextZ(current),
          },
        };
      });
    },
    [nextZ],
  );

  const updateWindowMode = useCallback(
    (id: WindowId, mode: WindowMode) => {
      setActiveWindow(id);
      setWindows((current) => ({
        ...current,
        [id]: {
          ...current[id],
          mode,
          z: mode === "minimized" || mode === "closed" ? current[id].z : nextZ(current),
        },
      }));
    },
    [nextZ],
  );

  const toggleMaximize = useCallback(
    (id: WindowId) => {
      setWindows((current) => ({
        ...current,
        [id]: {
          ...current[id],
          mode: current[id].mode === "maximized" ? "normal" : "maximized",
          z: nextZ(current),
        },
      }));
      setActiveWindow(id);
    },
    [nextZ],
  );

  const toggleFullscreen = useCallback(
    (id: WindowId) => {
      setWindows((current) => ({
        ...current,
        [id]: {
          ...current[id],
          mode: current[id].mode === "fullscreen" ? "normal" : "fullscreen",
          z: nextZ(current),
        },
      }));
      setActiveWindow(id);
    },
    [nextZ],
  );

  const resetLayout = useCallback(() => {
    window.localStorage.removeItem(DESKTOP_LAYOUT_KEY);
    setWindows(DEFAULT_WINDOW_STATES);
    setActiveWindow("brand");
  }, []);

  const onTitlePointerDown = useCallback(
    (id: WindowId, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const win = windows[id];
      if (win.mode !== "normal") {
        bringToFront(id);
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        originX: win.x,
        originY: win.y,
      };
      bringToFront(id);
    },
    [bringToFront, windows],
  );

  const onTitlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setWindows((current) => {
        const win = current[drag.id];
        if (win.mode !== "normal") return current;
        const moved = clampWindowState(
          {
            ...win,
            x: drag.originX + dx,
            y: drag.originY + dy,
          },
          bounds,
        );
        return { ...current, [drag.id]: moved };
      });
    },
    [bounds],
  );

  const onTitlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const renderWindowContent = (id: WindowId) => {
    if (id === "habitat") {
      return (
        <div data-testid="twin-stage" className="relative h-full min-h-[340px] overflow-hidden bg-ink-950">
          <HabitatTwin
            floors={floors}
            incidents={incidents}
            selectedKey={selectedKey}
            mode={mode}
            pixel={pixel}
            ascii={ascii}
            onSelect={onSelectFloor}
            onWalkthroughEnd={() => onSetMode("orbit")}
          />
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
              <StageControlButton
                active={mode === "orbit"}
                label="Orbit"
                onClick={() => onSetMode("orbit")}
              >
                <CubeFocus aria-hidden weight="duotone" className="h-4 w-4" />
              </StageControlButton>
              <StageControlButton
                active={mode === "walkthrough"}
                label="Walk-through"
                onClick={onStartWalkthrough}
              >
                <PersonSimpleWalk aria-hidden weight="duotone" className="h-4 w-4" />
              </StageControlButton>
            </div>
            <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
              <StageControlButton
                active={pixel}
                label="Pixel"
                onClick={() => onSetPixel((value) => !value)}
              >
                <DotsNine aria-hidden weight="duotone" className="h-4 w-4" />
              </StageControlButton>
              <StageControlButton
                active={ascii}
                label="ASCII"
                onClick={() => onSetAscii((value) => !value)}
              >
                <TextT aria-hidden weight="duotone" className="h-4 w-4" />
              </StageControlButton>
            </div>
            <FullscreenLink />
          </div>
        </div>
      );
    }

    if (id === "metrics") {
      return (
        <div className="h-full overflow-y-auto p-3 scroll-thin">
          <KpiStrip kpis={kpis} />
        </div>
      );
    }

    if (id === "incidents") {
      return (
        <IncidentFeed
          incidents={incidents}
          floors={floors}
          onSelectFloor={(key) => {
            onSetMode("orbit");
            onSelectFloor(key);
          }}
          selectedKey={selectedKey}
        />
      );
    }

    if (id === "blueprint") return <BlueprintWindow />;
    if (id === "brand") return <BrandAssetsWindow />;
    if (id === "documents") return <DocumentsWindow />;

    if (id === "broadcast") {
      return (
        <div className="h-full overflow-y-auto p-4 scroll-thin">
          <BroadcastComposer floors={floors} onSent={onRefresh} />
        </div>
      );
    }

    if (id === "analytics") {
      return <AnalyticsPanel summary={initialAnalytics} sensors={initialSensors} />;
    }

    return <Copilot />;
  };

  return (
    <main
      id="main"
      ref={shellRef}
      data-testid="desktop-shell"
      className="atlas-desktop-shell relative h-[calc(100vh-4rem)] min-h-[760px] overflow-hidden bg-ink-950 text-slate-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_75%_at_72%_20%,rgba(78,168,255,0.22),transparent_58%),radial-gradient(48%_55%_at_20%_88%,rgba(93,220,122,0.12),transparent_62%),linear-gradient(140deg,#05080d_0%,#08111c_46%,#020407_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div
        data-testid="desktop-menubar"
        className="relative z-[70] flex h-10 items-center justify-between border-b border-white/10 bg-ink-950/55 px-5 text-sm text-slate-200 backdrop-blur-xl"
      >
        <div className="flex items-center gap-6">
          <h1 className="display text-sm font-extrabold text-white">ATLAS OS</h1>
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Spaces</span>
          <span>Window</span>
        </div>
        <div className="flex items-center gap-4 font-medium">
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-md px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
          >
            Reset layout
          </button>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dbConnected ? "bg-signal-ok" : "bg-slate-500"}`} />
            {dbConnected ? "Database connected" : "Seed data (local-first)"}
          </span>
          <span>Local</span>
        </div>
      </div>

      <div className="absolute left-5 top-16 z-10 flex flex-col gap-4">
        <DesktopFile label="Blueprint" id="blueprint" onOpen={() => openWindow("blueprint")} />
        <DesktopFile label="Brand Assets" id="brand" onOpen={() => openWindow("brand")} />
        <DesktopFile label="ZIP Archive" id="zip" href="/api/brand/zip" />
        <DesktopFile label="Documents" id="documents" onOpen={() => openWindow("documents")} />
      </div>

      <div data-testid="desktop-window-manager" className="absolute inset-0 z-20">
        {WINDOW_IDS.map((id) => {
          const state = windows[id];
          if (state.mode === "closed" || state.mode === "minimized") return null;
          const rect = getRenderRect(state, bounds);
          const active = activeWindow === id;
          return (
            <section
              key={id}
              data-testid="desktop-window"
              data-window-id={id}
              data-active={active ? "true" : "false"}
              onMouseDown={() => bringToFront(id)}
              className={`absolute flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl transition-shadow ${
                active
                  ? "border-white/24 bg-ink-900/86 shadow-black/55"
                  : "border-white/12 bg-ink-900/72 shadow-black/35"
              }`}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                zIndex: state.z,
              }}
            >
              <div
                data-testid="desktop-window-titlebar"
                data-window-id={id}
                role="toolbar"
                aria-label={`Move ${WINDOW_TITLES[id]} window`}
                onPointerDown={(event) => onTitlePointerDown(id, event)}
                onPointerMove={onTitlePointerMove}
                onPointerUp={onTitlePointerUp}
                onPointerCancel={onTitlePointerUp}
                className={`flex h-11 shrink-0 select-none items-center gap-3 border-b border-white/10 bg-white/[0.055] px-3 ${
                  state.mode === "normal" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                }`}
              >
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Close ${WINDOW_TITLES[id]} window`}
                    data-testid="window-close"
                    data-window-id={id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => updateWindowMode(id, "closed")}
                    className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-black/20"
                  />
                  <button
                    type="button"
                    aria-label={`Minimize ${WINDOW_TITLES[id]} window`}
                    data-testid="window-minimize"
                    data-window-id={id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => updateWindowMode(id, "minimized")}
                    className="h-3 w-3 rounded-full bg-[#ffbd2e] ring-1 ring-black/20"
                  />
                  <button
                    type="button"
                    aria-label={`Maximize ${WINDOW_TITLES[id]} window`}
                    data-testid="window-maximize"
                    data-window-id={id}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => toggleMaximize(id)}
                    className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-black/20"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{WINDOW_TITLES[id]}</p>
                  <p className="truncate text-[11px] text-slate-500">{WINDOW_SUBTITLES[id]}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Fullscreen ${WINDOW_TITLES[id]} window`}
                  data-testid="window-fullscreen"
                  data-window-id={id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => toggleFullscreen(id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
                >
                  <span aria-hidden className="text-base leading-none">□</span>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{renderWindowContent(id)}</div>
            </section>
          );
        })}
      </div>

      <div
        data-testid="desktop-dock"
        className="absolute bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/14 bg-ink-950/48 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        {WINDOW_IDS.map((id) => (
          <DockButton
            key={id}
            id={id}
            active={windows[id].mode !== "closed" && windows[id].mode !== "minimized"}
            minimized={windows[id].mode === "minimized"}
            onClick={() => openWindow(id)}
          />
        ))}
      </div>
    </main>
  );
}
