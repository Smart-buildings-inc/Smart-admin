// Shared domain types for ATLAS OS (the Habitat Twin).
// These mirror the data model in the PRD (§10) and are the single source of
// truth shared by the API routes, the seed layer, and the React components.

/** The seven human needs each floor is dedicated to (Maslow-mapped). */
export type Need =
  | "water"
  | "energy"
  | "food"
  | "shelter"
  | "air"
  | "health"
  | "restoration";

/** Severity ranking for the incident feed. */
export type Severity = "crit" | "warn" | "info" | "ok";

/** Live per-floor metrics. Sparse by design — each floor reports what it has. */
export interface FloorMetrics {
  /** kW currently generated (energy floors) */
  energyKw?: number;
  /** kW currently consumed */
  loadKw?: number;
  /** % battery state of charge */
  batteryPct?: number;
  /** litres/hour throughput (water floors) */
  waterLph?: number;
  /** % of greywater reused */
  waterReusePct?: number;
  /** kg/day food output (food floors) */
  foodKgDay?: number;
  /** people currently present */
  occupancy?: number;
  /** °C */
  tempC?: number;
  /** relative humidity % */
  humidityPct?: number;
  /** CO2 ppm (air floors) */
  co2Ppm?: number;
  /** particulate matter µg/m³ */
  pm25?: number;
}

export interface Floor {
  /** stable key, e.g. "reclamation-core" */
  key: string;
  name: string;
  need: Need;
  /** short human-need label, e.g. "Water & Waste" */
  category: string;
  /** physical level: negative for basement, used to order bottom→top */
  level: number;
  /** number of residents housed on this floor (0 for non-residential) */
  residents: number;
  metrics: FloorMetrics;
}

export interface Incident {
  id: string;
  severity: Severity;
  floorKey: string | null;
  title: string;
  detail?: string;
  createdAt: string; // ISO timestamp
}

export interface Broadcast {
  id: string;
  message: string;
  audience: string; // e.g. "all", "residences", "floor:vertical-farm"
  recipients: number;
  createdAt: string; // ISO timestamp
}

/** Aggregate building KPIs surfaced in the top strip (F5). */
export interface BuildingKpis {
  autonomyPct: number;
  batteryPct: number;
  solarKw: number;
  waterReusePct: number;
  foodKgDay: number;
  residents: number;
  openIncidents: number;
}

// --- F11: sensor ingestion ---
//
// A tagged-point model in the spirit of Brick Schema / Project Haystack.
// Every physical telemetry reading from the building maps to a `SensorPoint`:
// a single timestamped value carried alongside the semantic tags that say
// *what* it measures and *where*. This lets downstream consumers query by
// meaning ("all electric power points on the energy floor") rather than by
// brittle, vendor-specific point names.

/**
 * A single timestamped sensor reading with semantic tags.
 *
 * Tagging follows two complementary conventions, both optional-friendly:
 *  - `tag`     — a dotted Brick-style class path, e.g. "sensor.electric.power"
 *                or "sensor.air.co2". This is the primary semantic identifier.
 *  - `markers` — a flat list of Haystack-style marker tags, e.g.
 *                ["sensor", "electric", "power"] or ["sensor", "temp", "air"].
 *                Useful for set-based filtering ("everything tagged `power`").
 */
export interface SensorPoint {
  /** Stable point id, e.g. "sp-power-ops-core-power". */
  id: string;
  /** Brick-style dotted semantic class, e.g. "sensor.electric.power". */
  tag: string;
  /** Haystack-style flat marker tags, e.g. ["sensor","electric","power"]. */
  markers: string[];
  /** Floor this point lives on — matches a `Floor.key`. */
  floorKey: string;
  /** Optional sub-location / equipment ref within the floor, e.g. "inverter-1". */
  unit?: string;
  /** Coarse point kind/quantity, e.g. "power", "temp", "co2", "flow". */
  kind: string;
  /** Latest numeric reading. */
  value: number;
  /** Engineering unit of `value`, e.g. "kW", "°C", "ppm", "L/h". */
  unitOfMeasure: string;
  /** ISO-8601 timestamp of the reading. */
  ts: string;
}
