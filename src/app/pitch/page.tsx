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
    <>
      <PitchGame
        floors={floors}
        incidents={incidents}
        initialQuality={parseQuality(params?.quality)}
      />
      {/* Cross-disciplinary council deliverable: guided walk-through animation */}
      <div className="fixed bottom-4 right-4 z-50">
        <a
          href="/atlas-walkthrough.html"
          target="_blank"
          className="panel px-4 py-2 text-sm signal-ok hover:signal-ok/80 transition-colors inline-flex items-center gap-2"
          aria-label="Open guided walk-through animation"
        >
          <span className="text-lg">▶</span>
          Walk-through
        </a>
      </div>
    </>
  );
}
