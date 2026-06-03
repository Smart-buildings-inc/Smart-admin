import type { BuildingKpis } from "@/lib/types";
import type { Icon } from "@phosphor-icons/react";
import {
  BatteryCharging,
  Drop,
  Gauge,
  Leaf,
  ShieldCheck,
  SolarPanel,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

function Kpi({
  label,
  value,
  suffix,
  tone,
  sub,
  Icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "ok" | "warn" | "crit";
  /** Optional sub-line rendered beneath the value in muted text-xs. */
  sub?: string;
  Icon: Icon;
}) {
  const toneClass =
    tone === "crit"
      ? "text-signal-crit"
      : tone === "warn"
        ? "text-signal-warn"
        : tone === "ok"
          ? "text-signal-ok"
          : "text-white";
  return (
    <div className="panel panel-pad min-w-[9.5rem] snap-start flex-1 lg:min-w-[8.5rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="kpi-label">{label}</div>
          <div className={`kpi-value ${toneClass}`}>
            {value}
            {suffix ? (
              <span className="ml-0.5 text-sm font-normal text-slate-400">
                {suffix}
              </span>
            ) : null}
          </div>
        </div>
        <Icon
          aria-hidden
          weight="duotone"
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 opacity-70"
        />
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
      ) : null}
    </div>
  );
}

// F5 — Building KPI strip.
export default function KpiStrip({ kpis }: { kpis: BuildingKpis }) {
  const r = kpis.resilience;
  const resilienceTone: "ok" | "warn" | "crit" =
    r.overall >= 80 ? "ok" : r.overall >= 60 ? "warn" : "crit";
  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scroll-thin sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:flex lg:flex-wrap">
      <Kpi
        label="Resilience"
        value={r.overall}
        suffix="%"
        tone={resilienceTone}
        Icon={ShieldCheck}
        sub={`E ${r.energyPct} · W ${r.waterPct} · F ${r.foodPct}`}
      />
      <Kpi
        label="Energy autonomy"
        value={kpis.autonomyPct}
        suffix="%"
        Icon={Gauge}
        tone={kpis.autonomyPct >= 90 ? "ok" : kpis.autonomyPct >= 70 ? "warn" : "crit"}
      />
      <Kpi
        label="Battery"
        value={kpis.batteryPct}
        suffix="%"
        Icon={BatteryCharging}
        tone={kpis.batteryPct >= 40 ? "ok" : kpis.batteryPct >= 20 ? "warn" : "crit"}
      />
      <Kpi label="Solar" value={kpis.solarKw} suffix="kW" Icon={SolarPanel} />
      <Kpi
        label="Non-potable reuse"
        value={kpis.waterReusePct}
        suffix="%"
        tone="ok"
        Icon={Drop}
      />
      <Kpi
        label="Food (amenity)"
        value={kpis.foodKgDay}
        suffix="kg/day"
        Icon={Leaf}
      />
      <Kpi label="Residents" value={kpis.residents} Icon={UsersThree} />
      <Kpi
        label="Open incidents"
        value={kpis.openIncidents}
        Icon={WarningCircle}
        tone={kpis.openIncidents === 0 ? "ok" : kpis.openIncidents <= 2 ? "warn" : "crit"}
      />
    </div>
  );
}
