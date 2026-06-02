import type { BuildingKpis } from "@/lib/types";

function Kpi({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "ok" | "warn" | "crit";
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
    <div className="panel panel-pad min-w-0 flex-1 lg:min-w-[8.5rem]">
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
  );
}

// F5 — Building KPI strip.
export default function KpiStrip({ kpis }: { kpis: BuildingKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap">
      <Kpi
        label="Energy autonomy"
        value={kpis.autonomyPct}
        suffix="%"
        tone={kpis.autonomyPct >= 90 ? "ok" : kpis.autonomyPct >= 70 ? "warn" : "crit"}
      />
      <Kpi
        label="Battery"
        value={kpis.batteryPct}
        suffix="%"
        tone={kpis.batteryPct >= 40 ? "ok" : kpis.batteryPct >= 20 ? "warn" : "crit"}
      />
      <Kpi label="Solar" value={kpis.solarKw} suffix="kW" />
      <Kpi label="Non-potable reuse" value={kpis.waterReusePct} suffix="%" tone="ok" />
      <Kpi label="Food (amenity)" value={kpis.foodKgDay} suffix="kg/day" />
      <Kpi label="Residents" value={kpis.residents} />
      <Kpi
        label="Open incidents"
        value={kpis.openIncidents}
        tone={kpis.openIncidents === 0 ? "ok" : kpis.openIncidents <= 2 ? "warn" : "crit"}
      />
    </div>
  );
}
