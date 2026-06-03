import type { Metadata } from "next";
import CarbonView from "@/components/CarbonView";
import { getBuildingCarbon } from "@/lib/carbon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carbon & ESG · ATLAS OS",
  description:
    "Operational (Scope 2) and embodied (upfront) carbon per floor and building, tied to the green funding programs the performance supports.",
  alternates: { canonical: "/carbon" },
};

// Carbon & ESG page — operational + embodied carbon per floor and building,
// tied to the green funding programs from the ATLAS derisking plan.
export default async function CarbonPage() {
  const carbon = await getBuildingCarbon();
  return <CarbonView carbon={carbon} />;
}
