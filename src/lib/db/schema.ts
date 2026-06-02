// Drizzle schema for ATLAS OS. Targets Neon (serverless Postgres).
//
// The app is local-first: it renders on seed data when DATABASE_URL is unset
// (see src/lib/data.ts). This schema is what gets provisioned once an operator
// connects a real database via `npm run db:push`.

import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { FloorMetrics } from "@/lib/types";

export const floors = pgTable("floors", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  need: text("need").notNull(),
  category: text("category").notNull(),
  level: integer("level").notNull(),
  residents: integer("residents").notNull().default(0),
  metrics: jsonb("metrics").$type<FloorMetrics>().notNull().default({}),
  // --- Regulatory / permitting fields (OBC/NBC occupancy matrix) ---
  // occupancy_group: OBC/NBC letter classification (A–F).
  occupancyGroup: text("occupancy_group"),
  // use_scope: high-level operational scope for zoning/financing.
  useScope: text("use_scope"),
  // dwellings: self-contained homes on this floor (residential floors only).
  dwellings: integer("dwellings"),
  // beds: sleeping capacity (residential floors only).
  beds: integer("beds"),
  // regulatory_notes: permit/code notes stored as a JSON string array.
  regulatoryNotes: jsonb("regulatory_notes").$type<string[]>(),
});

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  severity: text("severity").notNull(),
  floorKey: text("floor_key"),
  title: text("title").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const broadcasts = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  audience: text("audience").notNull().default("all"),
  recipients: integer("recipients").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FloorRow = typeof floors.$inferSelect;
export type IncidentRow = typeof incidents.$inferSelect;
export type BroadcastRow = typeof broadcasts.$inferSelect;

// --- F11: sensor ingestion ---
//
// Tagged telemetry points (Brick Schema / Project Haystack style). Each row is
// one timestamped reading carrying the semantic tags that describe what it
// measures and where. `tag` is the dotted Brick-style class; `markers` is the
// flat Haystack-style marker list, stored as jsonb for set-based queries.
export const sensorPoints = pgTable("sensor_points", {
  id: serial("id").primaryKey(),
  // Stable external point key, e.g. "sp-power-ops-core-power".
  pointKey: text("point_key").notNull().unique(),
  // Brick-style dotted semantic class, e.g. "sensor.electric.power".
  tag: text("tag").notNull(),
  // Haystack-style flat marker tags, e.g. ["sensor","electric","power"].
  markers: jsonb("markers").$type<string[]>().notNull().default([]),
  floorKey: text("floor_key").notNull(),
  // Optional sub-location / equipment ref within the floor.
  unit: text("unit"),
  // Coarse point kind/quantity, e.g. "power", "temp", "co2".
  kind: text("kind").notNull(),
  value: doublePrecision("value").notNull(),
  // Engineering unit of `value`, e.g. "kW", "°C", "ppm".
  unitOfMeasure: text("unit_of_measure").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

export type SensorPointRow = typeof sensorPoints.$inferSelect;

// --- F7: fleet ---

export const buildings = pgTable("buildings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  locationLabel: text("location_label").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  status: text("status").notNull().default("online"),
  unitCount: integer("unit_count").notNull().default(0),
  dwellings: integer("dwellings"),
  beds: integer("beds"),
  autonomyPct: integer("autonomy_pct").notNull().default(0),
  residents: integer("residents").notNull().default(0),
  openIncidents: integer("open_incidents").notNull().default(0),
  // --- Grid / islanding capability ---
  // grid_tied: whether the building is connected to the utility grid.
  gridTied: boolean("grid_tied"),
  // island_capable: whether the ESS + transfer-switch can island on outage.
  islandCapable: boolean("island_capable"),
});

export type BuildingRow = typeof buildings.$inferSelect;
