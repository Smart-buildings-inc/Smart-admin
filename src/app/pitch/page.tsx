import type { Metadata } from "next";
import PitchGame, { type QualityTier } from "@/components/PitchGame";
import { getFloors, getIncidents } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pitch Quest · ATLAS OS",
  description:
    "A playable 3D pitch page for ATLAS OS. Explore the habitat systems that make the self-sufficient building project operable, investable, and easy to teach.",
  alternates: { canonical: "/pitch" },
};

function parseQuality(value: string | string[] | undefined): QualityTier | undefined {
  const quality = Array.isArray(value) ? value[0] : value;
  return quality === "low" || quality === "balanced" || quality === "high"
    ? quality
    : undefined;
}

type PitchSearchParams = {
  quality?: string | string[];
};

export default async function PitchPage({
  searchParams,
}: {
  searchParams?: Promise<PitchSearchParams>;
}) {
  const params = await searchParams;
  const [floors, incidents] = await Promise.all([getFloors(), getIncidents()]);

  return (
    <PitchGame
      floors={floors}
      incidents={incidents}
      initialQuality={parseQuality(params?.quality)}
    />
  );
}
