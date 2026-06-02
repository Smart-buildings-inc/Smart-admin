import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ATLAS OS — Habitat Twin",
  description:
    "Building operations platform for self-sufficient ATLAS habitats. Live per-floor telemetry, incident triage, and resident broadcast over an interactive 3D digital twin.",
};

// Mobile-first viewport: edge-to-edge with safe-area support and a dark theme
// color so the browser chrome blends into the ops console.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b10",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Bottom padding on mobile keeps content clear of the fixed bottom tab
          bar (md:pb-0 once the bar is hidden at the md breakpoint). */}
      <body className="min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
