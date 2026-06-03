import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { getLegalPaper } from "@/lib/documents";

export const dynamic = "force-dynamic";

const paper = getLegalPaper("dpa");

export const metadata: Metadata = {
  title: `${paper?.title ?? "Data Processing Addendum"} — ATLAS OS`,
  description: paper?.description,
};

export default function DpaPage() {
  return <LegalDoc route="dpa" />;
}
