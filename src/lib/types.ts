// Shared domain types for ATLAS OS (the Habitat Twin).
// These mirror the data model in the PRD (§10) and are the single source of
// truth shared by the API routes, the seed layer, and the React components.

// --- Regulatory / permitting types (OBC/NBC occupancy matrix) ---

/**
 * OBC/NBC occupancy group for a floor. Maps to the letter classifications used
 * in the Ontario Building Code and the National Building Code of Canada:
 *  A = Assembly, B = Care/Detention, C = Residential, D = Business/Personal
 *  services, E = Mercantile, F = Industrial (including mechanical).
 *
 * These are assigned per-floor and must match the permitting strategy in
 * docs/ATLAS-derisking-plan.md. Keeping them machine-readable allows permit
 * cost modeling and fire-code occupant-load calculations to be automated.
 */
export type OccupancyGroup = "A" | "B" | "C" | "D" | "E" | "F";

/**
 * High-level use scope for a floor. Distinguishes how the space is operated
 * (residential tenancy vs. building amenity vs. business vs. mechanical plant
 * vs. industrial process) for zoning, financing, and insurance purposes.
 */
export type UseScope =
  | "residential"
  | "amenity"
  | "business"
  | "mechanical"
  | "industrial";

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
  /**
   * % of *non-potable* water demand served by on-site reuse
   * (greywater/rainwater → toilets/irrigation). This is deliberately scoped to
   * non-potable end uses: on-site blackwater→potable reuse is not permittable in
   * Canadian jurisdictions, so the headline KPI must read as non-potable reuse.
   * See docs/ATLAS-derisking-plan.md §Water.
   */
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
  /**
   * OBC/NBC occupancy group for permit classification.
   * See `OccupancyGroup` for the full mapping. Optional so existing seed data
   * that predates the regulatory spine stays compatible.
   */
  occupancyGroup?: OccupancyGroup;
  /**
   * High-level use scope — how this floor is operated for zoning/financing.
   * See `UseScope`. Optional for back-compat.
   */
  useScope?: UseScope;
  /**
   * Number of self-contained dwellings on this floor. Only set for
   * residential (Group C) floors; undefined for mechanical/amenity/etc.
   * Distinct from `residents` (current occupancy) and `beds` (capacity).
   */
  dwellings?: number;
  /**
   * Sleeping capacity in beds for this floor. Set on residential floors.
   * Distinct from `residents` (live occupancy headcount).
   */
  beds?: number;
  /**
   * Plain-English notes encoding the permitting / regulatory strategy for
   * this floor — OBC citations, MECP requirements, zoning conditions, etc.
   * Stored as a string array so they can be rendered as a checklist.
   */
  regulatoryNotes?: string[];
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

/**
 * Transparent resilience sub-scores for a building (all values 0–100).
 *
 * This replaces a single blanket "autonomy" or "self-sufficiency" claim with
 * three independently auditable dimensions — energy, water, food — plus an
 * overall average. The split is required by the de-risking plan
 * (docs/ATLAS-derisking-plan.md) because lenders and permitters flag blanket
 * claims; sub-scores can be independently verified and stressed.
 */
export interface ResilienceIndex {
  /** Simple average of the three sub-scores: Math.round((energy+water+food)/3). */
  overall: number;
  /** % of electrical demand met by on-site generation, capped at 100. */
  energyPct: number;
  /** % of non-potable water demand met by on-site reuse, capped at 100. */
  waterPct: number;
  /** % of resident daily food caloric need met by on-site production, capped at 100. */
  foodPct: number;
}

