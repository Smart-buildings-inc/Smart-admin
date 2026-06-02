import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import MobileTabBar from "@/components/MobileTabBar";

const DESCRIPTION =
  "Building operations platform for self-sufficient ATLAS habitats. Live per-floor telemetry, incident triage, and resident broadcast over an interactive 3D digital twin.";

export const metadata: Metadata = {
  // metadataBase lets Next resolve the OG/icon URLs to absolute ones; override
  // via NEXT_PUBLIC_SITE_URL in deployment.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "ATLAS OS — Habitat Twin",
  description: DESCRIPTION,
  applicationName: "ATLAS OS",
  // favicon.ico, icon.svg and apple-icon.png in src/app are auto-linked by the
  // App Router file conventions; this just adds the high-res PNG fallbacks.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    title: "ATLAS OS — Habitat Twin",
    description: DESCRIPTION,
    siteName: "ATLAS OS",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ATLAS OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ATLAS OS — Habitat Twin",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
      {/* Bottom padding on mobile clears the fixed MobileTabBar (incl. safe area). */}
      <body className="min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        <NavBar />
        {children}
        <MobileTabBar />
      </body>
    </html>
  );
}
