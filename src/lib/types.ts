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
