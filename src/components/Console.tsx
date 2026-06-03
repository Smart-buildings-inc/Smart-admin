"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Broadcast,
  BuildingKpis,
  Floor,
  FloorPresence,
  Incident,
} from "@/lib/types";
import type { Recommendation } from "@/lib/advisor";
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
        </section>
      </div>

      <footer className="pb-2 text-center text-xs text-slate-600">
        ATLAS is operationally independent, not legally exempt · AI optimizes,
        but never overrides safety.
      </footer>
    </main>
  );
}
