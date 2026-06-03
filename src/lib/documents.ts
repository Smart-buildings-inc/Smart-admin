// Central catalog of ATLAS OS "papers" — the business, technical, and legal
// documents surfaced publicly at /documents (in-page PDF viewer) and, for the
// core legal trio, as first-class HTML routes under /legal.
//
// This module is intentionally pure data (no `fs`, no Node-only imports) so it
// can be imported from server components, client components, the sitemap
// registry, AND the PDF-generation script alike. The source markdown lives in
// the repo-root `docs/` folder; the generation script (scripts/generate-doc-pdfs.ts)
// reads each `file`, renders a PDF to `public/documents/<slug>.pdf`, and emits
// pre-rendered HTML for the legal routes into `documents.generated.ts`.

export type DocGroup = "business" | "technical" | "legal";

/** The three core legal documents that also get dedicated HTML routes. */
export type LegalSlug = "privacy" | "terms" | "dpa";

export interface PaperDoc {
  /** URL-safe id; also the generated PDF filename (`/documents/<slug>.pdf`). */
  slug: string;
  /** Source filename under the repo-root `docs/` folder. */
  file: string;
  /** Human title shown in the viewer list and page headings. */
  title: string;
  /** One-line description for the catalog card. */
  description: string;
  /** Grouping for the documents hub. */
  group: DocGroup;
  /** If set, this paper also renders as an HTML page at `/legal/<legalRoute>`. */
  legalRoute?: LegalSlug;
  /**
   * Investor/internal-sensitive flag. The owner opted to publish everything, so
   * these are still listed — the badge just makes the sensitivity explicit and
   * makes it trivial to gate them later (filter `!internal`).
   */
  internal?: boolean;
}

export const GROUP_LABELS: Record<DocGroup, string> = {
  business: "Business & Fundraising",
  technical: "Technical & Requirements",
  legal: "Legal & Compliance",
};

export const GROUP_ORDER: DocGroup[] = ["legal", "business", "technical"];

// The catalog. Repo-meta/developer docs (README.md, SETUP.md, CLOUD_AUTOMATIONS.md)
// are intentionally excluded — they're contributor onboarding, not "papers".
export const PAPERS: PaperDoc[] = [
  // ── Legal & Compliance ────────────────────────────────────────────────
  {
    slug: "privacy-policy",
    file: "PRIVACY_POLICY.md",
    title: "Privacy Policy",
    description:
      "How ATLAS OS handles personal information — PIPEDA, provincial privacy law, and PHIPA where health data is involved.",
    group: "legal",
    legalRoute: "privacy",
  },
  {
    slug: "terms-of-service",
    file: "TERMS_OF_SERVICE.md",
    title: "Terms of Service",
    description:
      "The terms governing access to and use of the ATLAS OS platform and connected habitat services.",
    group: "legal",
    legalRoute: "terms",
  },
  {
    slug: "data-processing-addendum",
    file: "DATA_PROCESSING_ADDENDUM.md",
    title: "Data Processing Addendum",
    description:
      "Controller/processor terms for personal data processed on behalf of operators and residents.",
    group: "legal",
    legalRoute: "dpa",
  },
  {
    slug: "legal-compliance",
    file: "LEGAL_COMPLIANCE.md",
    title: "Legal & Regulatory Compliance",
    description:
      "The regulatory landscape ATLAS habitats operate within — building codes, utilities, privacy, and health regulation.",
    group: "legal",
  },
  // ── Business & Fundraising ────────────────────────────────────────────
  {
    slug: "business-plan",
    file: "BUSINESS_PLAN.md",
    title: "Business Plan",
    description:
      "The ATLAS habitat thesis, market, model, and roadmap — how a self-sufficient building becomes a fleet.",
    group: "business",
  },
  {
    slug: "pitch-deck",
    file: "PITCH_DECK.md",
    title: "Pitch Deck",
    description:
      "The investor narrative for ATLAS OS — problem, product, traction, and the ask, in deck form.",
    group: "business",
  },
  {
    slug: "budget-and-fundraising",
    file: "BUDGET_AND_FUNDRAISING.md",
    title: "Budget & Fundraising",
    description:
      "Capital plan, use of funds, and the fundraising strategy behind the build-out.",
    group: "business",
    internal: true,
  },
  // ── Technical & Requirements ──────────────────────────────────────────
  {
    slug: "requirements",
    file: "REQUIREMENTS.md",
    title: "Product Requirements",
    description:
      "Functional and non-functional requirements for the ATLAS OS platform and habitat twin.",
    group: "technical",
  },
  {
    slug: "owners-project-requirements",
    file: "OWNERS_PROJECT_REQUIREMENTS.md",
    title: "Owner's Project Requirements",
    description:
      "The owner's project requirements (OPR) — performance targets and intent the building must meet.",
    group: "technical",
    internal: true,
  },
  {
    slug: "security-and-data-compliance",
    file: "SECURITY_AND_DATA_COMPLIANCE.md",
    title: "Security & Data Compliance",
    description:
      "Security architecture and data-protection posture — how habitat and resident data is kept safe.",
    group: "technical",
  },
];

/** PDF URL for a paper slug (served statically from `public/documents/`). */
export function pdfPath(slug: string): string {
  return `/documents/${slug}.pdf`;
}

export function getPaper(slug: string): PaperDoc | undefined {
  return PAPERS.find((p) => p.slug === slug);
}

/** The paper backing a given legal HTML route. */
export function getLegalPaper(route: LegalSlug): PaperDoc | undefined {
  return PAPERS.find((p) => p.legalRoute === route);
}

/** All papers that have a dedicated HTML legal route, in catalog order. */
export const LEGAL_PAPERS: PaperDoc[] = PAPERS.filter((p) => p.legalRoute);

/** Papers grouped + ordered for the documents hub. */
export function papersByGroup(): { group: DocGroup; label: string; papers: PaperDoc[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    papers: PAPERS.filter((p) => p.group === group),
  })).filter((section) => section.papers.length > 0);
}
