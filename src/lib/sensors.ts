// F11 — Sensor ingestion data-access layer for ATLAS OS.
//
// Reads and writes the Brick Schema / Project Haystack-style tagged point model
// (see `SensorPoint` in src/lib/types.ts). Mirrors the seed-fallback pattern in
// src/lib/data.ts: when a database is configured it uses Drizzle, otherwise it
// serves (and mutates) an in-memory copy of the seed data so the prototype is
// fully interactive with no DB connected.
//
// Kept in its own module (not src/lib/data.ts) to avoid edit conflicts.

import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { seedSensorPoints } from "@/lib/db/seed-data";
import type { SensorPoint } from "@/lib/types";

// --- in-memory fallback store (seeded copy, mutable within a session) ---
const memSensorPoints: SensorPoint[] = [...seedSensorPoints];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Map a DB row to the domain `SensorPoint` shape. */
function rowToPoint(r: schema.SensorPointRow): SensorPoint {
  return {
    id: r.pointKey,
    tag: r.tag,
    markers: r.markers,
    floorKey: r.floorKey,
    unit: r.unit ?? undefined,
    kind: r.kind,
    value: r.value,
    unitOfMeasure: r.unitOfMeasure,
    ts: r.ts.toISOString(),
  };
}

/**
 * Return all sensor points, newest reading first. Optionally filter to a single
 * floor by its `Floor.key`.
 */
export async function getSensorPoints(
  floorKey?: string,
): Promise<SensorPoint[]> {
  const db = getDb();
  if (!db) {
    return [...memSensorPoints]
      .filter((p) => !floorKey || p.floorKey === floorKey)
      .sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  }
  const base = db.select().from(schema.sensorPoints);
  const rows = floorKey
    ? await base
        .where(eq(schema.sensorPoints.floorKey, floorKey))
        .orderBy(desc(schema.sensorPoints.ts))
    : await base.orderBy(desc(schema.sensorPoints.ts));
  return rows.map(rowToPoint);
}

/** Input for ingesting a reading. `id`, `markers`, and `ts` are optional. */
export interface NewSensorPoint {
  id?: string;
  tag: string;
  markers?: string[];
  floorKey: string;
  unit?: string;
  kind: string;
  value: number;
  unitOfMeasure: string;
  ts?: string;
}

/** Ingest a single sensor reading. */
export async function ingestSensorPoint(
  input: NewSensorPoint,
): Promise<SensorPoint> {
  const db = getDb();
  const id = input.id?.trim() || newId("sp");
  const markers = input.markers ?? [];
  const ts = input.ts ?? new Date().toISOString();

  if (!db) {
    const point: SensorPoint = {
      id,
      tag: input.tag,
      markers,
      floorKey: input.floorKey,
      unit: input.unit,
      kind: input.kind,
      value: input.value,
      unitOfMeasure: input.unitOfMeasure,
      ts,
    };
    memSensorPoints.unshift(point);
    return point;
  }

  const [row] = await db
    .insert(schema.sensorPoints)
    .values({
      pointKey: id,
      tag: input.tag,
      markers,
      floorKey: input.floorKey,
      unit: input.unit ?? null,
      kind: input.kind,
      value: input.value,
      unitOfMeasure: input.unitOfMeasure,
      ts: new Date(ts),
    })
    .returning();
  return rowToPoint(row);
}

/** Ingest a batch of sensor readings, preserving input order. */
export async function ingestSensorPoints(
  inputs: NewSensorPoint[],
): Promise<SensorPoint[]> {
  const results: SensorPoint[] = [];
  for (const input of inputs) {
    results.push(await ingestSensorPoint(input));
  }
  return results;
}
