import type { Metadata } from "next";

import DownloadClient from "@/components/DownloadClient";

export const metadata: Metadata = {
  title: "Get the app — ATLAS OS",
  description:
    "Install ATLAS OS as an app on your device. Detects your phone, tablet, or computer and walks you through a one-tap install — no app store required.",
};

export default function DownloadPage() {
  return <DownloadClient />;
}
