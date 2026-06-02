import type { MetadataRoute } from "next";
import { absoluteUrl, getBaseUrl } from "@/lib/routes";

// Dynamic robots.txt, served by Next.js at /robots.txt. The Sitemap directive
// points at the same dynamically-resolved host as sitemap.xml, so it stays
// correct the instant a real domain is connected.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API endpoints are data, not pages — keep them out of the index.
      disallow: "/api/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getBaseUrl(),
  };
}
