// Server-side analytics assembly. Kept out of the route module (Next.js route
// files may only export route handlers/config) and out of the pure
// `analytics.ts` (which is import-safe for client components) so the data-layer
// imports stay server-only. Advisory only — see analytics.ts / OPR §4.

import { getFloors } from "@/lib/data";
import { getSensorPoints } from "@/lib/sensors";
import { summarize, type AnalyticsSummary } from "@/lib/analytics";

/**
 * Build the building-health summary from the data layer. Server components, the
 * /api/analytics route, and the copilot context all call this directly without
 * an HTTP round-trip.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const [floors, sensors] = await Promise.all([getFloors(), getSensorPoints()]);
  return summarize(floors, sensors);
}
