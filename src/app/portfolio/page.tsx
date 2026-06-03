import type { Metadata } from "next";
import PortfolioView from "@/components/PortfolioView";
import {
  entities,
  fundingPrograms,
  approvalGates,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio · ATLAS OS",
  description:
    "The win-win plan — OpCo/PropCo capital structure, Canadian funding programs, and the three-phase permitting approvals timeline.",
  alternates: { canonical: "/portfolio" },
};

// Portfolio page — OpCo/PropCo structure, funding programs, and approvals
// timeline. Static local-first finance data; no DB required.
export default function PortfolioPage() {
  return (
    <PortfolioView
      entities={entities}
      fundingPrograms={fundingPrograms}
      approvalGates={approvalGates}
    />
  );
}
