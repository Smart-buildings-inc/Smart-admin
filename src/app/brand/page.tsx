import type { Metadata } from "next";
import BrandView from "@/components/BrandView";
import { BRAND } from "@/lib/brand";

// Brand page (server shell): living style guide for ATLAS OS — logo, color,
// typography, and voice — every token copyable inline and exported as a
// downloadable .zip kit via /api/brand/zip. The interactive body is the client
// `BrandView`; this shell just supplies metadata + the page chrome.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brand — ATLAS OS",
  description: `${BRAND.tagline} The ATLAS OS brand identity — logo, color, typography, and voice, copyable inline and downloadable as a kit.`,
};

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 lg:px-6 lg:py-12">
      <BrandView />
    </main>
  );
}
