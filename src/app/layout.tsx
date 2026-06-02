import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";

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
      {/* Reserve room for the fixed mobile tab bar (its height + safe area) so
          page content never hides behind it. Cleared at md+ where the bottom
          bar is gone. */}
      <body className="min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <NavBar />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
