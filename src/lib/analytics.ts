// Analytics + anomaly/trend engine for ATLAS OS.
//
// SAFETY BOUNDARY (OPR §4): this module is **observe-and-advise only**. It reads
// telemetry and derives advisory alerts, trends, and a building-health score. It
// never actuates anything and is never a prerequisite for any life-safety
// function — deterministic BMS/PLC controls own those. Everything here is a hint
// for operators, nothing more.
//
// Design notes:
//  - Pure & deterministic: no Date.now(), no randomness, no I/O. Callers pass in
//    the data (floors + sensor points) so the functions are trivially testable
//    and produce identical output for identical input.
//  - Sparse-friendly: `FloorMetrics` is all-optional, so every threshold check
//    is guarded and simply skipped when a metric is absent.

import type {
  FloorMetrics,
  Floor,
  SensorPoint,
  Severity,
} from "@/lib/types";

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

/**
 * An advisory alert derived from telemetry. Mirrors the shape of an `Incident`
 * (severity + floorKey + title/detail) so the UI can render it with the same
 * severity color-coding, but it is explicitly advisory and never persisted.
 */
export interface DerivedAlert {
  /** Stable, deterministic id, e.g. "anomaly-the-lung-co2Ppm". */
  id: string;
  severity: Severity;
  /** Floor this alert references — matches a `Floor.key`. */
  floorKey: string;
  /** Metric key that tripped, e.g. "co2Ppm". */
  metric: keyof FloorMetrics;
  /** The reading that tripped the threshold. */
  value: number;
  title: string;
  detail: string;
}

/** Direction of a metric's recent movement. */
export type TrendDirection = "rising" | "falling" | "flat";

/**
 * The result of trending / forecasting a numeric series. `slope` is the
 * least-squares slope (units per sample); `projected` is the next-step
 * forecast blending EWMA level with the fitted slope.
 */
export interface MetricTrend {
  /** EWMA-smoothed current level. */
  ewma: number;
  /** Least-squares slope per sample step. */
  slope: number;
  direction: TrendDirection;
  /** Forecast for the next sample. */
  projected: number;
  /** Number of samples the trend was computed from. */
  samples: number;
}

/** A ranked risk surfaced in the health rollup. */
export interface RiskFactor {
  floorKey: string;
  metric: keyof FloorMetrics;
  severity: Severity;
  /** Weighted penalty this risk contributed to the health score. */
  weight: number;
  title: string;
}

/** Building-health rollup: a 0–100 score plus the alerts/risks behind it. */
export interface AnalyticsSummary {
  /** 0–100 composite health score (100 = all nominal). */
  score: number;
  /** Coarse health band derived from `score`. */
  status: "nominal" | "watch" | "degraded";
  alerts: DerivedAlert[];
  topRisks: RiskFactor[];
  /** Per-metric trends for sparkline rendering, keyed by `floorKey:kind`. */
  trends: Record<string, MetricTrend>;
  /** Counts by severity, for at-a-glance summaries. */
  counts: { crit: number; warn: number; info: number; ok: number };
}

// --------------------------------------------------------------------------
// Thresholds (advisory). Tuned to the ATLAS-01 seed envelope.
// --------------------------------------------------------------------------

/** Comfort band for occupied-zone air temperature (°C). */
const TEMP_COMFORT = { min: 18, max: 26, warnPad: 2 } as const;
/** Target floor for greywater reuse efficiency (%). */
const WATER_REUSE_TARGET = 80;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  crit: 30,
  warn: 12,
  info: 0,
  ok: 0,
};

// --------------------------------------------------------------------------
// Anomaly detection
// --------------------------------------------------------------------------

interface Check {
  metric: keyof FloorMetrics;
  /** Returns the tripped severity + message, or null when nominal. */
  evaluate: (
    value: number,
    floor: Floor,
  ) => { severity: Severity; title: string; detail: string } | null;
}

