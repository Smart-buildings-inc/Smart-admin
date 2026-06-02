// Finance data module — OpCo / PropCo structure, funding programs, and
// approvals sequence for the ATLAS de-risking plan. Local-first static data;
// no DB required. See docs/ATLAS-derisking-plan.md for the full narrative.

export type EntityKind = "opco" | "propco";

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  tagline: string;
  summary: string;
  funding: string[];
  revenue: string[];
}

export type ProgramKind = "debt" | "grant" | "tax-credit" | "incentive";
export type ProgramStatus = "exploring" | "eligible" | "applied" | "secured";

export interface FundingProgram {
  id: string;
  name: string;
  agency: string;
  kind: ProgramKind;
  appliesTo: EntityKind;
  status: ProgramStatus;
  note: string;
}

export type GateStatus = "done" | "in-progress" | "upcoming";

export interface ApprovalGate {
  id: string;
  phase: string;
  title: string;
  authority: string;
  status: GateStatus;
  items: string[];
}

export const entities: Entity[] = [
  {
    id: "opco",
    kind: "opco",
    name: "ATLAS OS Inc.",
    tagline: "The platform (SaaS)",
    summary:
      "The digital-twin / fleet / sensor-ingestion / broadcast platform. Capital-light, scalable, sells to third-party buildings now — independent of any shovel.",
    funding: [
      "Venture / innovation capital",
      "SR&ED tax credits",
      "NRC IRAP",
      "Arm's-length licence fee from PropCo",
    ],
    revenue: [
      "SaaS licences (third-party buildings & portfolios)",
      "Fleet/portfolio subscriptions",
      "Sensor-ingestion tier",
    ],
  },
  {
    id: "propco",
    kind: "propco",
    name: "ATLAS-01 PropCo",
    tagline: "The building (single asset)",
    summary:
      "The right-sized, permittable flagship tower. Hard-asset collateral, yield profile. Anchor reference customer + live showroom for OpCo.",
    funding: ["CMHC MLI Select debt", "Yield equity"],
    revenue: [
      "Residential rent / sale (market multi-unit)",
      "Opex savings (non-potable reuse + islanding)",
    ],
  },
];

export const fundingPrograms: FundingProgram[] = [
  {
    id: "mli-select",
    name: "CMHC MLI Select",
    agency: "CMHC",
    kind: "debt",
    appliesTo: "propco",
    status: "exploring",
    note: "Better LTV/terms via energy-efficiency + accessibility points (affordability optional).",
  },
  {
    id: "greener-affordable",
    name: "Greener Affordable Housing",
    agency: "NRCan / CMHC",
    kind: "grant",
    appliesTo: "propco",
    status: "exploring",
    note: "Capital for deep energy retrofit / high-efficiency new build.",
  },
  {
    id: "save-on-energy",
    name: "Save on Energy",
    agency: "IESO (Ontario)",
    kind: "incentive",
    appliesTo: "propco",
    status: "exploring",
    note: "Demand-response + efficiency incentives for the ESS + controls.",
  },
  {
    id: "sred",
    name: "SR&ED",
    agency: "CRA",
    kind: "tax-credit",
    appliesTo: "opco",
    status: "eligible",
    note: "R&D tax credits for the twin / fleet / ingestion platform.",
  },
  {
    id: "irap",
    name: "NRC IRAP",
    agency: "NRC",
    kind: "grant",
    appliesTo: "opco",
    status: "exploring",
    note: "Innovation funding for productizing the OS for third-party buildings.",
  },
];

export const approvalGates: ApprovalGate[] = [
  {
    id: "phase-0",
    phase: "Months 0–2",
    title: "Pre-consultation",
    authority: "Municipality · Chief Building Official · MECP",
    status: "in-progress",
    items: [
      "Occupancy matrix on the table",
      "Water-reuse approval path in writing",
    ],
  },
  {
    id: "phase-1",
    phase: "Months 2–6",
    title: "Concept approvals (parallel)",
    authority: "Planning · MECP · CMHC · LDC",
    status: "upcoming",
    items: [
      "Zoning / site plan",
      "MECP ECA pre-submission",
      "CMHC MLI Select eligibility",
      "LDC interconnection study",
    ],
  },
  {
    id: "phase-2",
    phase: "Months 6–12",
    title: "Permit set",
    authority: "Building · Fire · MEP",
    status: "upcoming",
    items: [
      "Code matrix",
      "Interconnected-space fire engineering",
      "CSA B128 dual-plumbing",
      "ESS fire design",
      "Barrier-free (AODA)",
    ],
  },
];
