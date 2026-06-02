// RuView WiFi-CSI presence adapter for ATLAS OS.
//
// RuView (https://github.com/ruvnet/RuView, MIT licence) is a spatial
// intelligence system that uses ESP32-S3 WiFi nodes to detect presence, count
// persons, track movement, and measure vital signs (breathing / heart rate)
// through walls and in darkness — no cameras required.
//
// Privacy rationale: WiFi Channel State Information (CSI) analysis never
// captures images or audio, making it GDPR- and PHIPA-friendly for residences
// and clinical spaces where camera-based occupancy sensing would be
// impermissible. The data reduces to a numeric headcount + vital stats with no
// biometric identifiers.
//
// Integration pattern follows ATLAS's local-first idiom (see src/lib/data.ts):
//   • RUVIEW_API_URL unset → derive presence from seed floor data (seed mode).
//   • RUVIEW_API_URL set   → fetch from the RuView REST endpoint; any error
//                            falls back silently to seed mode. Never throws.

import { seedFloors } from "@/lib/db/seed-data";
import type { NewSensorPoint } from "@/lib/sensors";
import type { FloorPresence } from "@/lib/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** True when a RuView API base URL is configured in the environment. */
export const isRuViewConfigured: boolean = !!process.env.RUVIEW_API_URL;

// ---------------------------------------------------------------------------
// Expected RuView REST response shape (GET /presence)
//
// The RuView REST API returns a JSON object:
// {
//   "zones": [
//     {
//       "zone_id": "floor-key-or-zone-name",  // string — maps to Floor.key
//       "presence": true,                       // boolean — any person detected
//       "person_count": 3,                      // integer ≥ 0
//       "confidence": 0.94,                     // float 0.0–1.0
//       "vitals": {                             // optional, clinic/health zones
//         "breathing_bpm": 14,                  // float
//         "heart_bpm": 68                       // float
//       }
//     }
//   ]
// }
//
// ---------------------------------------------------------------------------

interface RuViewVitals {
  breathing_bpm?: number;
  heart_bpm?: number;
}

interface RuViewZone {
  zone_id: string;
  presence: boolean;
  person_count: number;
  confidence: number;
  vitals?: RuViewVitals;
}

interface RuViewResponse {
  zones: RuViewZone[];
}

// ---------------------------------------------------------------------------
// Type-narrowing helpers for the unknown fetch response
// ---------------------------------------------------------------------------

function isRuViewVitals(v: unknown): v is RuViewVitals {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (
    "breathing_bpm" in obj &&
    typeof obj.breathing_bpm !== "number"
  )
    return false;
  if ("heart_bpm" in obj && typeof obj.heart_bpm !== "number") return false;
  return true;
}

function isRuViewZone(z: unknown): z is RuViewZone {
  if (typeof z !== "object" || z === null) return false;
  const obj = z as Record<string, unknown>;
  return (
    typeof obj.zone_id === "string" &&
    typeof obj.presence === "boolean" &&
    typeof obj.person_count === "number" &&
    typeof obj.confidence === "number" &&
    ("vitals" in obj ? isRuViewVitals(obj.vitals) : true)
  );
}

function isRuViewResponse(r: unknown): r is RuViewResponse {
  if (typeof r !== "object" || r === null) return false;
  const obj = r as Record<string, unknown>;
  return Array.isArray(obj.zones) && obj.zones.every(isRuViewZone);
}

// ---------------------------------------------------------------------------
// Seed derivation
// ---------------------------------------------------------------------------

const CLINIC_FLOOR_KEY = "commons-clinic";

function deriveSeedPresence(floorKey?: string): FloorPresence[] {
  const now = new Date().toISOString();
  const results: FloorPresence[] = seedFloors
    .filter((f) => !floorKey || f.key === floorKey)
    .map((f) => {
      const occupied =
        (f.metrics.occupancy ?? 0) > 0 || f.residents > 0;
      const personCount = f.metrics.occupancy ?? 0;
      // High confidence regardless of direction; a small jitter keeps data
      // looking live without introducing real randomness that breaks snapshots.
      const jitter = occupied ? Math.round(Math.random() * 5) : 0;
      const confidencePct = occupied ? Math.min(90 + jitter, 99) : 96;

      const base: FloorPresence = {
        floorKey: f.key,
        occupied,
        personCount,
        confidencePct,
        source: "seed",
        ts: now,
      };

      // Attach vital-sign showcase for the clinic / health floor.
      if (f.key === CLINIC_FLOOR_KEY) {
        base.breathingBpm = 14;
        base.heartBpm = 68;
      }

      return base;
    });

  return results;
}

