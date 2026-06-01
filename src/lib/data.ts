// Data-access layer for ATLAS OS.
//
// Every read/write goes through here. When a database is configured it uses
// Drizzle; otherwise it serves (and mutates) an in-memory copy of the seed data
// so the prototype is fully interactive with no DB connected.

import { desc } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import {
  seedBroadcasts,
  seedFloors,
  seedIncidents,
} from "@/lib/db/seed-data";
import type {
  Broadcast,
  BuildingKpis,
  Floor,
  Incident,
  Severity,
} from "@/lib/types";

// --- in-memory fallback stores (seeded copies, mutable within a session) ---
const memIncidents: Incident[] = [...seedIncidents];
const memBroadcasts: Broadcast[] = [...seedBroadcasts];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// --------------------------------- floors ---------------------------------

export async function getFloors(): Promise<Floor[]> {
  const db = getDb();
  if (!db) {
    return [...seedFloors].sort((a, b) => a.level - b.level);
  }
  const rows = await db.select().from(schema.floors);
  return rows
    .map((r) => ({
      key: r.key,
      name: r.name,
      need: r.need as Floor["need"],
      category: r.category,
      level: r.level,
      residents: r.residents,
      metrics: r.metrics,
    }))
    .sort((a, b) => a.level - b.level);
}

// ------------------------------- incidents --------------------------------

export async function getIncidents(): Promise<Incident[]> {
  const db = getDb();
  if (!db) {
    return [...memIncidents].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }
  const rows = await db
    .select()
    .from(schema.incidents)
    .orderBy(desc(schema.incidents.createdAt));
  return rows.map((r) => ({
    id: String(r.id),
    severity: r.severity as Severity,
    floorKey: r.floorKey,
    title: r.title,
    detail: r.detail ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface NewIncident {
  severity: Severity;
  title: string;
  floorKey?: string | null;
  detail?: string;
}

export async function createIncident(input: NewIncident): Promise<Incident> {
  const db = getDb();
  if (!db) {
    const incident: Incident = {
      id: newId("inc"),
      severity: input.severity,
      floorKey: input.floorKey ?? null,
      title: input.title,
      detail: input.detail,
      createdAt: new Date().toISOString(),
    };
    memIncidents.unshift(incident);
    return incident;
  }
  const [row] = await db
    .insert(schema.incidents)
    .values({
      severity: input.severity,
      floorKey: input.floorKey ?? null,
      title: input.title,
      detail: input.detail,
    })
    .returning();
  return {
    id: String(row.id),
    severity: row.severity as Severity,
    floorKey: row.floorKey,
    title: row.title,
    detail: row.detail ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// ------------------------------- broadcasts -------------------------------

export async function getBroadcasts(): Promise<Broadcast[]> {
  const db = getDb();
  if (!db) {
    return [...memBroadcasts].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }
  const rows = await db
    .select()
    .from(schema.broadcasts)
    .orderBy(desc(schema.broadcasts.createdAt));
  return rows.map((r) => ({
    id: String(r.id),
    message: r.message,
    audience: r.audience,
    recipients: r.recipients,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface NewBroadcast {
  message: string;
  audience?: string;
}

/**
 * Create a broadcast. Recipient count is derived from the resident population
 * for the targeted audience, and the broadcast is mirrored into the incident
 * feed (F4) so operators see it alongside operational events.
 */
export async function createBroadcast(
  input: NewBroadcast,
): Promise<Broadcast> {
  const audience = input.audience?.trim() || "all";
  const recipients = await countRecipients(audience);

  const db = getDb();
  let broadcast: Broadcast;
  if (!db) {
    broadcast = {
      id: newId("bc"),
      message: input.message,
      audience,
      recipients,
      createdAt: new Date().toISOString(),
    };
    memBroadcasts.unshift(broadcast);
  } else {
    const [row] = await db
      .insert(schema.broadcasts)
      .values({ message: input.message, audience, recipients })
      .returning();
    broadcast = {
      id: String(row.id),
      message: row.message,
      audience: row.audience,
      recipients: row.recipients,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // Mirror into the incident feed.
  await createIncident({
    severity: "info",
    floorKey: null,
    title: `Broadcast to ${audience}: “${truncate(input.message, 80)}”`,
    detail: `Delivered to ${recipients} resident${recipients === 1 ? "" : "s"}.`,
  });

  return broadcast;
}

async function countRecipients(audience: string): Promise<number> {
  const floors = await getFloors();
  if (audience.startsWith("floor:")) {
    const key = audience.slice("floor:".length);
    return floors.find((f) => f.key === key)?.residents ?? 0;
  }
  if (audience === "residences") {
    return floors
      .filter((f) => f.need === "shelter")
      .reduce((sum, f) => sum + f.residents, 0);
  }
  // "all"
  return floors.reduce((sum, f) => sum + f.residents, 0);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ---------------------------------- KPIs ----------------------------------

export async function getBuildingKpis(): Promise<BuildingKpis> {
  const [floors, incidents] = await Promise.all([
    getFloors(),
    getIncidents(),
  ]);

  const solarKw = floors.reduce(
    (sum, f) => sum + (f.need === "energy" ? f.metrics.energyKw ?? 0 : 0),
    0,
  );
  const totalLoadKw = floors.reduce((sum, f) => sum + (f.metrics.loadKw ?? 0), 0);
  const totalGenKw = floors.reduce(
    (sum, f) => sum + (f.metrics.energyKw ?? 0),
    0,
  );
  const foodKgDay = floors.reduce(
    (sum, f) => sum + (f.metrics.foodKgDay ?? 0),
    0,
  );
  const residents = floors.reduce((sum, f) => sum + f.residents, 0);

  const battery =
    floors.find((f) => f.metrics.batteryPct !== undefined)?.metrics
      .batteryPct ?? 0;

  const reuseValues = floors
    .map((f) => f.metrics.waterReusePct)
    .filter((v): v is number => v !== undefined);
  const waterReusePct = reuseValues.length
    ? Math.round(reuseValues.reduce((a, b) => a + b, 0) / reuseValues.length)
    : 0;

  // Autonomy = share of demand met by on-site generation, capped at 100.
  const autonomyPct = totalLoadKw
    ? Math.min(100, Math.round((totalGenKw / totalLoadKw) * 100))
    : 100;

  const openIncidents = incidents.filter(
    (i) => i.severity === "crit" || i.severity === "warn",
  ).length;

  return {
    autonomyPct,
    batteryPct: Math.round(battery),
    solarKw: Math.round(solarKw),
    waterReusePct,
    foodKgDay: Math.round(foodKgDay),
    residents,
    openIncidents,
  };
}

export { isDbConfigured };
