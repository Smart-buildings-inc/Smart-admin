"use client";

import type { BuildingCarbon, FloorCarbon } from "@/lib/carbon";
import {
  EMBODIED_TCO2E_PER_M2,
  FLOOR_AREA_M2,
  GRID_FACTOR_GCO2_PER_KWH,
} from "@/lib/carbon";
import { needColor } from "@/lib/ui";
import type { Need } from "@/lib/types";

// Carbon & ESG view — operational + embodied carbon per floor and building,
// tied to green funding programs from the ATLAS derisking plan.

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number to one decimal place with a suffix. */
function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

/** Return a tone class based on net operational carbon intensity. */
function netTone(net: number): string {
  if (net <= 0) return "text-signal-ok";
  if (net < 5) return "text-signal-info";
  if (net < 15) return "text-signal-warn";
  return "text-signal-crit";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  suffix,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="panel panel-pad min-w-[9rem] flex-1">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? "text-white"}`}>
        {value}
        {suffix ? (
          <span className="ml-0.5 text-sm font-normal text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

/** Inline SVG horizontal bar — no additional deps. */
function Bar({
  value,
  max,
  color,
  avoided,
  avoidedMax,
}: {
  value: number;
  max: number;
  color: string;
  avoided: number;
  avoidedMax: number;
}) {
  const W = 120;
  const H = 10;
  const grossW = max > 0 ? Math.min(W, (value / max) * W) : 0;
  const avoidedW = avoidedMax > 0 ? Math.min(W, (avoided / avoidedMax) * W) : 0;
  return (
    <svg
      width={W}
      height={H * 2 + 3}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      {/* Gross demand bar */}
      <rect x={0} y={0} width={W} height={H} rx={3} fill="rgba(255,255,255,0.06)" />
      <rect
        x={0}
        y={0}
        width={Math.max(0, grossW)}
        height={H}
        rx={3}
        fill={color}
        opacity={0.85}
      />
      {/* Avoided (generation offset) bar */}
      <rect
        x={0}
        y={H + 3}
        width={W}
        height={H}
        rx={3}
        fill="rgba(255,255,255,0.06)"
      />
      <rect
        x={0}
        y={H + 3}
        width={Math.max(0, avoidedW)}
        height={H}
        rx={3}
        fill="#3ddc97"
        opacity={0.75}
      />
    </svg>
  );
}

/** One row in the per-floor table. */
function FloorRow({
  floor,
  maxGross,
  maxAvoided,
}: {
  floor: FloorCarbon;
  maxGross: number;
  maxAvoided: number;
}) {
  const color = needColor[floor.need as Need] ?? "#94a3b8";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-600/40 bg-ink-900/50 px-3 py-2.5 transition-colors hover:bg-ink-800/60">
      {/* Need accent dot + name */}
      <div className="flex min-w-[8rem] flex-1 items-center gap-2">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-slate-200 leading-snug">
          {floor.name}
        </span>
      </div>

      {/* Bars */}
      <Bar
        value={floor.operationalTco2ePerYr}
        max={maxGross}
        color={color}
        avoided={floor.avoidedTco2ePerYr}
        avoidedMax={maxAvoided}
      />

      {/* Numbers */}
      <div className="flex min-w-[10rem] flex-col gap-0.5 text-right text-xs">
        <span className="text-slate-300">
          <span className="font-semibold text-white">
            {fmt(floor.operationalTco2ePerYr)}
          </span>{" "}
          tCO₂e/yr gross
        </span>
        {floor.avoidedTco2ePerYr > 0 && (
          <span className="text-signal-ok">
            −{fmt(floor.avoidedTco2ePerYr)} avoided
          </span>
        )}
        <span className={netTone(floor.netOperationalTco2ePerYr)}>
          {floor.netOperationalTco2ePerYr <= 0
            ? "net-positive"
            : `${fmt(floor.netOperationalTco2ePerYr)} net`}
        </span>
        <span className="text-slate-500">
          {fmt(floor.embodiedTco2e)} tCO₂e embodied
        </span>
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function CarbonView({ carbon }: { carbon: BuildingCarbon }) {
  const maxGross = Math.max(
    1,
    ...carbon.floors.map((f) => f.operationalTco2ePerYr),
  );
  const maxAvoided = Math.max(
    1,
    ...carbon.floors.map((f) => f.avoidedTco2ePerYr),
  );

  const netToneClass = netTone(carbon.netOperationalTco2ePerYr);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-6 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* ── 1. Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">
            Carbon &amp; ESG
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Operational + embodied carbon per floor.{" "}
            <span className="important">
              ESG performance tied to green financing.
            </span>
          </p>
        </div>
        {/* Assumption disclosure chip */}
        <span className="annotation inline-flex items-center gap-1.5 rounded-full border border-signal-warn/30 bg-signal-warn/10 px-3 py-1 text-xs text-signal-warn">
          Factors are illustrative — replace with a real LCA &amp; measurement.
        </span>
      </header>

      {/* ── 2. KPI cards ── */}
      <section aria-label="Building carbon KPIs">
        <div className="flex flex-wrap gap-3">
          <KpiCard
            label="Operational (gross)"
            value={fmt(carbon.operationalTco2ePerYr)}
            suffix="tCO₂e/yr"
            sub="Total electrical demand → grid"
          />
          <KpiCard
            label="On-site avoided"
            value={fmt(carbon.avoidedTco2ePerYr)}
            suffix="tCO₂e/yr"
            tone="text-signal-ok"
            sub="Solar + battery offset"
          />
          <KpiCard
            label="Net operational"
            value={fmt(carbon.netOperationalTco2ePerYr)}
            suffix="tCO₂e/yr"
            tone={netToneClass}
            sub="Gross minus avoided"
          />
          <KpiCard
            label="Embodied (upfront)"
            value={fmt(carbon.embodiedTco2e, 0)}
            suffix="tCO₂e"
            sub={`${FLOOR_AREA_M2} m²/floor × ${EMBODIED_TCO2E_PER_M2} t/m²`}
          />
          <KpiCard
            label="Per dwelling / yr"
            value={fmt(carbon.perDwellingTco2ePerYr)}
            suffix="tCO₂e"
            tone={netToneClass}
            sub="Net operational ÷ dwellings"
          />
          <KpiCard
            label="Grid factor"
            value={carbon.gridFactorGco2PerKwh}
            suffix="gCO₂e/kWh"
            sub="Ontario IESO 2023 avg"
          />
        </div>
      </section>

      {/* ── 3. Per-floor breakdown ── */}
      <section aria-label="Per-floor carbon breakdown" className="flex flex-col gap-3">
        <h2 className="kpi-label text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">
          Per-floor carbon
        </h2>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-8 rounded-full bg-white/20" />
            Gross operational (top bar, need-colored)
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-8 rounded-full"
              style={{ backgroundColor: "#3ddc97", opacity: 0.75 }}
            />
            Avoided via on-site generation (bottom bar)
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {carbon.floors.map((floor) => (
            <FloorRow
              key={floor.floorKey}
              floor={floor}
              maxGross={maxGross}
              maxAvoided={maxAvoided}
            />
          ))}
        </div>
      </section>

      {/* ── 4. Funding programs ── */}
      <section
        aria-label="Green funding programs supported"
        className="panel panel-pad flex flex-col gap-3"
      >
        <h2 className="kpi-label text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">
          Supports green financing
        </h2>
        <p className="text-sm text-slate-400">
          ATLAS carbon performance directly supports eligibility for the following
          programs:
        </p>
        <ul className="flex flex-col gap-2">
          {carbon.programs.map((prog) => (
            <li
              key={prog}
              className="flex items-center gap-3 rounded-lg border border-signal-ok/20 bg-signal-ok/8 px-3 py-2.5 text-sm"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4 shrink-0 text-signal-ok"
                aria-hidden
                fill="none"
              >
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M5 8.5 7 10.5 11 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-medium text-slate-200">{prog}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Disclaimer ── */}
      <footer className="flex flex-col gap-1 pb-2 text-xs text-slate-600">
        <p>
          Carbon factors are illustrative planning estimates only. All figures
          require validation against a full Life Cycle Assessment (ISO 14040/44)
          and measured energy metering before use in regulatory submissions or
          ESG disclosures.
        </p>
        <p>
          Assumptions: grid factor {GRID_FACTOR_GCO2_PER_KWH} gCO₂e/kWh
          (Ontario IESO 2023) · floor area {FLOOR_AREA_M2} m²/floor ·
          embodied carbon {EMBODIED_TCO2E_PER_M2} tCO₂e/m² (EC3/ZERO Code
          mid-range).
        </p>
      </footer>
    </main>
  );
}
