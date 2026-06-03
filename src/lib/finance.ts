// Finance data module — OpCo / PropCo structure, funding programs, and
// approvals sequence for the ATLAS de-risking plan. Local-first static data;
// no DB required. See docs/ATLAS-derisking-plan.md for the full narrative.
//
// ILLUSTRATIVE PRO FORMA — these numbers are planning-aid assumptions only,
// not an offering, commitment, or financial advice. Confirm all figures with
// qualified Canadian real-estate, finance, and engineering professionals.

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

// ── Pro Forma ─────────────────────────────────────────────────────────────

export interface ProForma {
  // PropCo (the building) — illustrative, documented assumptions
  dwellings: number;          // ASSUMPTION: 64 conventional market units (Residences A–D + 12 Penthouses)
  capexPerDoor: number;       // ASSUMPTION: $420 000 / door — mid-tier Toronto concrete mid-rise all-in
  totalCapex: number;         // dwellings × capexPerDoor
  mliSelectLtvPct: number;    // ASSUMPTION: 95% — CMHC MLI Select max LTV (energy + accessibility points)
  loanAmount: number;         // totalCapex × mliSelectLtvPct / 100
  equity: number;             // totalCapex − loanAmount
  annualNoi: number;          // ASSUMPTION: ~$2 200/mo/unit net rent × 64 units × 12 mo (Toronto market)
  opexSavingsAnnual: number;  // ASSUMPTION: $120 000/yr from non-potable reuse + islanding demand-response

  // OpCo (the platform)
  licenceFeeAnnual: number;   // ASSUMPTION: $60 000/yr arm's-length SaaS licence PropCo → OpCo
  arrYear1: number;           // ASSUMPTION: $180 000 ARR yr-1 (PropCo anchor + ~2 early adopters @ $60k)
  arrYear5: number;           // ASSUMPTION: $2 400 000 ARR yr-5 (40 buildings @ avg $60k/yr)

  // Blended return
  tenYearReturnX: number;     // ASSUMPTION: ~2.8× blended OpCo + PropCo MOIC, illustrative (not projected)

  // Chart series
  arrRamp: { year: number; arr: number }[];        // 5 pts — OpCo ARR ramp
  capexStack: { label: string; amount: number }[]; // $/door decomposition baked into totalCapex
}

export const proForma: ProForma = (() => {
  const dwellings = 64;
  const capexPerDoor = 420_000;
  const totalCapex = dwellings * capexPerDoor;          // $26 880 000
  const mliSelectLtvPct = 95;
  const loanAmount = Math.round(totalCapex * mliSelectLtvPct / 100); // $25 536 000
  const equity = totalCapex - loanAmount;               // $1 344 000

  // NOI: $2 200/mo/unit net effective rent × 64 × 12
  const annualNoi = 2_200 * dwellings * 12;             // $1 689 600

  // Opex savings: ~$80k non-potable water reuse (toilet/irrigation) + ~$40k
  // islanding demand-response credit from IESO Save on Energy program
  const opexSavingsAnnual = 120_000;

  // OpCo SaaS
  const licenceFeeAnnual = 60_000;
  const arrYear1 = 180_000;   // PropCo anchor + 2 early adopters
  const arrYear5 = 2_400_000; // 40 buildings @ avg $60k

  // Blended 10-yr: PropCo equity appreciation + OpCo SaaS exit, illustrative
  const tenYearReturnX = 2.8;

  const arrRamp: { year: number; arr: number }[] = [
    { year: 1, arr: arrYear1 },
    { year: 2, arr: 480_000 },
    { year: 3, arr: 960_000 },
    { year: 4, arr: 1_680_000 },
    { year: 5, arr: arrYear5 },
  ];

  // capexStack: $/door × dwellings — adds up to totalCapex
  // Shell & structure 38%, MEP 28%, ESS + water-reuse 10%, fit-out 24%
  const capexStack: { label: string; amount: number }[] = [
    { label: "Shell & structure", amount: Math.round(totalCapex * 0.38) },
    { label: "MEP", amount: Math.round(totalCapex * 0.28) },
    { label: "ESS + water reuse", amount: Math.round(totalCapex * 0.10) },
    { label: "Fit-out", amount: Math.round(totalCapex * 0.24) },
  ];

  return {
    dwellings,
    capexPerDoor,
    totalCapex,
    mliSelectLtvPct,
    loanAmount,
    equity,
    annualNoi,
    opexSavingsAnnual,
    licenceFeeAnnual,
    arrYear1,
    arrYear5,
    tenYearReturnX,
    arrRamp,
    capexStack,
  };
})();

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
