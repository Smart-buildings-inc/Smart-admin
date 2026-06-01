import Console from "@/components/Console";
import {
  getBroadcasts,
  getBuildingKpis,
  getFloors,
  getIncidents,
  isDbConfigured,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Server-side initial load. Falls back to seed data when no DB is configured,
  // so the console always renders (PRD §9.1 resilience guarantee).
  const [floors, incidents, broadcasts, kpis] = await Promise.all([
    getFloors(),
    getIncidents(),
    getBroadcasts(),
    getBuildingKpis(),
  ]);

  return (
    <Console
      initialFloors={floors}
      initialIncidents={incidents}
      initialBroadcasts={broadcasts}
      initialKpis={kpis}
      dbConnected={isDbConfigured}
    />
  );
}
