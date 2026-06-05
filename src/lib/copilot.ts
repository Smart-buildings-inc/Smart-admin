// AI ops copilot — pure helpers for ATLAS OS.
//
// This module is LLM-agnostic. It assembles a compact, token-efficient snapshot
// of building state (the "ops context") from the data layer, and provides a
// deterministic `localAnswer` fallback so the copilot keeps working with no API
// key and no network — keeping ATLAS OS local-first (see CLAUDE.md).
//
// The copilot is OBSERVE-AND-ADVISE ONLY (per §4 of
// docs/OWNERS_PROJECT_REQUIREMENTS.md): it never instructs anyone to override or
// bypass life-safety / BMS / PLC controls. The deterministic answers below
// reflect that — they summarize and advise, they never issue control actions.

import { getBuildingKpis, getFloors, getIncidents } from "@/lib/data";
import { getSensorPoints } from "@/lib/sensors";
import { severityLabel, severityRank } from "@/lib/ui";
import type {
  BuildingKpis,
  Floor,
  Incident,
  SensorPoint,
} from "@/lib/types";

/** A single turn in the copilot conversation. */
export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The structured snapshot the copilot reasons over. Kept small so it fits a
 * cacheable system block and stays cheap to ground every turn on.
 */
export interface OpsContext {
  kpis: BuildingKpis;
  floors: Floor[];
  incidents: Incident[];
  sensors: SensorPoint[];
  /** Human-readable grounding string rendered from the above. */
  grounding: string;
}

/** How many recent sensor readings to fold into the snapshot. */
const RECENT_SENSOR_LIMIT = 12;

/**
 * Pull a compact snapshot of current building state and render it as a grounding
 * string. Reads go through the shared data layer, so this works on seed data or
 * a live DB transparently.
 */
export async function buildOpsContext(): Promise<OpsContext> {
  const [kpis, floors, incidents, sensors] = await Promise.all([
    getBuildingKpis(),
    getFloors(),
    getIncidents(),
    getSensorPoints(),
  ]);
  const recentSensors = sensors.slice(0, RECENT_SENSOR_LIMIT);
  const grounding = renderGrounding(kpis, floors, incidents, recentSensors);
  return { kpis, floors, incidents, sensors: recentSensors, grounding };
}

/** Render the snapshot as a terse, line-oriented grounding block. */
function renderGrounding(
  kpis: BuildingKpis,
  floors: Floor[],
  incidents: Incident[],
  sensors: SensorPoint[],
): string {
  const lines: string[] = [];

  lines.push("# ATLAS-01 OPS SNAPSHOT");
  lines.push("");
  lines.push("## Building KPIs");
  lines.push(`- Autonomy: ${kpis.autonomyPct}% of demand met on-site`);
  lines.push(`- Battery state of charge: ${kpis.batteryPct}%`);
  lines.push(`- Solar generation: ${kpis.solarKw} kW`);
  lines.push(`- Water reuse: ${kpis.waterReusePct}%`);
  lines.push(`- Food output: ${kpis.foodKgDay} kg/day`);
  lines.push(`- Residents: ${kpis.residents}`);
  lines.push(`- Open incidents (crit+warn): ${kpis.openIncidents}`);

  lines.push("");
  lines.push("## Floors (need · level · residents · key metrics)");
  for (const f of floors) {
    lines.push(
      `- ${f.name} [key=${f.key}] · ${f.category} (${f.need}) · L${f.level} · ${f.residents} residents · ${summarizeMetrics(f)}`,
    );
  }

  lines.push("");
  lines.push("## Incidents (most urgent first)");
  const ranked = rankIncidents(incidents);
  if (ranked.length === 0) {
    lines.push("- None. All systems nominal.");
  } else {
    for (const inc of ranked.slice(0, 12)) {
      const where = inc.floorKey ?? "building-wide";
      const detail = inc.detail ? ` — ${inc.detail}` : "";
      lines.push(
        `- [${severityLabel[inc.severity]}] ${inc.title} (${where})${detail}`,
      );
    }
  }

  if (sensors.length > 0) {
    lines.push("");
    lines.push("## Recent sensor readings");
    for (const s of sensors) {
      lines.push(
        `- ${s.floorKey}/${s.kind}${s.unit ? `/${s.unit}` : ""}: ${s.value} ${s.unitOfMeasure} (${s.tag})`,
      );
    }
  }

  return lines.join("\n");
}

