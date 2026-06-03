import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { getLegalPaper } from "@/lib/documents";

export const dynamic = "force-dynamic";

const paper = getLegalPaper("terms");

export const metadata: Metadata = {
  title: `${paper?.title ?? "Terms of Service"} — ATLAS OS`,
  description: paper?.description,
};

export default function TermsPage() {
  return <LegalDoc route="terms" />;
}
