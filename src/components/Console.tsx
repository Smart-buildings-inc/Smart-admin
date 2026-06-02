"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFullscreen } from "@/lib/useFullscreen";
import type {
  Broadcast,
  BuildingKpis,
  Floor,
  Incident,
} from "@/lib/types";
import type { TwinMode } from "@/components/HabitatTwin";
import KpiStrip from "@/components/KpiStrip";
import FloorPanel from "@/components/FloorPanel";
import IncidentFeed from "@/components/IncidentFeed";
import BroadcastComposer from "@/components/BroadcastComposer";

// The twin is client/WebGL-only — load it without SSR.
const HabitatTwin = dynamic(() => import("@/components/HabitatTwin"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Loading Habitat Twin…
    </div>
  ),
});

export default function Console({
  initialFloors,
  initialIncidents,
  initialBroadcasts,
  initialKpis,
  dbConnected,
}: {
  initialFloors: Floor[];
  initialIncidents: Incident[];
  initialBroadcasts: Broadcast[];
  initialKpis: BuildingKpis;
  dbConnected: boolean;
}) {
  const [floors] = useState<Floor[]>(initialFloors);
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [kpis, setKpis] = useState<BuildingKpis>(initialKpis);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mode, setMode] = useState<TwinMode>("orbit");
  const stageRef = useRef<HTMLDivElement>(null);
  const { active: isFullscreen, cssFallback, toggle: toggleFullscreen } =
    useFullscreen(stageRef);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
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
        <div className="flex items-center gap-2">
          <a
            href="/fleet"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-600/70 bg-ink-900/60 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-ink-800 hover:text-white"
          >
            Fleet view →
          </a>
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

      {/* KPI strip (F5) */}
      <KpiStrip kpis={kpis} />

      {/* Main grid: twin (F1) + floor panel (F2) | feed (F3) + broadcast (F4) */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="flex flex-col gap-4">
          <div
            ref={stageRef}
            className={`twin-stage panel relative h-[460px] overflow-hidden lg:h-[560px] ${
              cssFallback ? "twin-stage--max" : ""
            }`}
          >
            <HabitatTwin
              floors={floors}
              incidents={incidents}
              selectedKey={selectedKey}
              mode={mode}
              onSelect={setSelectedKey}
              onWalkthroughEnd={() => setMode("orbit")}
            />

            {/* Twin controls — segmented mode switch + fullscreen toggle */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setMode("orbit")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    mode === "orbit"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Orbit
                </button>
                <button
                  type="button"
                  onClick={startWalkthrough}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    mode === "walkthrough"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Walk-through
                </button>
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                title={isFullscreen ? "Exit full screen" : "Full screen"}
                className="grid h-8 w-8 place-items-center rounded-full border border-ink-600/70 bg-ink-900/80 text-slate-200 backdrop-blur transition-colors hover:bg-ink-800 hover:text-white"
              >
                {isFullscreen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <FloorPanel floor={selectedFloor} incidents={incidents} />
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
          <BroadcastComposer floors={floors} onSent={refresh} />
        </section>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes,
        but never overrides safety.
      </footer>
    </main>
  );
}
