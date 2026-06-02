"use client";

import type {
  Entity,
  EntityKind,
  FundingProgram,
  ProgramKind,
  ProgramStatus,
  ApprovalGate,
  GateStatus,
} from "@/lib/finance";

// ── Label / color helpers ──────────────────────────────────────────────────

const PROGRAM_KIND_LABEL: Record<ProgramKind, string> = {
  debt: "Debt",
  grant: "Grant",
  "tax-credit": "Tax credit",
  incentive: "Incentive",
};

const PROGRAM_KIND_STYLE: Record<ProgramKind, string> = {
  debt: "bg-signal-info/15 text-signal-info",
  grant: "bg-signal-ok/15 text-signal-ok",
  "tax-credit": "bg-need-energy/15 text-need-energy",
  incentive: "bg-need-water/15 text-need-water",
};

const STATUS_LABEL: Record<ProgramStatus, string> = {
  exploring: "Exploring",
  eligible: "Eligible",
  applied: "Applied",
  secured: "Secured",
};

// exploring → neutral, eligible → info, applied → warn, secured → ok
const STATUS_STYLE: Record<ProgramStatus, string> = {
  exploring: "bg-ink-700/80 text-slate-400",
  eligible: "bg-signal-info/15 text-signal-info",
  applied: "bg-signal-warn/15 text-signal-warn",
  secured: "bg-signal-ok/15 text-signal-ok",
};

const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  upcoming: "Upcoming",
};

// done=ok, in-progress=warn, upcoming=neutral
const GATE_STATUS_DOT: Record<GateStatus, string> = {
  done: "bg-signal-ok",
  "in-progress": "bg-signal-warn pulse",
  upcoming: "bg-slate-500",
};

const GATE_STATUS_TEXT: Record<GateStatus, string> = {
  done: "text-signal-ok",
  "in-progress": "text-signal-warn",
  upcoming: "text-slate-400",
};

const ENTITY_KIND_ACCENT: Record<EntityKind, string> = {
  opco: "border-signal-info/40 bg-signal-info/5",
  propco: "border-need-energy/40 bg-need-energy/5",
};

const ENTITY_KIND_TAG: Record<EntityKind, string> = {
  opco: "bg-signal-info/15 text-signal-info",
  propco: "bg-need-energy/15 text-need-energy",
};

const ENTITY_KIND_TAG_LABEL: Record<EntityKind, string> = {
  opco: "OpCo",
  propco: "PropCo",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Badge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {label}
    </span>
  );
}

