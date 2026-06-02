"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Broadcast,
  BuildingKpis,
  Floor,
  Incident,
} from "@/lib/types";
import type { TwinMode, ShadingMode, SceneKind } from "@/components/HabitatTwin";
import KpiStrip from "@/components/KpiStrip";
import FloorPanel from "@/components/FloorPanel";
import IncidentFeed from "@/components/IncidentFeed";
import BroadcastComposer from "@/components/BroadcastComposer";
import FullscreenButton from "@/components/FullscreenButton";
import { useFullscreen, FULLSCREEN_STAGE_CLASS } from "@/lib/useFullscreen";

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
  const [shading, setShading] = useState<ShadingMode>("standard");
  const [scene, setScene] = useState<SceneKind>("habitat");

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

  // Fullscreen for the twin / walk-through (native FS + CSS overlay fallback).
  const {
    ref: twinWrapRef,
    isFullscreen: expanded,
    toggle: toggleExpand,
  } = useFullscreen<HTMLDivElement>();

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
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
            ref={twinWrapRef}
            data-testid="twin-stage"
            className={`relative overflow-hidden bg-ink-950 ${
              expanded ? FULLSCREEN_STAGE_CLASS : "panel h-[460px] lg:h-[560px]"
            }`}
          >
            <HabitatTwin
              floors={floors}
              incidents={incidents}
              selectedKey={selectedKey}
              mode={mode}
              shading={shading}
              scene={scene}
              onSelect={setSelectedKey}
              onWalkthroughEnd={() => setMode("orbit")}
            />

            {/* Controls — iOS-style segmented buttons + fullscreen toggle */}
            <div className="absolute right-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-end gap-2">
              {/* Scene: habitat tower vs. site/location mimic */}
              <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setScene("habitat")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    scene === "habitat"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Habitat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScene("site");
                    setMode("orbit");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    scene === "site"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Site
                </button>
              </div>

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
                  disabled={scene === "site"}
                  title={scene === "site" ? "Walk-through is available in the Habitat scene" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    mode === "walkthrough"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Walk-through
                </button>
              </div>

              {/* Shading: standard 3-light rig vs. cinematic HDRI + shadows */}
              <div className="flex gap-1 rounded-full border border-ink-600/70 bg-ink-900/80 p-1 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setShading("standard")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    shading === "standard"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setShading("cinematic")}
                  title="HDRI ambience, ambient occlusion & soft shadows"
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    shading === "cinematic"
                      ? "bg-white text-ink-950"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Cinematic
                </button>
              </div>
              <FullscreenButton isFullscreen={expanded} onToggle={toggleExpand} />
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
