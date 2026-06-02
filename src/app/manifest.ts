import type { MetadataRoute } from "next";

// PWA / install metadata. Icons live in /public; the ops-console theme color
// matches the root viewport themeColor so installed instances blend in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATLAS OS — Habitat Twin",
    short_name: "ATLAS OS",
    description:
      "Building operations platform for self-sufficient ATLAS habitats: live per-floor telemetry, incident triage, and resident broadcast over a 3D digital twin.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b10",
    theme_color: "#070b10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
