import CarbonView from "@/components/CarbonView";
import { getBuildingCarbon } from "@/lib/carbon";

export const dynamic = "force-dynamic";

// Carbon & ESG page — operational + embodied carbon per floor and building,
// tied to the green funding programs from the ATLAS derisking plan.
export default async function CarbonPage() {
  const carbon = await getBuildingCarbon();
  return <CarbonView carbon={carbon} />;
}
