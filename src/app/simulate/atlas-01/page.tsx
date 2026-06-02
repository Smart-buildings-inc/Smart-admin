import type { Metadata } from "next";
import FullscreenSimulator from "@/components/FullscreenSimulator";
import { getFloors, getIncidents } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ATLAS‑01 · Fullscreen Twin — ATLAS OS",
  description:
    "The ATLAS‑01 voxel digital twin, rendered full‑screen on every device. Orbit to inspect, tap a floor for live telemetry.",
};

// Dedicated full-screen 3D viewer. The console twin and simulator stage both
// link here via their "fullscreen viewer" control so the twin can be shown
// edge-to-edge on phones, tablets and desktops alike. Server-side initial load
// falls back to seed data when no DB is configured (mirrors the other views).
export default async function FullscreenSimulatePage() {
  const [floors, incidents] = await Promise.all([getFloors(), getIncidents()]);

  return <FullscreenSimulator floors={floors} incidents={incidents} />;
}
