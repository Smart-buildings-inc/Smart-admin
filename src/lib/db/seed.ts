// Seed script: populates a connected database with the canonical ATLAS-01 data.
// Run with `npm run db:seed` after `npm run db:push`. No-op (with a friendly
// message) when DATABASE_URL is unset, since the app runs on seed data anyway.

import { getDb, isDbConfigured, schema } from "./index";
import { seedBroadcasts, seedFloors, seedIncidents } from "./seed-data";

async function main() {
  if (!isDbConfigured) {
    console.log(
      "DATABASE_URL not set — nothing to seed. The app already runs on in-memory seed data.",
    );
    return;
  }
  const db = getDb();
  if (!db) throw new Error("Failed to construct database client.");

  console.log("Clearing existing rows…");
  await db.delete(schema.incidents);
  await db.delete(schema.broadcasts);
  await db.delete(schema.floors);

  console.log(`Inserting ${seedFloors.length} floors…`);
  await db.insert(schema.floors).values(
    seedFloors.map((f) => ({
      key: f.key,
      name: f.name,
      need: f.need,
      category: f.category,
      level: f.level,
      residents: f.residents,
      metrics: f.metrics,
    })),
  );

  console.log(`Inserting ${seedIncidents.length} incidents…`);
  await db.insert(schema.incidents).values(
    seedIncidents.map((i) => ({
      severity: i.severity,
      floorKey: i.floorKey,
      title: i.title,
      detail: i.detail,
      createdAt: new Date(i.createdAt),
    })),
  );

  console.log(`Inserting ${seedBroadcasts.length} broadcasts…`);
  await db.insert(schema.broadcasts).values(
    seedBroadcasts.map((b) => ({
      message: b.message,
      audience: b.audience,
      recipients: b.recipients,
      createdAt: new Date(b.createdAt),
    })),
  );

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
