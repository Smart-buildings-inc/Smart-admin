import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { getLegalPaper } from "@/lib/documents";

export const dynamic = "force-dynamic";

const paper = getLegalPaper("privacy");

export const metadata: Metadata = {
  title: `${paper?.title ?? "Privacy Policy"} — ATLAS OS`,
  description: paper?.description,
};

export default function PrivacyPage() {
  return <LegalDoc route="privacy" />;
}
