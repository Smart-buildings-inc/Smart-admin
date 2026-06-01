import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATLAS OS — Habitat Twin",
  description:
    "Building operations platform for self-sufficient ATLAS habitats. Live per-floor telemetry, incident triage, and resident broadcast over an interactive 3D digital twin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