const CHECKS: Check[] = [
  {
    metric: "co2Ppm",
    evaluate: (v) => {
      if (v > 1500) {
        return {
          severity: "crit",
          title: "CO₂ critically high",
          detail: `CO₂ at ${Math.round(v)} ppm (>1500). Advisory: increase fresh-air exchange.`,
        };
      }
      if (v > 1000) {
        return {
          severity: "warn",
          title: "CO₂ elevated",
          detail: `CO₂ at ${Math.round(v)} ppm (>1000). Ventilation likely under-supplying.`,
        };
      }
      return null;
    },
  },
  {
    metric: "pm25",
    evaluate: (v) => {
      if (v > 55) {
        return {
          severity: "crit",
          title: "Particulates unhealthy",
          detail: `PM2.5 at ${v.toFixed(1)} µg/m³ (>55). Advisory: escalate air filtration.`,
        };
      }
      if (v > 35) {
        return {
          severity: "warn",
          title: "Particulates elevated",
          detail: `PM2.5 at ${v.toFixed(1)} µg/m³ (>35), above the 24-hour guideline.`,
        };
      }
      return null;
    },
  },
  {
    metric: "batteryPct",
    evaluate: (v) => {
      if (v < 10) {
        return {
          severity: "crit",
          title: "Battery critically low",
          detail: `State of charge ${Math.round(v)}% (<10%). Advisory: shed deferrable loads.`,
        };
      }
      if (v < 20) {
        return {
          severity: "warn",
          title: "Battery low",
          detail: `State of charge ${Math.round(v)}% (<20%). Reserve margin shrinking.`,
        };
      }
      return null;
    },
  },
  {
    metric: "waterReusePct",
    evaluate: (v) => {
      // Skydeck reservoir reports 100% by design; only flag genuine shortfalls.
      if (v < WATER_REUSE_TARGET - 20) {
        return {
          severity: "warn",
          title: "Water reuse below target",
          detail: `Greywater reuse ${Math.round(v)}% (target ${WATER_REUSE_TARGET}%). Reclamation efficiency degraded.`,
        };
      }
      if (v < WATER_REUSE_TARGET) {
        return {
          severity: "info",
          title: "Water reuse slipping",
          detail: `Greywater reuse ${Math.round(v)}% (target ${WATER_REUSE_TARGET}%).`,
        };
      }
      return null;
    },
  },
  {
    metric: "tempC",
    evaluate: (v, floor) => {
      // Only meaningful for occupied/comfort zones.
      const occupied = floor.residents > 0 || (floor.metrics.occupancy ?? 0) > 0;
      if (!occupied) return null;
      const { min, max, warnPad } = TEMP_COMFORT;
      if (v < min - warnPad || v > max + warnPad) {
        return {
          severity: "warn",
          title: "Temperature out of comfort band",
          detail: `Zone at ${v.toFixed(1)} °C, outside the ${min}–${max} °C comfort band.`,
        };
      }
      if (v < min || v > max) {
        return {
          severity: "info",
          title: "Temperature drifting",
          detail: `Zone at ${v.toFixed(1)} °C, edging past the ${min}–${max} °C comfort band.`,
        };
      }
      return null;
    },
  },
];

/**
 * Detect advisory anomalies across the floor stack. Sensor points are folded in
 * as a freshness signal: a stale latest reading (no point newer than the floor's
 * implied snapshot) is surfaced as an `info` alert so operators know a metric
 * may be coasting on last-known values. Output is deterministic and ordered by
 * severity then floor level.
 */
export function detectAnomalies(
  floors: Floor[],
  sensors: SensorPoint[] = [],
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const floor of floors) {
    for (const check of CHECKS) {
      const value = floor.metrics[check.metric];
      if (value === undefined) continue;
      const hit = check.evaluate(value, floor);
      if (!hit) continue;
      alerts.push({
        id: `anomaly-${floor.key}-${check.metric}`,
        severity: hit.severity,
        floorKey: floor.key,
        metric: check.metric,
        value,
        title: `${floor.name}: ${hit.title}`,
        detail: hit.detail,
      });
    }
  }

  // Freshness: a floor with metrics but zero sensor points is "blind".
  const floorsWithSensors = new Set(sensors.map((p) => p.floorKey));
  for (const floor of floors) {
    const reportsMetrics = Object.keys(floor.metrics).length > 0;
    if (reportsMetrics && !floorsWithSensors.has(floor.key)) {
      alerts.push({
        id: `anomaly-${floor.key}-sensorGap`,
        severity: "info",
        floorKey: floor.key,
        metric: "occupancy",
        value: 0,
        title: `${floor.name}: no live sensor points`,
        detail:
          "Metrics shown may be coasting on last-known values; no tagged points reporting for this floor.",
      });
    }
  }

  const order = floorLevelOrder(floors);
  return alerts.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (order.get(a.floorKey) ?? 0) - (order.get(b.floorKey) ?? 0);
  });
}