/** Aggregate building KPIs surfaced in the top strip (F5). */
export interface BuildingKpis {
  /**
   * % of electrical demand met by on-site generation (0–100).
   * Kept for back-compat; equal to `resilience.energyPct`.
   */
  autonomyPct: number;
  batteryPct: number;
  solarKw: number;
  waterReusePct: number;
  foodKgDay: number;
  residents: number;
  openIncidents: number;
  /** Transparent resilience sub-scores replacing a blanket "autonomy" claim. */
  resilience: ResilienceIndex;
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

// --- F7: fleet ---

/** Operational status of an ATLAS building in the fleet view (F7). */
export type BuildingStatus = "online" | "degraded" | "offline";

// --- Permitting / building-code compliance layer ---

/**
 * Status of the MECP Environmental Compliance Approval for the building's
 * water-reuse works (greywater/rainwater → non-potable distribution).
 *  "approved"          — ECA in hand; construction/operation permitted.
 *  "in-review"         — formal ECA submission filed; MECP review underway.
 *  "pre-consultation"  — pre-submission meeting held; formal submission pending.
 *  "not-started"       — ECA process not yet initiated.
 */
export type EcaStatus =
  | "approved"
  | "in-review"
  | "pre-consultation"
  | "not-started";

/**
 * Egress, accessibility, fire, plumbing, and ESS compliance snapshot for a
 * single ATLAS building, capturing the key items from the de-risking plan
 * (docs/ATLAS-derisking-plan.md flaws #5–#8).
 *
 * All fields reflect the *designed / permitted* state — operators update these
 * as permit milestones are achieved. Optional on `Building` so buildings that
 * predate this layer stay valid.
 */
export interface BuildingCompliance {
  /** Number of passenger elevators. Two is the minimum for redundancy and AODA accessibility. */
  elevators: number;
  /** Whether a dedicated firefighter elevator (OBC 3.2.6.7) is provided. */
  firefighterElevator: boolean;
  /** Number of pressurized exit stairs (OBC 9.9 / Part 3 egress). */
  exitStairs: number;
  /** Whether the building is fully sprinklered (NFPA 13 / OBC Div.B Pt.3). */
  sprinklered: boolean;
  /** Whether the building is barrier-free throughout (AODA / OBC 3.8). */
  barrierFree: boolean;
  /**
   * Whether CSA B128 non-potable (purple-pipe) dual distribution is installed.
   * Required for any on-site greywater/rainwater reuse serving toilets/irrigation.
   */
  dualPlumbing: boolean;
  /**
   * MECP Environmental Compliance Approval status for the water-reuse works.
   * Required before any non-potable reuse system can legally operate in Ontario.
   */
  mecpEcaStatus: EcaStatus;
  /**
   * Location of the bulk water cistern / reservoir.
   * Decision from the de-risking plan: relocate from roof to basement to
   * eliminate the structural/seismic loading premium and simplify the core.
   */
  reservoirLocation: "basement" | "roof";
  /**
   * Whether the ESS (battery-wall) installation is designed to the current
   * energy-storage fire code (separation, ventilation, detection per OBC/NFPA 855).
   */
  essFireCompliant: boolean;
}

/**
 * A single ATLAS building, plotted on the fleet map (PRD §10). Carries a few
 * rollup metrics so the fleet view can render at-a-glance health without
 * loading each building's full floor stack.
 */
export interface Building {
  /** stable key, e.g. "atlas-01" */
  id: string;
  name: string;
  location: {
    /** human-readable place, e.g. "Toronto, ON" */
    label: string;
    lat: number;
    lng: number;
  };
  status: BuildingStatus;
  /**
   * Number of floors in the stack (the physical level count) — NOT the number
   * of homes. Kept distinct from `dwellings`/`beds` because conflating the two
   * is the first thing a planner/lender flags. See docs/ATLAS-derisking-plan.md.
   */
  unitCount: number;
  /** number of self-contained dwellings (homes) — the count a lender underwrites */
  dwellings?: number;
  /** sleeping capacity in beds — distinct from current `residents` (occupancy) */
  beds?: number;
  /**
   * rollup: % of *energy* demand met by on-site generation (energy autonomy).
   * This is one sub-score of overall resilience, not a blanket "self-sufficiency"
   * claim — water/food are tracked separately. See docs/ATLAS-derisking-plan.md.
   */
  autonomyPct: number;
  /** rollup: total residents currently housed (occupancy, not capacity) */
  residents: number;
  /** rollup: count of open (crit/warn) incidents */
  openIncidents: number;
  /**
   * Whether the building is connected to the utility grid (true for all
   * current ATLAS buildings — grid-tied is a permitting/financing prerequisite;
   * pure off-grid is explicitly out of scope per the de-risking plan).
   */
  gridTied?: boolean;
  /**
   * Whether the building's energy system can island (operate autonomously)
   * during a grid outage. Requires certified ESS + transfer-switch equipment.
   * False for sites still in commissioning or without ESS certification.
   */
  islandCapable?: boolean;
  /**
   * Egress, accessibility, fire, plumbing, and ESS compliance snapshot.
   * Optional — buildings that predate this compliance layer render unchanged.
   * See `BuildingCompliance` and docs/ATLAS-derisking-plan.md §5–8.
   */
  compliance?: BuildingCompliance;
}
