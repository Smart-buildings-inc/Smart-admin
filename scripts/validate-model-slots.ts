/**
 * validate-model-slots.ts
 * CI-safe validation: checks that every seed-data floor key has a matching
 * slot in the models.ts MODELS registry. Runs in CI without Blender deps.
 */
import { seedFloors } from "@/lib/db/seed-data";
import { MODELS } from "@/lib/models";

let failed = false;
for (const floor of seedFloors) {
  const slot = `floor-${floor.key}`;
  if (!(slot in MODELS)) {
    console.error(`MISSING: no models.ts slot for floor "${floor.key}" (expected "${slot}")`);
    failed = true;
  } else {
    console.log(`  OK  ${slot} → ${MODELS[slot as keyof typeof MODELS].path}`);
  }
}
if (failed) {
  console.error("\nFAILED — add missing slots to src/lib/models.ts");
  process.exit(1);
} else {
  console.log(`\nPASS — all ${seedFloors.length} seed floors have model slots`);
}
