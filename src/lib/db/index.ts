// Database client for ATLAS OS.
//
// Local-first: if DATABASE_URL is unset we never construct a client and the
// data layer (src/lib/data.ts) transparently falls back to seed data. This is
// the "renders on seed data even with no DB connected" guarantee from the PRD.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export const databaseUrl = process.env.DATABASE_URL?.trim();
export const isDbConfigured = Boolean(databaseUrl);

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleClient | null = null;

/** Returns the Drizzle client, or null when no database is configured. */
export function getDb(): DrizzleClient | null {
  if (!isDbConfigured) return null;
  if (!cached) {
    const sql = neon(databaseUrl as string);
    cached = drizzle(sql, { schema });
  }
  return cached;
}

export { schema };
