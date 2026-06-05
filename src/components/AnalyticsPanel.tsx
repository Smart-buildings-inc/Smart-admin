"use client";

import { useMemo } from "react";
import type { Floor, SensorPoint } from "@/lib/types";
import {
  summarize,
  type AnalyticsSummary,
  type MetricTrend,
} from "@/lib/analytics";
import { severityColor, severityLabel } from "@/lib/ui";
import {
  CheckCircle,
  Pulse,
  TrendDown,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";

// Analytics + anomaly/trend engine panel (advisory only — OPR §4).
//
// Accepts either a precomputed `summary` (from /api/analytics or the server
// helper) or raw `floors` + `sensors` to summarize client-side. Hand-rolls
// inline-SVG sparklines — no chart library.
export default function AnalyticsPanel({
  summary,
  floors,
  sensors = [],
}: {
  summary?: AnalyticsSummary;
  floors?: Floor[];
  sensors?: SensorPoint[];
}) {
  const data = useMemo<AnalyticsSummary>(
    () => summary ?? summarize(floors ?? [], sensors),
    [summary, floors, sensors],
  );

  // Build sparkline series per floor:kind from raw sensor points (when given),
  // ordered oldest → newest. Deterministic; capped to the busiest few.
  const series = useMemo(() => buildSeries(sensors), [sensors]);

  const scoreTone =
    data.status === "nominal"
      ? "text-signal-ok"
      : data.status === "watch"
        ? "text-signal-warn"
        : "text-signal-crit";

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Pulse aria-hidden weight="duotone" className="h-4 w-4 text-slate-500" />
          Analytics
        </h2>
        <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
          Advisory
        </span>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-4 scroll-thin">
        {/* Health score */}
        <div className="flex items-center gap-4">
          <ScoreRing score={data.score} tone={scoreTone} />
          <div className="min-w-0">
            <div className="kpi-label">Building health</div>
            <div className={`font-mono text-3xl font-semibold tabular-nums ${scoreTone}`}>
              {data.score}
              <span className="ml-1 text-sm font-normal text-slate-500">/100</span>
            </div>
            <div className="mt-0.5 text-xs capitalize text-slate-400">
              {data.status} · {data.counts.crit} crit · {data.counts.warn} warn
            </div>
          </div>
        </div>

        {/* Sparklines for key trends */}
        {series.length > 0 && (
          <div>
            <div className="kpi-label mb-2">Trends</div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {series.map((s) => (
                <li
                  key={s.key}
                  className="rounded-lg border border-ink-600/50 bg-ink-800/40 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-300">
                      {s.label}
                    </span>
                    <DirectionTag trend={s.trend} />
                  </div>
                  <Sparkline values={s.values} trend={s.trend} />
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-slate-400">
                    <span>{fmt(s.values[s.values.length - 1])}</span>
                    <span className="text-slate-500">{s.unit}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Derived alerts */}
        <div>
          <div className="kpi-label mb-2">
            Derived alerts
            <span className="ml-2 rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] text-slate-300">
              {data.alerts.length}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2.5 rounded-lg border border-ink-600/50 bg-ink-800/40 px-3 py-2"
              >
                <span
                  title={severityLabel[a.severity]}
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    a.severity === "crit" ? "pulse" : ""
                  }`}
                  style={{ color: severityColor[a.severity] }}
                >
                  <WarningCircle aria-hidden weight="duotone" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-100">{a.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {a.detail}
                  </span>
                </span>
              </li>
            ))}
            {data.alerts.length === 0 && (
              <li className="flex items-center gap-2 rounded-lg border border-ink-600/50 bg-ink-800/40 px-3 py-3 text-sm text-slate-400">
                <CheckCircle aria-hidden weight="duotone" className="h-4 w-4 text-signal-ok" />
                No anomalies. All metrics within advisory thresholds.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- sparkline series assembly ------------------------------------------------

interface SeriesEntry {
  key: string;
  label: string;
  unit: string;
  values: number[];
  trend: MetricTrend;
}

function buildSeries(sensors: SensorPoint[]): SeriesEntry[] {
  const groups = new Map<string, SensorPoint[]>();
  for (const p of sensors) {
    const key = `${p.floorKey}:${p.kind}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  const entries: SeriesEntry[] = [];
  for (const [key, points] of groups) {
    const ordered = [...points].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
    // Sparklines need at least two points to read as a line.
    if (ordered.length < 2) continue;
    const values = ordered.map((p) => p.value);
    entries.push({
      key,
      label: `${ordered[0].floorKey} · ${ordered[0].kind}`,
      unit: ordered[0].unitOfMeasure,
      values,
      trend: forecast(values),
    });
  }
  // Prefer the longest series (most signal); cap to keep the panel tidy.
  return entries.sort((a, b) => b.values.length - a.values.length).slice(0, 4);
}

// Lightweight local forecast to avoid importing the full helper graph here;
// matches src/lib/analytics.ts forecastMetric direction semantics.
function forecast(values: number[]): MetricTrend {
  if (values.length === 0) {
    return { ewma: 0, slope: 0, direction: "flat", projected: 0, samples: 0 };
  }
  let level = values[0];
  for (let i = 1; i < values.length; i++) level = 0.5 * values[i] + 0.5 * level;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (values[i] - meanY);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  const scale = Math.max(1e-6, values.reduce((a, b) => a + Math.abs(b), 0) / n);
  const rel = slope / scale;
  const direction =
    rel > 0.02 ? "rising" : rel < -0.02 ? "falling" : "flat";
  return { ewma: level, slope, direction, projected: level + slope, samples: n };
}

// --- inline-SVG primitives ---------------------------------------------------

function ScoreRing({ score, tone }: { score: number; tone: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg
      viewBox="0 0 56 56"
      className="h-14 w-14 shrink-0 -rotate-90"
      role="img"
      aria-label={`Health score ${score} of 100`}
    >
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        className="text-ink-600/70"
      />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className={tone}
      />
    </svg>
  );
}

function Sparkline({
  values,
  trend,
}: {
  values: number[];
  trend: MetricTrend;
}) {
  const w = 120;
  const h = 28;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`;
  const stroke =
    trend.direction === "rising"
      ? "#4ea8ff"
      : trend.direction === "falling"
        ? "#ffb340"
        : "#3ddc97";
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-1.5 h-7 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Sparkline, trend ${trend.direction}`}
    >
      <path d={area} fill={stroke} fillOpacity={0.12} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}

function DirectionTag({ trend }: { trend: MetricTrend }) {
  if (trend.direction === "flat") {
    return <span className="text-[10px] font-medium text-slate-500">flat</span>;
  }
  const rising = trend.direction === "rising";
  const Icon = rising ? TrendUp : TrendDown;
  return (
    <span
      className={`flex items-center gap-0.5 text-[10px] font-medium ${
        rising ? "text-signal-info" : "text-signal-warn"
      }`}
    >
      <Icon aria-hidden weight="bold" className="h-3 w-3" />
      {trend.direction}
    </span>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1);
}
