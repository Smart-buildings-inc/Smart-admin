// Carbon & ESG accounting for ATLAS OS.
//
// Computes operational (Scope 2) and embodied (Scope 3 / upfront) carbon for
// each floor and the building as a whole, then maps results to the green
// financing programs that carbon performance supports.
//
// === DOCUMENTED ASSUMPTIONS ===
//
//  GRID_FACTOR_GCO2_PER_KWH = 30
//    Ontario grid emission intensity, gCO2e per kWh of electricity consumed.
//    Source: Canada Energy Regulator / IESO 2023 published grid average for ON.
//    Ontario's large hydro + nuclear share keeps this among the lowest grids in
//    North America (~15–40 gCO2e/kWh over recent years). 30 is a conservative
//    mid-range estimate suitable for planning purposes.
//
//  FLOOR_AREA_M2 = 700
//    Assumed gross floor area per floor (10 m module × 70 m perimeter footprint).
//    ATLAS-01 is modelled on a ~10 m × 70 m structural bay.  Adjust to the
//    permitted drawings once available.
//
//  EMBODIED_TCO2E_PER_M2 = 0.5
//    One-time embodied carbon per m² of floor area, tCO2e.
//    Industry benchmark for a high-performance mass-timber/concrete hybrid mid-rise
//    in Canada: 350–600 kgCO2e/m² GFA (ZERO Code / EC3 database mid-range).
//    0.5 tCO2e/m² (= 500 kgCO2e/m²) is a deliberately conservative planning
//    estimate; a full LCA will replace this.
//
// All three constants are exported so downstream pages can surface them to users
// alongside a disclosure that they are illustrative pending a real LCA/measurement.

import { getFloors } from "@/lib/data";
import type { Floor } from "@/lib/types";

// ── Constants (all exported for UI disclosure) ──────────────────────────────

/** Ontario grid emission intensity in gCO2e per kWh (IESO 2023 average). */
export const GRID_FACTOR_GCO2_PER_KWH = 30;

/** Assumed gross floor area per floor in m² (10 m module × ~70 m bay). */
export const FLOOR_AREA_M2 = 700;

/**
 * One-time embodied carbon per m² of floor area in tCO2e.
 * Industry benchmark (EC3/ZERO Code): 350–600 kgCO2e/m² for a hybrid mid-rise.
 * Using 0.5 t (500 kg) as a conservative planning estimate pending full LCA.
 */
export const EMBODIED_TCO2E_PER_M2 = 0.5;

// ── Public types (contract) ──────────────────────────────────────────────────

export interface FloorCarbon {
  floorKey: string;
  name: string;
  need: string;
  /** Gross operational carbon from electricity demand, tCO2e/yr. */
  operationalTco2ePerYr: number;
  /** On-site generation offsets credited against the gross figure, tCO2e/yr. */
  avoidedTco2ePerYr: number;
  /** Net operational carbon (gross − avoided), tCO2e/yr. Can be negative for net-positive floors. */
  netOperationalTco2ePerYr: number;
  /** One-time embodied carbon from construction materials, tCO2e. */
  embodiedTco2e: number;
}