/** One-line summary of a floor's sparse metrics. */
function summarizeMetrics(f: Floor): string {
  const m = f.metrics;
  const parts: string[] = [];
  if (m.energyKw !== undefined) parts.push(`${m.energyKw}kW gen`);
  if (m.loadKw !== undefined) parts.push(`${m.loadKw}kW load`);
  if (m.batteryPct !== undefined) parts.push(`${m.batteryPct}% batt`);
  if (m.waterLph !== undefined) parts.push(`${m.waterLph}L/h`);
  if (m.waterReusePct !== undefined) parts.push(`${m.waterReusePct}% reuse`);
  if (m.foodKgDay !== undefined) parts.push(`${m.foodKgDay}kg/day`);
  if (m.occupancy !== undefined) parts.push(`${m.occupancy} present`);
  if (m.tempC !== undefined) parts.push(`${m.tempC}°C`);
  if (m.humidityPct !== undefined) parts.push(`${m.humidityPct}% RH`);
  if (m.co2Ppm !== undefined) parts.push(`${m.co2Ppm}ppm CO2`);
  if (m.pm25 !== undefined) parts.push(`PM2.5 ${m.pm25}`);
  return parts.length ? parts.join(", ") : "no live metrics";
}

/** Sort incidents by urgency, then recency. */
function rankIncidents(incidents: Incident[]): Incident[] {
  return [...incidents].sort((a, b) => {
    const r = severityRank[a.severity] - severityRank[b.severity];
    return r !== 0 ? r : +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

// --------------------------- deterministic fallback ---------------------------

const ADVISORY_NOTE =
  "Advisory only — ATLAS OS observes and advises; it never overrides life-safety, BMS, or PLC controls.";

/**
 * A purely deterministic answer over the snapshot — no LLM. Handles the common
 * operator asks by intent-matching the question. This is the local-first
 * fallback whenever no API key is set or the upstream call fails.
 */
export function localAnswer(question: string, ctx: OpsContext): string {
  const q = question.toLowerCase().trim();

  // Draft a resident broadcast for a floor / incident.
  if (
    q.includes("broadcast") ||
    q.includes("draft") ||
    q.includes("notify") ||
    q.includes("message resident")
  ) {
    return draftBroadcast(q, ctx);
  }

  // Explain top / critical incidents.
  if (
    q.includes("incident") ||
    q.includes("critical") ||
    q.includes("alarm") ||
    q.includes("alert") ||
    q.includes("what is wrong") ||
    q.includes("what's wrong")
  ) {
    return explainIncidents(ctx);
  }

  // List at-risk floors.
  if (
    q.includes("at-risk") ||
    q.includes("at risk") ||
    q.includes("risk") ||
    q.includes("which floor") ||
    q.includes("attention")
  ) {
    return listAtRiskFloors(ctx);
  }

  // Default: summarize building status from KPIs.
  return summarizeStatus(ctx);
}

function summarizeStatus(ctx: OpsContext): string {
  const k = ctx.kpis;
  const ranked = rankIncidents(ctx.incidents);
  const crit = ranked.filter((i) => i.severity === "crit").length;
  const warn = ranked.filter((i) => i.severity === "warn").length;

  const posture =
    crit > 0
      ? `${crit} critical incident${crit === 1 ? "" : "s"} open — needs operator attention.`
      : warn > 0
        ? `${warn} warning${warn === 1 ? "" : "s"} open, nothing critical.`
        : "All systems nominal, no open incidents.";

  return [
    "Building status — ATLAS-01",
    "",
    `Autonomy is at ${k.autonomyPct}% (share of demand met on-site), battery at ${k.batteryPct}%, solar generating ${k.solarKw} kW.`,
    `Water reuse ${k.waterReusePct}%, food output ${k.foodKgDay} kg/day, housing ${k.residents} residents.`,
    "",
    posture,
    "",
    ADVISORY_NOTE,
  ].join("\n");
}

function explainIncidents(ctx: OpsContext): string {
  const ranked = rankIncidents(ctx.incidents).filter(
    (i) => i.severity === "crit" || i.severity === "warn",
  );
  if (ranked.length === 0) {
    return [
      "No open critical or warning incidents — all systems nominal.",
      "",
      ADVISORY_NOTE,
    ].join("\n");
  }

  const floorName = new Map(ctx.floors.map((f) => [f.key, f.name]));
  const top = ranked.slice(0, 5);
  const lines: string[] = [
    `Top ${top.length} open incident${top.length === 1 ? "" : "s"} (most urgent first):`,
    "",
  ];
  top.forEach((inc, i) => {
    const where = inc.floorKey
      ? floorName.get(inc.floorKey) ?? inc.floorKey
      : "Building-wide";
    lines.push(`${i + 1}. [${severityLabel[inc.severity]}] ${inc.title}`);
    lines.push(`   Location: ${where}`);
    if (inc.detail) lines.push(`   Detail: ${inc.detail}`);
  });
  lines.push("");
  lines.push(
    "Suggested next step: review the affected floor's telemetry and dispatch the on-call operator. Safety interlocks remain under the BMS/PLC — do not override them.",
  );
  lines.push("");
  lines.push(ADVISORY_NOTE);
  return lines.join("\n");
}

function listAtRiskFloors(ctx: OpsContext): string {
  // Score floors by open incidents on them, plus simple metric thresholds.
  const incidentsByFloor = new Map<string, Incident[]>();
  for (const inc of ctx.incidents) {
    if (!inc.floorKey) continue;
    if (inc.severity !== "crit" && inc.severity !== "warn") continue;
    const list = incidentsByFloor.get(inc.floorKey) ?? [];
    list.push(inc);
    incidentsByFloor.set(inc.floorKey, list);
  }

  type Risk = { floor: Floor; reasons: string[]; score: number };
  const risks: Risk[] = [];
  for (const f of ctx.floors) {
    const reasons: string[] = [];
    let score = 0;

    const incs = incidentsByFloor.get(f.key) ?? [];
    for (const inc of incs) {
      score += inc.severity === "crit" ? 10 : 4;
      reasons.push(`${severityLabel[inc.severity]}: ${inc.title}`);
    }

    const m = f.metrics;
    if (m.batteryPct !== undefined && m.batteryPct < 30) {
      score += 5;
      reasons.push(`battery low (${m.batteryPct}%)`);
    }
    if (m.co2Ppm !== undefined && m.co2Ppm > 1000) {
      score += 3;
      reasons.push(`CO2 elevated (${m.co2Ppm} ppm)`);
    }
    if (m.pm25 !== undefined && m.pm25 > 35) {
      score += 3;
      reasons.push(`PM2.5 elevated (${m.pm25} µg/m³)`);
    }
    if (
      m.loadKw !== undefined &&
      m.energyKw !== undefined &&
      m.loadKw > m.energyKw
    ) {
      score += 2;
      reasons.push(
        `load (${m.loadKw}kW) exceeds local generation (${m.energyKw}kW)`,
      );
    }

    if (score > 0) risks.push({ floor: f, reasons, score });
  }

  risks.sort((a, b) => b.score - a.score);

  if (risks.length === 0) {
    return [
      "No floors are currently at risk — incident feed is clear and metrics are within nominal bands.",
      "",
      ADVISORY_NOTE,
    ].join("\n");
  }

  const lines: string[] = [
    `At-risk floors (${risks.length}), most pressing first:`,
    "",
  ];
  for (const r of risks.slice(0, 6)) {
    lines.push(`• ${r.floor.name} (${r.floor.category})`);
    for (const reason of r.reasons) lines.push(`   - ${reason}`);
  }
  lines.push("");
  lines.push(ADVISORY_NOTE);
  return lines.join("\n");
}

function draftBroadcast(q: string, ctx: OpsContext): string {
  // Try to resolve which floor the operator means, by key or name substring.
  const floor = matchFloor(q, ctx.floors);

  // Try to anchor the message on the most relevant open incident.
  const ranked = rankIncidents(ctx.incidents).filter(
    (i) => i.severity === "crit" || i.severity === "warn",
  );
  const incident = floor
    ? ranked.find((i) => i.floorKey === floor.key) ?? ranked[0]
    : ranked[0];

  const audience = floor ? `floor:${floor.key}` : "all";
  const where = floor ? floor.name : "the building";

  let body: string;
  if (incident) {
    const subject = incident.title.replace(/\.$/, "");
    body =
      `Residents of ${where}: our operations team is aware of "${subject}"` +
      ` and is actively working it. Building life-safety systems remain fully operational and independent. We'll send an update as soon as the situation is resolved. Thank you for your patience.`;
  } else {
    body = `Residents of ${where}: all building systems are operating normally. No action is needed on your part. We'll reach out here if anything changes.`;
  }

  return [
    `Draft broadcast (audience: ${audience})`,
    "",
    body,
    "",
    "Review and send via the Broadcast composer. " + ADVISORY_NOTE,
  ].join("\n");
}

/** Resolve a floor from free text by key, name, category, or need. */
function matchFloor(q: string, floors: Floor[]): Floor | null {
  for (const f of floors) {
    if (q.includes(f.key.toLowerCase())) return f;
  }
  for (const f of floors) {
    if (
      q.includes(f.name.toLowerCase()) ||
      q.includes(f.category.toLowerCase())
    ) {
      return f;
    }
  }
  for (const f of floors) {
    if (q.includes(f.need)) return f;
  }
  return null;
}