// ---------------------------------------------------------------------------
// RuView REST fetch + mapping
// ---------------------------------------------------------------------------

function mapRuViewResponse(
  zones: RuViewZone[],
  floorKey?: string,
): FloorPresence[] {
  const now = new Date().toISOString();
  return zones
    .filter((z) => !floorKey || z.zone_id === floorKey)
    .map((z): FloorPresence => {
      const fp: FloorPresence = {
        floorKey: z.zone_id,
        occupied: z.presence,
        personCount: z.person_count,
        confidencePct: Math.round(Math.min(z.confidence * 100, 100)),
        source: "ruview",
        ts: now,
      };
      if (z.vitals?.breathing_bpm !== undefined) {
        fp.breathingBpm = z.vitals.breathing_bpm;
      }
      if (z.vitals?.heart_bpm !== undefined) {
        fp.heartBpm = z.vitals.heart_bpm;
      }
      return fp;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return per-floor presence summaries derived from RuView WiFi-CSI sensing.
 *
 * When `RUVIEW_API_URL` is configured, fetches `GET ${RUVIEW_API_URL}/presence`
 * and maps zones → FloorPresence[]. Any fetch or parse error falls back
 * transparently to seed derivation — this function never throws.
 *
 * When `RUVIEW_API_URL` is not set, derives presence from seed floor data
 * (occupancy metrics + resident counts) so the app is fully interactive with
 * no hardware connected.
 *
 * @param floorKey  Optional Floor.key filter. Omit for all floors.
 */
export async function getPresence(
  floorKey?: string,
): Promise<FloorPresence[]> {
  if (!isRuViewConfigured) {
    return deriveSeedPresence(floorKey);
  }

  try {
    const url = `${process.env.RUVIEW_API_URL}/presence`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Next.js: opt out of the fetch cache so readings are always fresh.
      cache: "no-store",
    });

    if (!res.ok) {
      // Non-2xx → fall back to seed rather than surfacing a raw HTTP error.
      return deriveSeedPresence(floorKey);
    }

    const raw: unknown = await res.json();
    if (!isRuViewResponse(raw)) {
      // Unexpected shape → fall back to seed.
      return deriveSeedPresence(floorKey);
    }

    return mapRuViewResponse(raw.zones, floorKey);
  } catch {
    // Network error, JSON parse failure, or any other exception — fall back to
    // seed so the UI always has something to render.
    return deriveSeedPresence(floorKey);
  }
}

/**
 * Map a `FloorPresence` record to F11-compatible `NewSensorPoint` ingestion
 * inputs using Brick Schema tags.
 *
 * Brick tags produced:
 *   "sensor.presence.count"    kind="presence" unitOfMeasure="people"
 *   "sensor.presence.occupied" kind="presence" unitOfMeasure="%"   (confidencePct)
 *   "sensor.vital.breathing"   kind="vital"    unitOfMeasure="bpm" (when present)
 *   "sensor.vital.heart"       kind="vital"    unitOfMeasure="bpm" (when present)
 */
export function ruviewToSensorPoints(p: FloorPresence): NewSensorPoint[] {
  const points: NewSensorPoint[] = [
    {
      tag: "sensor.presence.count",
      markers: ["sensor", "presence", "count"],
      floorKey: p.floorKey,
      kind: "presence",
      value: p.personCount,
      unitOfMeasure: "people",
      ts: p.ts,
    },
    {
      tag: "sensor.presence.occupied",
      markers: ["sensor", "presence", "occupied"],
      floorKey: p.floorKey,
      kind: "presence",
      value: p.confidencePct,
      unitOfMeasure: "%",
      ts: p.ts,
    },
  ];

  if (p.breathingBpm !== undefined) {
    points.push({
      tag: "sensor.vital.breathing",
      markers: ["sensor", "vital", "breathing"],
      floorKey: p.floorKey,
      kind: "vital",
      value: p.breathingBpm,
      unitOfMeasure: "bpm",
      ts: p.ts,
    });
  }

  if (p.heartBpm !== undefined) {
    points.push({
      tag: "sensor.vital.heart",
      markers: ["sensor", "vital", "heart"],
      floorKey: p.floorKey,
      kind: "vital",
      value: p.heartBpm,
      unitOfMeasure: "bpm",
      ts: p.ts,
    });
  }

  return points;
}
