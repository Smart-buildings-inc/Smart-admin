// Fleet-wide rollup aggregations for ATLAS OS (F7).
//
// `computeFleetRollup` is a PURE function (no I/O) so it can be called from
// the client-side FleetView component (already has the buildings array). The
// async `getFleetRollup` is a thin server-side wrapper used by the API route.

import type { Building, BuildingCompliance } from "@/lib/types";
import { getBuildings } from "@/lib/fleet";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface FleetRollup {
  /** Total number of buildings in the fleet. */
  buildings: number;
  /** Count with status === "online". */
  online: number;
  /** Count with status === "degraded". */
  degraded: number;
  /** Count with status === "offline". */
  offline: number;
  /** Sum of residents across all buildings. */
  totalResidents: number;
  /** Sum of dwellings across all buildings (undefined dwellings treated as 0). */
  totalDwellings: number;
  /** Sum of beds across all buildings (undefined beds treated as 0). */
  totalBeds: number;
  /**
   * Fleet mean of autonomyPct, rounded to the nearest integer.
   * Zero when the fleet is empty.
   */
  avgEnergyAutonomy: number;
  /** Count of buildings where gridTied === true. */
  gridTied: number;
  /** Count of buildings where islandCapable === true. */
  islandCapable: number;
  /** Count of buildings where compliance.mecpEcaStatus === "approved". */
  ecaApproved: number;
  /**
   * Fleet mean per-building compliance score (0–100), rounded to the nearest
   * integer. Zero when the fleet is empty. See `buildingComplianceScore` for
   * the per-building formula.
   */
  compliancePct: number;
}

// ---------------------------------------------------------------------------
// Per-building compliance score (0–100)
//
// Formula: average of 9 boolean criteria (each worth 1/9 of 100 points).
// A criterion is "met" when the condition below is true. If a building has no
// compliance object at all, its score is 0.
//
// Criteria:
//   1. elevators >= 2               (redundancy + AODA accessibility)
//   2. firefighterElevator === true (OBC 3.2.6.7)
//   3. exitStairs >= 2              (OBC Part 3 egress)
//   4. sprinklered === true         (NFPA 13 / OBC Div.B Pt.3)
//   5. barrierFree === true         (AODA / OBC 3.8)
//   6. dualPlumbing === true        (CSA B128 non-potable distribution)
//   7. essFireCompliant === true    (NFPA 855 / OBC ESS fire code)
//   8. reservoirLocation === "basement" (de-risking plan structural req.)
//   9. mecpEcaStatus !== "not-started"  (any ECA progress counts)
//
// Score = (met criteria / 9) × 100, rounded to nearest integer.
// ---------------------------------------------------------------------------

function buildingComplianceScore(c: BuildingCompliance | undefined): number {
  if (c === undefined) return 0;

  const criteria: boolean[] = [
    c.elevators >= 2,
    c.firefighterElevator === true,
    c.exitStairs >= 2,
    c.sprinklered === true,
    c.barrierFree === true,
    c.dualPlumbing === true,
    c.essFireCompliant === true,
    c.reservoirLocation === "basement",
    c.mecpEcaStatus !== "not-started",
  ];

  const met = criteria.filter(Boolean).length;
  return Math.round((met / criteria.length) * 100);
}

// ---------------------------------------------------------------------------
// Pure aggregate helper — safe to call from client components
// ---------------------------------------------------------------------------

export function computeFleetRollup(buildings: Building[]): FleetRollup {
  const n = buildings.length;

  if (n === 0) {
    return {
      buildings: 0,
      online: 0,
      degraded: 0,
      offline: 0,
      totalResidents: 0,
      totalDwellings: 0,
      totalBeds: 0,
      avgEnergyAutonomy: 0,
      gridTied: 0,
      islandCapable: 0,
      ecaApproved: 0,
      compliancePct: 0,
    };
  }

  let online = 0;
  let degraded = 0;
  let offline = 0;
  let totalResidents = 0;
  let totalDwellings = 0;
  let totalBeds = 0;
  let sumAutonomy = 0;
  let gridTied = 0;
  let islandCapable = 0;
  let ecaApproved = 0;
  let sumCompliance = 0;

  for (const b of buildings) {
    if (b.status === "online") online++;
    else if (b.status === "degraded") degraded++;
    else offline++;

    totalResidents += b.residents;
    totalDwellings += b.dwellings ?? 0;
    totalBeds += b.beds ?? 0;
    sumAutonomy += b.autonomyPct;

    if (b.gridTied === true) gridTied++;
    if (b.islandCapable === true) islandCapable++;
    if (b.compliance?.mecpEcaStatus === "approved") ecaApproved++;

    sumCompliance += buildingComplianceScore(b.compliance);
  }

  return {
    buildings: n,
    online,
    degraded,
    offline,
    totalResidents,
    totalDwellings,
    totalBeds,
    avgEnergyAutonomy: Math.round(sumAutonomy / n),
    gridTied,
    islandCapable,
    ecaApproved,
    compliancePct: Math.round(sumCompliance / n),
  };
}

// ---------------------------------------------------------------------------
// Async server helper — used by GET /api/fleet
// ---------------------------------------------------------------------------

export async function getFleetRollup(): Promise<FleetRollup> {
  const buildings = await getBuildings();
  return computeFleetRollup(buildings);
}
