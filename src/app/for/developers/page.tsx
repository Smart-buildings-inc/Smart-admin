import type { Metadata } from "next";
import MarketingPage from "@/components/MarketingPage";
import { AUDIENCE_BY_SLUG } from "@/lib/audiences";

const audience = AUDIENCE_BY_SLUG.get("developers")!;

export const metadata: Metadata = {
  title: audience.metaTitle,
  description: audience.metaDescription,
};

export default function Page() {
  return <MarketingPage audience={audience} />;
}
