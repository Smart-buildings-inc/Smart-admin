import { headers } from "next/headers";

// Central route registry + dynamic base-URL resolution.
//
// Both the human-readable site map page (`/sitemap`) and the machine-readable
// `sitemap.xml` / `robots.txt` derive from `SITE_ROUTES` here, so adding a page
// in one place keeps every surface in sync.
//
// `getBaseUrl()` resolves the canonical origin at *request time* rather than
// baking it in at build time. This is the key to "connect a real domain and
// everything fixes itself": the moment requests arrive on the new hostname,
// the sitemap/robots/canonical URLs reflect it automatically — no rebuild, no
// hardcoded localhost. An explicit `NEXT_PUBLIC_SITE_URL` env var always wins
// when you want to pin a canonical origin (e.g. force https + apex domain).

export type SiteRoute = {
  /** App Router path, e.g. "/" or "/fleet". */
  path: string;
  /** Human-friendly title shown on the site map page. */
  title: string;
  /** Short description of what lives at this route. */
  description: string;
  /** sitemap.xml change frequency hint. */
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /** sitemap.xml priority (0.0–1.0). */
  priority: number;
};

// The public, indexable pages of the app. API routes are intentionally omitted.
export const SITE_ROUTES: SiteRoute[] = [
  {
    path: "/",
    title: "Console",
    description:
      "The habitat twin — interactive 3D digital twin with live per-floor telemetry, incident triage, and resident broadcast.",
    changeFrequency: "always",
    priority: 1.0,
  },
  {
    path: "/fleet",
    title: "Fleet",
    description:
      "Multi-building rollup across every ATLAS habitat in the network, with per-building KPIs and status.",
    changeFrequency: "hourly",
    priority: 0.8,
  },
  {
    path: "/landing",
    title: "Overview",
    description:
      "Product overview — a guided tour of the ATLAS OS platform: the 3D twin, telemetry, incident triage, broadcast, sensors, and fleet rollup.",
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    path: "/brand",
    title: "Brand",
    description:
      "The ATLAS OS brand identity — logo, color, typography, and voice. Tokens copyable inline and downloadable as a brand kit.",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/sitemap",
    title: "Site Map",
    description: "This page — an index of every section of ATLAS OS.",
    changeFrequency: "monthly",
    priority: 0.3,
  },
];

// Strip a trailing slash so we never emit "https://host//path".
function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve the canonical origin (scheme + host, no trailing slash).
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL  — explicit canonical origin (recommended in prod).
 *   2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — auto-set by Vercel.
 *   3. Incoming request headers (x-forwarded-host / host + proto) — so a freshly
 *      connected custom domain is honored immediately, with zero config.
 *   4. http://localhost:3000 — local dev fallback.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return trimTrailingSlash(explicit);

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return trimTrailingSlash(`https://${vercel}`);

  // Fall back to the live request host. Wrapped in try/catch because headers()
  // is only available within a request scope (it throws during static prerender).
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return trimTrailingSlash(`${proto}://${host}`);
    }
  } catch {
    // Outside a request scope — fall through to the dev default.
  }

  return "http://localhost:3000";
}

/** Build a fully-qualified absolute URL for a given route path. */
export function absoluteUrl(path: string): string {
  const base = getBaseUrl();
  return path === "/" ? `${base}/` : `${base}${path}`;
}
