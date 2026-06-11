import type { Metadata } from "next";
import SimulatorView from "@/components/SimulatorView";
import { getFloors, getIncidents, isDbConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Building Simulator · ATLAS OS",
  description:
    "A live, operating architectural twin of ATLAS-01 — the full floor stack with a curtain-wall frame, working dual elevators, switchback stairs, rooftop solar and a basement reservoir.",
  alternates: { canonical: "/simulator" },
};

// F12 — Building Simulator. A live architectural twin of ATLAS-01: the full
// floor stack with working elevator, staircase, rooftop systems and residents.
export default async function SimulatorPage() {
  // Server-side initial load; falls back to seed data when no DB is configured
  // (PRD §9.1 resilience guarantee), mirroring the console + fleet views.
  const [floors, incidents] = await Promise.all([getFloors(), getIncidents()]);

  return (
    <SimulatorView floors={floors} incidents={incidents} dbConnected={isDbConfigured} />
  );
}