export interface BuildingCarbon {
  /** Sum of gross operational carbon across all floors, tCO2e/yr. */
  operationalTco2ePerYr: number;
  /** Sum of on-site generation offsets, tCO2e/yr. */
  avoidedTco2ePerYr: number;
  /** Net operational carbon (gross − avoided), tCO2e/yr. */
  netOperationalTco2ePerYr: number;
  /** Sum of one-time embodied carbon across all floors, tCO2e. */
  embodiedTco2e: number;
  /** Net operational carbon per dwelling per year, tCO2e/dwelling/yr. */
  perDwellingTco2ePerYr: number;
  /** Grid emission factor used in this calculation, gCO2e/kWh. */
  gridFactorGco2PerKwh: number;
  /** Green funding programs whose eligibility this carbon performance supports. */
  programs: string[];
  /** Per-floor breakdown. */
  floors: FloorCarbon[];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the electrical load of a floor in kW.
 * We prefer `metrics.loadKw` (metered demand); fall back to `metrics.energyKw`
 * only for floors where that field represents consumption (non-energy floors).
 * The energy floor's `energyKw` is generation, not load, so we exclude it.
 */
function electricalLoadKw(floor: Floor): number {
  if (floor.metrics.loadKw !== undefined) return floor.metrics.loadKw;
  // For food / water / air floors that report energyKw as consumption:
  if (floor.need !== "energy" && floor.metrics.energyKw !== undefined) {
    return floor.metrics.energyKw;
  }
  return 0;
}

/**
 * Returns the on-site generation output of a floor in kW.
 * Only the "energy" need floor generates; other floors' energyKw represents
 * consumption (handled in electricalLoadKw above).
 */
function onSiteGenKw(floor: Floor): number {
  if (floor.need === "energy" && floor.metrics.energyKw !== undefined) {
    return floor.metrics.energyKw;
  }
  return 0;
}

/**
 * Convert kW → tCO2e/yr using the Ontario grid factor.
 * kW × 8 760 h/yr × gridFactor gCO2e/kWh ÷ 1 000 000 = tCO2e/yr
 */
function kwToTco2ePerYr(kw: number): number {
  return (kw * 8_760 * GRID_FACTOR_GCO2_PER_KWH) / 1_000_000;
}

/** Round to two decimal places for a clean API surface. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute operational + embodied carbon per floor and for the building.
 *
 * Never throws — returns zeros when floor data is unavailable or metrics are
 * missing, consistent with the project's local-first / seed-fallback contract.
 */
export async function getBuildingCarbon(): Promise<BuildingCarbon> {
  let floors: Floor[];
  try {
    floors = await getFloors();
  } catch {
    floors = [];
  }

  const floorCarbons: FloorCarbon[] = floors.map((floor) => {
    const loadKw = electricalLoadKw(floor);
    const genKw = onSiteGenKw(floor);

    const grossOperational = kwToTco2ePerYr(loadKw);
    const avoided = kwToTco2ePerYr(genKw);
    const netOperational = grossOperational - avoided;
    const embodied = FLOOR_AREA_M2 * EMBODIED_TCO2E_PER_M2;

    return {
      floorKey: floor.key,
      name: floor.name,
      need: floor.need,
      operationalTco2ePerYr: r2(grossOperational),
      avoidedTco2ePerYr: r2(avoided),
      netOperationalTco2ePerYr: r2(netOperational),
      embodiedTco2e: r2(embodied),
    };
  });

  const totalGross = r2(
    floorCarbons.reduce((s, f) => s + f.operationalTco2ePerYr, 0),
  );
  const totalAvoided = r2(
    floorCarbons.reduce((s, f) => s + f.avoidedTco2ePerYr, 0),
  );
  const totalNet = r2(totalGross - totalAvoided);
  const totalEmbodied = r2(
    floorCarbons.reduce((s, f) => s + f.embodiedTco2e, 0),
  );

  // Total dwellings across the building (shelter floors only).
  const totalDwellings = floors.reduce(
    (s, f) => s + (f.dwellings ?? 0),
    0,
  );
  const perDwelling = totalDwellings > 0 ? r2(totalNet / totalDwellings) : 0;

  return {
    operationalTco2ePerYr: totalGross,
    avoidedTco2ePerYr: totalAvoided,
    netOperationalTco2ePerYr: totalNet,
    embodiedTco2e: totalEmbodied,
    perDwellingTco2ePerYr: perDwelling,
    gridFactorGco2PerKwh: GRID_FACTOR_GCO2_PER_KWH,
    programs: [
      "NRCan Greener Affordable Housing",
      "Save on Energy",
      "CMHC MLI Select (energy points)",
    ],
    floors: floorCarbons,
  };
}
