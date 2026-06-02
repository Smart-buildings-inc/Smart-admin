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
    // Install-prompt promo image (the AOS brand card). A wide brochure can't
    // serve as a square app icon, so it lives here as a screenshot instead.
    // form_factor/label are valid manifest fields the route serializes, but
    // aren't in Next's narrow screenshot type — cast so they're still emitted.
    screenshots: [
      {
        src: "/social.png",
        type: "image/png",
        form_factor: "wide",
        label: "AOS — Building the future. Creating lasting spaces.",
      },
    ] as unknown as MetadataRoute.Manifest["screenshots"],
  };
}
