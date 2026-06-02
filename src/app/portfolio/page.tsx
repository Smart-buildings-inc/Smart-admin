import PortfolioView from "@/components/PortfolioView";
import {
  entities,
  fundingPrograms,
  approvalGates,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

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