function EntityCard({ entity }: { entity: Entity }) {
  return (
    <div
      className={`panel panel-pad flex flex-col gap-4 border ${ENTITY_KIND_ACCENT[entity.kind]}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={ENTITY_KIND_TAG_LABEL[entity.kind]}
              className={ENTITY_KIND_TAG[entity.kind]}
            />
          </div>
          <h3 className="display mt-1.5 text-lg text-white">{entity.name}</h3>
          <p className="mt-0.5 text-sm font-semibold text-slate-300">
            {entity.tagline}
          </p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed text-slate-400">{entity.summary}</p>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="kpi-label mb-2">Funding</div>
          <ul className="flex flex-col gap-1.5">
            {entity.funding.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-slate-300"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="kpi-label mb-2">Revenue</div>
          <ul className="flex flex-col gap-1.5">
            {entity.revenue.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs text-slate-300"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ProgramRow({ program }: { program: FundingProgram }) {
  return (
    <div className="panel panel-pad flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      {/* Left: name + agency */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            label={ENTITY_KIND_TAG_LABEL[program.appliesTo]}
            className={ENTITY_KIND_TAG[program.appliesTo]}
          />
          <Badge
            label={PROGRAM_KIND_LABEL[program.kind]}
            className={PROGRAM_KIND_STYLE[program.kind]}
          />
        </div>
        <p className="mt-1.5 text-sm font-semibold text-white">
          {program.name}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{program.agency}</p>
      </div>

      {/* Right: status + note */}
      <div className="flex flex-col gap-2 sm:items-end sm:text-right">
        <Badge
          label={STATUS_LABEL[program.status]}
          className={STATUS_STYLE[program.status]}
        />
        <p className="max-w-xs text-xs leading-relaxed text-slate-400">
          {program.note}
        </p>
      </div>
    </div>
  );
}

function GateCard({ gate, index }: { gate: ApprovalGate; index: number }) {
  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-600/60 bg-ink-900 text-xs font-bold text-slate-300`}
        >
          {index + 1}
        </div>
        <div className="mt-1 w-px flex-1 bg-ink-600/40" />
      </div>

      {/* Content */}
      <div className="panel panel-pad mb-4 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="annotation text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 px-2 py-0.5 rounded-full inline-flex">
              {gate.phase}
            </p>
            <h3 className="display mt-1 text-base text-white">{gate.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{gate.authority}</p>
          </div>
          {/* Status indicator */}
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold ${GATE_STATUS_TEXT[gate.status]}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${GATE_STATUS_DOT[gate.status]}`}
            />
            {GATE_STATUS_LABEL[gate.status]}
          </div>
        </div>

        {/* Items */}
        <ul className="mt-3 flex flex-col gap-1.5">
          {gate.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-xs text-slate-300"
            >
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function PortfolioView({
  entities,
  fundingPrograms,
  approvalGates,
}: {
  entities: Entity[];
  fundingPrograms: FundingProgram[];
  approvalGates: ApprovalGate[];
}) {
  // Group programs by entity kind for display
  const opcoPrograms = fundingPrograms.filter((p) => p.appliesTo === "opco");
  const propcoPrograms = fundingPrograms.filter(
    (p) => p.appliesTo === "propco",
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
      {/* ── 1. Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl text-white lg:text-3xl">
            Portfolio&nbsp;·&nbsp;The Win-Win Plan
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            One brand, two entities —{" "}
            <span className="important">OpCo owns the platform, PropCo owns the building</span>
            {" "}— connected by an arm&apos;s-length licence fee that makes PropCo an
            honest anchor SaaS customer from day one.
          </p>
        </div>
      </header>

      {/* ── 2. Structure — entity cards ── */}
      <section aria-labelledby="structure-heading" className="flex flex-col gap-4">
        <div>
          <h2
            id="structure-heading"
            className="display text-xl text-white"
          >
            Structure
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Two entities so neither&apos;s risk profile contaminates the other&apos;s cap
            table. Software ships independently — OpCo revenue clock starts at
            month 0.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      </section>

      {/* ── 3. Funding & programs ── */}
      <section aria-labelledby="funding-heading" className="flex flex-col gap-4">
        <div>
          <h2
            id="funding-heading"
            className="display text-xl text-white"
          >
            Funding &amp; Programs
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Canadian government programs, credits, and incentives mapped to each
            entity.
          </p>
        </div>

        {/* PropCo programs */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge
              label="PropCo"
              className={ENTITY_KIND_TAG["propco"]}
            />
            <span className="text-xs text-slate-500">
              Hard-asset financing for ATLAS-01
            </span>
          </div>
          {propcoPrograms.map((program) => (
            <ProgramRow key={program.id} program={program} />
          ))}
        </div>

        {/* OpCo programs */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2">
            <Badge
              label="OpCo"
              className={ENTITY_KIND_TAG["opco"]}
            />
            <span className="text-xs text-slate-500">
              Innovation capital for the platform
            </span>
          </div>
          {opcoPrograms.map((program) => (
            <ProgramRow key={program.id} program={program} />
          ))}
        </div>
      </section>

      {/* ── 4. Approvals timeline ── */}
      <section
        aria-labelledby="approvals-heading"
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id="approvals-heading"
            className="display text-xl text-white"
          >
            Approvals Timeline
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The permitting long-pole is water. Front-load pre-consultation to
            get paths in writing before design-development spend.
          </p>
        </div>

        <div className="max-w-2xl">
          {approvalGates.map((gate, i) => (
            <GateCard key={gate.id} gate={gate} index={i} />
          ))}
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-slate-600">
        Planning aid only — not legal or engineering advice. Code citations
        (OBC/NBC, SDWA, CSA B128, MECP ECA, CMHC/NRCan) must be confirmed with
        qualified Ontario professionals for the specific site.
      </footer>
    </main>
  );
}
