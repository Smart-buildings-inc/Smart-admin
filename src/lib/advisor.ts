// AI Ops Advisor for ATLAS OS.
//
// Provides deterministic heuristic-based recommendations (always works, no
// external services required) with optional Anthropic AI refinement when
// ANTHROPIC_API_KEY is set. This module never throws — all errors are caught
// and the heuristic path is the authoritative fallback.
//
// See CLAUDE.md "AI Ops Advisor" for the full feature spec.

import { getBuildingKpis, getFloors, getIncidents } from "@/lib/data";
import { getPresence } from "@/lib/ruview";
import type {
  BuildingKpis,
  Floor,
  FloorPresence,
  Incident,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Public types (exact contract names — do not rename)
// ---------------------------------------------------------------------------

export type RecCategory =
  | "energy"
  | "water"
  | "food"
  | "air"
  | "presence"
  | "ops";

export interface Recommendation {
  id: string;
  title: string; // imperative, short, e.g. "Shift grow-bank 3 to off-peak"
  rationale: string; // one sentence why
  floorKey?: string | null;
  severity: "crit" | "warn" | "info" | "ok";
  category: RecCategory;
  estimatedImpact?: string; // e.g. "-12% grow-bank draw"
  source: "ai" | "heuristic";
}

/** True when the Anthropic API key is set in the environment. */
export const isAdvisorAiEnabled: boolean =
  !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Severity ordering for final sort (lower number = higher urgency)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<Recommendation["severity"], number> = {
  crit: 0,
  warn: 1,
  info: 2,
  ok: 3,
};

// ---------------------------------------------------------------------------
// Heuristic thresholds
// ---------------------------------------------------------------------------

const BATTERY_LOW_PCT = 30; // warn below this
const BATTERY_CRIT_PCT = 15; // crit below this
const CO2_WARN_PPM = 1000; // ASHRAE 62.1 guideline — investigate above this
const CO2_CRIT_PPM = 1500; // acute range
const WATER_REUSE_LOW_PCT = 50; // warn below this
const BREATHING_LOW_BPM = 10; // abnormally slow (suspected apnoea)
const BREATHING_HIGH_BPM = 25; // rapid — elevated stress/load
const HEART_LOW_BPM = 50; // bradycardia threshold
const HEART_HIGH_BPM = 100; // tachycardia threshold
const RESILIENCE_WARN_SCORE = 70; // sub-score below this triggers a rec
// Food: a floor producing >40 kgDay is drawing a large grow-bank load;
// flag it for off-peak scheduling if any open warn/crit incident exists.
const FOOD_HIGH_KG_DAY = 40;
// Presence: a residential floor with ≥1 resident but 0 detected occupants
// should have HVAC set back to save energy.
const SETBACK_OCCUPANCY_THRESHOLD = 0;

// ---------------------------------------------------------------------------
// Unique ID generator (deterministic within a call, not globally unique)
// ---------------------------------------------------------------------------

let _seq = 0;
function recId(prefix: string): string {
  _seq += 1;
  return `rec-${prefix}-${_seq}`;
}

// ---------------------------------------------------------------------------
// Heuristic engine
// ---------------------------------------------------------------------------

function runHeuristics(
  floors: Floor[],
  incidents: Incident[],
  kpis: BuildingKpis,
  presence: FloorPresence[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const openHigh = incidents.filter(
    (i) => i.severity === "crit" || i.severity === "warn",
  );

  const presenceByFloor = new Map(presence.map((p) => [p.floorKey, p]));
  const floorByKey = new Map(floors.map((f) => [f.key, f]));

  // 1. Battery level
  const batteryPct = kpis.batteryPct;
  if (batteryPct <= BATTERY_CRIT_PCT) {
    recs.push({
      id: recId("battery"),
      title: "Shed non-critical loads immediately — battery critically low",
      rationale: `Battery is at ${batteryPct}%, which risks a full blackout if generation cannot recover in the next discharge cycle.`,
      floorKey: "power-ops-core",
      severity: "crit",
      category: "energy",
      estimatedImpact: "Prevents uncontrolled shutdown",
      source: "heuristic",
    });
  } else if (batteryPct <= BATTERY_LOW_PCT) {
    recs.push({
      id: recId("battery"),
      title: "Pre-charge ESS — battery below 30%",
      rationale: `Battery is at ${batteryPct}%; pulling from grid now at off-peak rate is cheaper than emergency correction later.`,
      floorKey: "power-ops-core",
      severity: "warn",
      category: "energy",
      estimatedImpact: "Reduces islanding risk overnight",
      source: "heuristic",
    });
  }

  // 2. Grow-bank (food-floor) load shift
  const foodFloors = floors.filter((f) => f.need === "food");
  for (const ff of foodFloors) {
    const kgDay = ff.metrics.foodKgDay ?? 0;
    const hasOpenIncident = openHigh.some((i) => i.floorKey === ff.key);
    if (kgDay >= FOOD_HIGH_KG_DAY || hasOpenIncident) {
      recs.push({
        id: recId("food-offpeak"),
        title: `Shift grow-bank on ${ff.name} to off-peak hours`,
        rationale: `${ff.name} is producing ${kgDay} kg/day — a high lighting load${hasOpenIncident ? " with an open incident" : ""}; deferring to off-peak saves demand charges and eases the battery.`,
        floorKey: ff.key,
        severity: hasOpenIncident ? "warn" : "info",
        category: "food",
        estimatedImpact: "-12% grow-bank demand charge",
        source: "heuristic",
      });
    }
  }

  // 3. CO2 / ventilation
  const airFloors = floors.filter(
    (f) => f.metrics.co2Ppm !== undefined,
  );
  for (const af of airFloors) {
    const ppm = af.metrics.co2Ppm!;
    if (ppm >= CO2_CRIT_PPM) {
      recs.push({
        id: recId("co2-crit"),
        title: `Increase ventilation on ${af.name} — CO₂ critical`,
        rationale: `CO₂ is ${ppm} ppm on ${af.name}, exceeding the acute-risk threshold of ${CO2_CRIT_PPM} ppm; occupants may experience cognitive impairment.`,
        floorKey: af.key,
        severity: "crit",
        category: "air",
        estimatedImpact: "Reduces CO₂ to safe levels within 20 min",
        source: "heuristic",
      });
    } else if (ppm >= CO2_WARN_PPM) {
      recs.push({
        id: recId("co2-warn"),
        title: `Boost fresh-air supply on ${af.name}`,
        rationale: `CO₂ is ${ppm} ppm on ${af.name}, above the ASHRAE 62.1 guideline of ${CO2_WARN_PPM} ppm; ventilation boost recommended.`,
        floorKey: af.key,
        severity: "warn",
        category: "air",
        estimatedImpact: "Restores ASHRAE-compliant air quality",
        source: "heuristic",
      });
    }
  }

  // 4. Water reuse — inspect reclamation loop
  const waterFloors = floors.filter(
    (f) => f.need === "water" && f.metrics.waterReusePct !== undefined,
  );
  for (const wf of waterFloors) {
    const reuse = wf.metrics.waterReusePct!;
    if (reuse < WATER_REUSE_LOW_PCT) {
      recs.push({
        id: recId("water-reuse"),
        title: `Inspect reclamation loop on ${wf.name}`,
        rationale: `Water reuse is ${reuse}% on ${wf.name}, well below the ${WATER_REUSE_LOW_PCT}% baseline; a filter foul or valve fault may be reducing non-potable recovery.`,
        floorKey: wf.key,
        severity: "warn",
        category: "water",
        estimatedImpact: "Restores full non-potable reuse",
        source: "heuristic",
      });
    }
  }

  // 5. Vital-sign anomalies (presence + clinic)
  for (const p of presence) {
    const floor = floorByKey.get(p.floorKey);
    const floorName = floor?.name ?? p.floorKey;

    const breathingAbnormal =
      p.breathingBpm !== undefined &&
      (p.breathingBpm < BREATHING_LOW_BPM ||
        p.breathingBpm > BREATHING_HIGH_BPM);
    const heartAbnormal =
      p.heartBpm !== undefined &&
      (p.heartBpm < HEART_LOW_BPM || p.heartBpm > HEART_HIGH_BPM);

    if (breathingAbnormal || heartAbnormal) {
      const details: string[] = [];
      if (p.breathingBpm !== undefined)
        details.push(`breathing ${p.breathingBpm} bpm`);
      if (p.heartBpm !== undefined) details.push(`heart ${p.heartBpm} bpm`);
      recs.push({
        id: recId("vitals"),
        title: `Check on ${floorName} — vital signs out of normal band`,
        rationale: `WiFi-CSI sensing reports ${details.join(", ")} on ${floorName}; one or more values fall outside the normal resting range and warrant a welfare check.`,
        floorKey: p.floorKey,
        severity: "warn",
        category: "presence",
        estimatedImpact: "Early detection of health event",
        source: "heuristic",
      });
    }
  }

  // 6. HVAC setback — residential floor with no detected occupants
  const residentialFloors = floors.filter(
    (f) => f.residents > 0,
  );
  for (const rf of residentialFloors) {
    const p = presenceByFloor.get(rf.key);
    if (p && p.personCount <= SETBACK_OCCUPANCY_THRESHOLD && p.occupied === false) {
      recs.push({
        id: recId("hvac-setback"),
        title: `Set back HVAC on ${rf.name} — floor unoccupied`,
        rationale: `${rf.name} has ${rf.residents} registered resident(s) but presence sensing shows 0 people detected; reducing conditioning saves energy while they are away.`,
        floorKey: rf.key,
        severity: "info",
        category: "energy",
        estimatedImpact: "-8% HVAC load during unoccupied period",
        source: "heuristic",
      });
    }
  }

  // 7. Resilience sub-scores
  const { resilience } = kpis;
  if (resilience.energyPct < RESILIENCE_WARN_SCORE) {
    recs.push({
      id: recId("resilience-energy"),
      title: "Increase on-site energy generation capacity",
      rationale: `Energy resilience sub-score is ${resilience.energyPct}% (target ≥${RESILIENCE_WARN_SCORE}%); on-site generation covers less than ${RESILIENCE_WARN_SCORE}% of demand.`,
      floorKey: "power-ops-core",
      severity: "warn",
      category: "energy",
      estimatedImpact: `+${RESILIENCE_WARN_SCORE - resilience.energyPct}pp toward resilience target`,
      source: "heuristic",
    });
  }
  if (resilience.waterPct < RESILIENCE_WARN_SCORE) {
    recs.push({
      id: recId("resilience-water"),
      title: "Improve non-potable water reuse to hit resilience target",
      rationale: `Water resilience sub-score is ${resilience.waterPct}% (target ≥${RESILIENCE_WARN_SCORE}%); greywater or rainwater recovery appears below design spec.`,
      severity: "warn",
      category: "water",
      estimatedImpact: `+${RESILIENCE_WARN_SCORE - resilience.waterPct}pp toward resilience target`,
      source: "heuristic",
    });
  }
  if (resilience.foodPct < RESILIENCE_WARN_SCORE) {
    recs.push({
      id: recId("resilience-food"),
      title: "Expand indoor food production to close resilience gap",
      rationale: `Food resilience sub-score is ${resilience.foodPct}% (target ≥${RESILIENCE_WARN_SCORE}%); on-site yield covers less than ${RESILIENCE_WARN_SCORE}% of resident daily caloric need.`,
      severity: "info",
      category: "food",
      estimatedImpact: `+${RESILIENCE_WARN_SCORE - resilience.foodPct}pp food sub-score`,
      source: "heuristic",
    });
  }

  // Sort: crit → warn → info → ok
  recs.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  // Clamp to a readable set (4–8 recs)
  return recs.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Anthropic AI path (optional; wrapped in try/catch + AbortController)
// ---------------------------------------------------------------------------

// Type-narrowing helpers for the unknown Anthropic response

interface AiRecRaw {
  title: unknown;
  rationale: unknown;
  floorKey?: unknown;
  severity?: unknown;
  category?: unknown;
  estimatedImpact?: unknown;
}

function isValidSeverity(
  v: unknown,
): v is Recommendation["severity"] {
  return v === "crit" || v === "warn" || v === "info" || v === "ok";
}

function isValidCategory(v: unknown): v is RecCategory {
  return (
    v === "energy" ||
    v === "water" ||
    v === "food" ||
    v === "air" ||
    v === "presence" ||
    v === "ops"
  );
}

function isAiRecRaw(v: unknown): v is AiRecRaw {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.title === "string" && typeof obj.rationale === "string";
}

function parseAiRecs(raw: unknown): Recommendation[] {
  // The AI is asked to return a JSON array; it may wrap it in ```json ``` fences.
  let arr: unknown = raw;

  // If raw is a string (message text), extract JSON array from it.
  if (typeof raw === "string") {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      arr = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(arr)) return [];

  const recs: Recommendation[] = [];
  for (const item of arr) {
    if (!isAiRecRaw(item)) continue;
    const severity = isValidSeverity(item.severity) ? item.severity : "info";
    const category = isValidCategory(item.category) ? item.category : "ops";
    recs.push({
      id: recId("ai"),
      title: String(item.title),
      rationale: String(item.rationale),
      floorKey:
        item.floorKey != null && typeof item.floorKey === "string"
          ? item.floorKey
          : null,
      severity,
      category,
      estimatedImpact:
        typeof item.estimatedImpact === "string"
          ? item.estimatedImpact
          : undefined,
      source: "ai",
    });
  }
  return recs;
}

async function fetchAiRecs(
  floors: Floor[],
  kpis: BuildingKpis,
  presence: FloorPresence[],
  openIncidents: Incident[],
): Promise<Recommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  // Compact snapshot — keep the prompt token count low
  const snapshot = {
    kpis: {
      batteryPct: kpis.batteryPct,
      autonomyPct: kpis.autonomyPct,
      waterReusePct: kpis.waterReusePct,
      foodKgDay: kpis.foodKgDay,
      residents: kpis.residents,
      openIncidents: kpis.openIncidents,
      resilience: kpis.resilience,
    },
    floors: floors.map((f) => ({
      key: f.key,
      name: f.name,
      need: f.need,
      residents: f.residents,
      metrics: f.metrics,
    })),
    presence: presence.map((p) => ({
      floorKey: p.floorKey,
      occupied: p.occupied,
      personCount: p.personCount,
      breathingBpm: p.breathingBpm,
      heartBpm: p.heartBpm,
    })),
    openIncidents: openIncidents.map((i) => ({
      severity: i.severity,
      floorKey: i.floorKey,
      title: i.title,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system:
          "You are ATLAS building-ops advisor. Return STRICT JSON array of objects with fields: title (string, imperative), rationale (string, one sentence), floorKey (string|null), severity (crit|warn|info|ok), category (energy|water|food|air|presence|ops), estimatedImpact (string, optional). No markdown, no preamble — only the raw JSON array.",
        messages: [
          {
            role: "user",
            content: `Building snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn 3–5 prioritised operational recommendations as a strict JSON array.`,
          },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("content" in data)
    )
      return [];

    const content = (data as Record<string, unknown>).content;
    if (!Array.isArray(content) || content.length === 0) return [];

    // Extract text from the first content block
    const firstBlock = content[0] as Record<string, unknown>;
    const text = typeof firstBlock.text === "string" ? firstBlock.text : "";
    if (!text) return [];

    return parseAiRecs(text);
  } catch {
    // Timeout, network error, JSON parse failure — silently fall back
    clearTimeout(timeoutId);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Gather building data, run the heuristic engine, and optionally augment with
 * an Anthropic AI call. Always returns at least the heuristic recommendations;
 * never throws.
 */
export async function getRecommendations(): Promise<Recommendation[]> {
  // Reset the ID sequence each call so IDs are stable within a response
  _seq = 0;

  // Gather all data in parallel
  const [floors, incidents, kpis, presence] = await Promise.all([
    getFloors(),
    getIncidents(),
    getBuildingKpis(),
    getPresence(),
  ]);

  // Always run heuristics first — this is the authoritative path
  const heuristics = runHeuristics(floors, incidents, kpis, presence);

  if (!isAdvisorAiEnabled) {
    return heuristics;
  }

  // Optional AI path — wrap entirely so any failure returns heuristics
  try {
    const openIncidents = incidents.filter(
      (i) => i.severity === "crit" || i.severity === "warn",
    );
    const aiRecs = await fetchAiRecs(floors, kpis, presence, openIncidents);

    if (aiRecs.length === 0) {
      return heuristics;
    }

    // Merge: AI recs first (source:"ai"), then heuristic recs that cover
    // categories not already addressed by the AI set.
    const aiCategories = new Set(aiRecs.map((r) => r.category));
    const supplemental = heuristics.filter(
      (r) => !aiCategories.has(r.category),
    );
    const merged = [...aiRecs, ...supplemental];

    merged.sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
    );

    return merged.slice(0, 8);
  } catch {
    return heuristics;
  }
}