const SEVERITY_RANK: Record<Severity, number> = {
  crit: 0,
  warn: 1,
  info: 2,
  ok: 3,
};

function floorLevelOrder(floors: Floor[]): Map<string, number> {
  return new Map(floors.map((f) => [f.key, f.level]));
}

// --------------------------------------------------------------------------
// Trend / forecast
// --------------------------------------------------------------------------

/**
 * Exponentially-weighted moving average over a numeric series. `alpha` weights
 * the most recent sample (0 < alpha ≤ 1). Returns the smoothed final level.
 */
export function ewma(series: number[], alpha = 0.5): number {
  if (series.length === 0) return 0;
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return level;
}

/**
 * Least-squares slope of a series against its index (0,1,2,…). Returns 0 for
 * series shorter than two points. Pure linear regression — no external libs.
 */
function leastSquaresSlope(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (series[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Compute the trend (direction + slope) of a numeric series. Direction is
 * classified relative to the series' magnitude so a tiny absolute slope on a
 * large signal still reads as "flat".
 */
export function trend(series: number[]): MetricTrend {
  return forecastMetric(series);
}

/**
 * Forecast the next sample of a series and describe its trend. Blends the EWMA
 * level (robust to noise) with the least-squares slope (captures direction).
 */
export function forecastMetric(series: number[], alpha = 0.5): MetricTrend {
  const clean = series.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return { ewma: 0, slope: 0, direction: "flat", projected: 0, samples: 0 };
  }
  const level = ewma(clean, alpha);
  const slope = leastSquaresSlope(clean);
  const projected = level + slope;

  // Flat threshold scales with the signal's magnitude (min 1e-6 to avoid /0).
  const scale = Math.max(
    1e-6,
    clean.reduce((a, b) => a + Math.abs(b), 0) / clean.length,
  );
  const relSlope = slope / scale;
  let direction: TrendDirection = "flat";
  if (relSlope > 0.02) direction = "rising";
  else if (relSlope < -0.02) direction = "falling";

  return { ewma: level, slope, direction, projected, samples: clean.length };
}

/**
 * Build per-floor/per-kind trends from sensor points. Points are grouped by
 * `floorKey:kind`, ordered oldest→newest by timestamp, then trended. Useful for
 * the panel sparklines. Deterministic given the same input ordering.
 */
export function trendsFromSensors(
  sensors: SensorPoint[],
): Record<string, MetricTrend> {
  const groups = new Map<string, SensorPoint[]>();
  for (const p of sensors) {
    const key = `${p.floorKey}:${p.kind}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  const out: Record<string, MetricTrend> = {};
  for (const [key, points] of groups) {
    const ordered = [...points].sort(
      (a, b) => +new Date(a.ts) - +new Date(b.ts),
    );
    out[key] = forecastMetric(ordered.map((p) => p.value));
  }
  return out;
}

// --------------------------------------------------------------------------
// Building-health rollup
// --------------------------------------------------------------------------

/**
 * Roll the floor stack + sensors into a single building-health summary: a 0–100
 * score (100 = all nominal), the advisory alerts behind it, and the top ranked
 * risks. The score subtracts severity-weighted penalties from 100 and clamps to
 * [0, 100]. Advisory only — see the module header / OPR §4.
 */
export function summarize(
  floors: Floor[],
  sensors: SensorPoint[] = [],
): AnalyticsSummary {
  const alerts = detectAnomalies(floors, sensors);

  const counts = { crit: 0, warn: 0, info: 0, ok: 0 };
  let penalty = 0;
  const risks: RiskFactor[] = [];
  for (const a of alerts) {
    counts[a.severity] += 1;
    const weight = SEVERITY_WEIGHT[a.severity];
    penalty += weight;
    if (weight > 0) {
      risks.push({
        floorKey: a.floorKey,
        metric: a.metric,
        severity: a.severity,
        weight,
        title: a.title,
      });
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const status: AnalyticsSummary["status"] =
    score >= 85 ? "nominal" : score >= 60 ? "watch" : "degraded";

  const topRisks = risks
    .sort((a, b) => b.weight - a.weight || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 5);

  return {
    score,
    status,
    alerts,
    topRisks,
    trends: trendsFromSensors(sensors),
    counts,
  };
}
