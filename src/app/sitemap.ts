import type { MetadataRoute } from "next";
import { SITE_ROUTES, absoluteUrl } from "@/lib/routes";

// Dynamic sitemap.xml. Next.js serves this at /sitemap.xml. URLs are resolved
// from the live request host (see getBaseUrl), so connecting a real domain
// rewrites every entry automatically — no rebuild required.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return SITE_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
