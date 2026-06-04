import Console from "@/components/Console";
import {
  getBroadcasts,
  getBuildingKpis,
  getFloors,
  getIncidents,
  isDbConfigured,
} from "@/lib/data";
import { getSensorPoints } from "@/lib/sensors";
import { getAnalyticsSummary } from "@/lib/analytics-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Server-side initial load. Falls back to seed data when no DB is configured,
  // so the console always renders (PRD §9.1 resilience guarantee).
  const [floors, incidents, broadcasts, kpis, analytics, sensors] =
    await Promise.all([
      getFloors(),
      getIncidents(),
      getBroadcasts(),
      getBuildingKpis(),
      getAnalyticsSummary(),
      getSensorPoints(),
    ]);

  return (
    <Console
      initialFloors={floors}
      initialIncidents={incidents}
      initialBroadcasts={broadcasts}
      initialKpis={kpis}
      initialAnalytics={analytics}
      initialSensors={sensors}
      dbConnected={isDbConfigured}
    />
  );
}
