import FleetView from "@/components/FleetView";
import { getBuildings, isDbConfigured } from "@/lib/fleet";

export const dynamic = "force-dynamic";

// F7 — Fleet view. Zoomed-out map of every ATLAS building across the network.
export default async function FleetPage() {
  // Server-side initial load. Falls back to seed data when no DB is configured
  // (PRD §9.1 resilience guarantee), mirroring the main console.
  const buildings = await getBuildings();

  return <FleetView buildings={buildings} dbConnected={isDbConfigured} />;
}
