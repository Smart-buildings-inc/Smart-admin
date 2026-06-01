// Fleet data-access layer for ATLAS OS (F7).
//
// Kept separate from src/lib/data.ts so the multi-building fleet view can be
// developed without touching the single-building console plumbing. Same
// seed-fallback pattern: when no DATABASE_URL is configured we serve the
// in-memory seed buildings; otherwise we read from Drizzle/Neon.

import { getDb, isDbConfigured, schema } from "@/lib/db";
import { seedBuildings } from "@/lib/db/seed-data";
import type { Building, BuildingStatus } from "@/lib/types";

export async function getBuildings(): Promise<Building[]> {
  const db = getDb();
  if (!db) {
    return [...seedBuildings];
  }
  const rows = await db.select().from(schema.buildings);
  return rows.map((r) => ({
    id: r.key,
    name: r.name,
    location: { label: r.locationLabel, lat: r.lat, lng: r.lng },
    status: r.status as BuildingStatus,
    unitCount: r.unitCount,
    autonomyPct: r.autonomyPct,
    residents: r.residents,
    openIncidents: r.openIncidents,
  }));
}

export { isDbConfigured };
