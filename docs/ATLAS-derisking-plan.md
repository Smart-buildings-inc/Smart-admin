# ATLAS — De-Risking & Win-Win Plan (v2)

> Outcome of the cross-disciplinary project review (developer / architect / investor /
> Canadian government qualifier). This is the **honest, permittable, fundable** version of
> ATLAS — and the rationale behind the "codebase honesty" changes shipped alongside it.
> Context: ATLAS-01 is the Toronto flagship — a ~13-floor stack (`-1`…`11`) with a
> Reclamation Core, Power/Ops core, Aquaponics + Vertical Farm, four Residences floors,
> "The Lung" air floor, 12 Penthouses, and a rooftop Skydeck pool + reservoir.

---

## TL;DR — the decisions

1. **Structure: OpCo / PropCo split, one brand.** Pursue the software *and* the building
   with equal priority, but as **two entities** so neither's risk profile contaminates the
   other's cap table.
   - **ATLAS OS Inc. (OpCo / SaaS):** owns the platform IP (twin, fleet, sensor ingestion,
     broadcast). Sells to third-party buildings *now*. Capital-light, scalable. Funded by
     venture/innovation capital + SR&ED + IRAP. Ships independently of any shovel.
   - **ATLAS-01 PropCo:** single-asset real-estate entity. Funded by CMHC MLI Select debt +
     yield equity. PropCo is OpCo's anchor reference customer (arm's-length licence → honest
     early SaaS revenue, live showroom).
2. **Building: right-sized to permit.** Non-potable reuse only, closed-loop amenity food,
   grid-tied + islanding. Defensible, fundable, buildable under current Canadian rules.
3. **Residents: market multi-unit.** Conventional dwellings — cleanest code path and
   standard financing. (MLI Select energy/accessibility points still apply without an
   affordability covenant; add an affordable tranche later only if deeper LTV is wanted.)

---

## Flaws found → fixes

| # | Flaw | Fix |
|---|------|-----|
| 1 | **Unit/dwelling/resident conflation** (`unitCount: 12` vs `residents: 128` ⇒ ~10.7/unit reads as congregate housing) | Separate **floors (`unitCount`) / `dwellings` / `beds` / `residents` (occupancy)** in the data model and pro forma. *(Shipped.)* |
| 2 | **Water autonomy overstated.** On-site **blackwater → potable** reuse is not permittable in Canada (SDWA, MECP ECA, CSA B128). | Re-scope KPI to **% of non-potable demand** served by reuse (greywater/rainwater → toilets/irrigation), dual-plumbing + cross-connection control. Relocate the **bulk reservoir to the basement**; keep only the **pool** on the roof. *(KPI relabel shipped.)* |
| 3 | **Food floors mis-scoped as production** (127 kg/day) ⇒ CFIA / provincial food-premises + HACCP + F-occupancy. | Reclassify as **resident amenity / closed-loop** (no external sale); shrink hazard class; dedicated wet-location electrical + ventilation; airtight separation under Residences. Value as **lease-up + ESG, $0 food revenue**. *(KPI relabel "Food (amenity)" shipped.)* |
| 4 | **"Autonomy %" reads as blanket self-sufficiency.** | Present as a **transparent blended resilience index with sub-scores**; the headline number is **energy autonomy** specifically. *(Relabel "Energy autonomy" shipped.)* |
| 5 | **Single elevator + open cut-away atrium** ⇒ fire/egress + accessibility failure. | Dual elevators + firefighter elevator, pressurized exits, fully barrier-free (OBC/AODA); rated interconnected-floor-space engineering for any open atrium. |
| 6 | **Occupancy classification.** Multiple major occupancies (C residential + F industrial farm/works + D/E commons). | Design fire separations, sprinkler/standpipe and independent exiting for a **multiple-major-occupancy** building from day one. Keep the clinic **telehealth/first-aid** to avoid Group B. |
| 7 | **Rooftop reservoir + pool** = ~150 t+ live/dead + seismic/sloshing driving the whole core. | Reservoir → basement (structurally trivial), pool stays as the only rooftop water mass. Lower **$/door** premium. |
| 8 | **ESS (battery wall) under residences** | Design to current energy-storage fire code (separation, ventilation, detection). |

## Benefits to protect

- Memorable, broadly-true **"one floor per human need"** brand — anchors leasing + grants.
- The **digital twin is genuinely sellable software** (F1–F12: per-floor telemetry, incident
  triage, resident broadcast, Brick/Haystack sensor ingestion, fleet rollup).
- **Resilience is a fundable thesis now** — maps to CMHC MLI Select, NRCan / Greener
  Affordable Housing, Save-on-Energy, SR&ED/IRAP.
- **Local-first architecture** (runs on seed data; DB optional) mirrors the building thesis:
  *the cloud is an optimization, never a dependency* — a real differentiator for
  critical-infrastructure software.

---

## Right-sized occupancy matrix (ATLAS-01)

| Floor | As-pitched | Right-sized (permittable) | Occupancy |
|-------|-----------|---------------------------|-----------|
| Reclamation Core (-1) | Blackwater→potable, 92% | Greywater/rainwater → non-potable (CSA B128, MECP ECA); **bulk reservoir relocated here** | F / mech |
| Power & Ops (2) | Off-grid | Grid-tied + islanding; ESS to fire code | F / mech |
| Aquaponics + Vertical Farm (3–4) | Commercial food | Resident-amenity closed-loop; dedicated vent + wet-location electrical | F2, reduced |
| Residences A–D + Penthouses (5–8, 10) | 128 / 12 units | Conventional market dwellings; model split into floors/dwellings/beds | Group C |
| Commons & Clinic (1) | "Clinic" | Telehealth + first-aid (avoid Group B) | D / C |
| The Lung (9) | Air floor | Mechanical / amenity, airtight separation under residences | F / mech |
| Skydeck & Reservoir (11) | Reservoir + pool | Pool only on roof | C amenity |

---

## Approvals sequence (the real long pole = water)

1. **Months 0–2 — Pre-consultation.** Bring the occupancy matrix + water-reuse concept to
   the municipality + Chief Building Official + MECP *before* DD spend; get the path in
   writing.
2. **Months 2–6 — Concept approvals in parallel:** zoning/site plan; MECP ECA pre-submission;
   CMHC MLI Select eligibility; LDC interconnection study.
3. **Months 6–12 — Permit set:** code matrix; fire (interconnected-space) engineering; CSA
   B128 dual-plumbing; ESS fire design; barrier-free.
4. **Software ships independently the whole time** — OpCo revenue clock starts at month 0.

---

## Codebase honesty — changes shipped with this plan

So the demo models the building we can actually permit (not an oversold one):

### Applied — shipped and reflected in the app

- **KPI strip + floor panels + simulator + landing:** `Water reuse` → **`Non-potable reuse`**;
  `Food output` → **`Food (amenity)`**; `Autonomy` → **`Energy autonomy`**. *(Applied.)*
- **Fleet `Building` model:** split into **`unitCount` (floors) / `dwellings` (homes) /
  `beds` (capacity) / `residents` (occupancy)** — in `types.ts`, `schema.ts`, `fleet.ts`,
  seed data, and the fleet detail panel (`Units` → `Floors`, plus Dwellings/Beds). *(Applied.)*
- **`FloorMetrics.waterReusePct`** doc-comment scoped explicitly to **non-potable** reuse. *(Applied.)*
- **`BuildingCompliance` model (Flaw 5, 6, 7, 8 — applied):** `types.ts` gains `EcaStatus` +
  `BuildingCompliance` interface; `Building` gains `compliance?: BuildingCompliance` (jsonb column).
  Seeded for all six fleet buildings. Fleet detail panel surfaces the full compliance record under
  **"Permitting & compliance"**: elevator count, firefighter elevator (OBC 3.2.6), exit stairs,
  sprinkler coverage, barrier-free (OBC/AODA), CSA B128 dual-plumbing flag, MECP ECA status,
  reservoir location, and ESS fire-code compliance. *(Applied.)*
- **Finance / portfolio model (Decision 1 — applied):** `src/lib/finance.ts` encodes OpCo/PropCo
  entity structure, five funding programs (CMHC MLI Select, Greener Affordable Housing, Save on
  Energy, SR&ED, NRC IRAP), and a three-phase approvals timeline. A new **/portfolio** page
  (nav label "Portfolio") renders the capital structure, programs table, and approvals timeline.
  *(Applied.)*
- **Simulator right-sizing (Flaws 5, 7 — applied):** `BuildingSimulator.tsx` now renders the bulk
  reservoir in the **basement** (Reclamation Core level), the **pool only** on the rooftop (Skydeck),
  and **dual elevators** in the core shaft. The voxel model matches the permitted design. *(Applied.)*

### Flaw → fix status (updated)

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 1 | Unit/dwelling/resident conflation | Separate floors / `dwellings` / `beds` / `residents` in data model and pro forma | **Applied** |
| 2 | Water autonomy overstated | Non-potable reuse KPI; reservoir → basement; CSA B128 dual-plumbing | **Applied** |
| 3 | Food floors mis-scoped as production | Resident-amenity closed-loop; KPI relabelled "Food (amenity)" | **Applied** |
| 4 | "Autonomy %" misleading | Resilience Index with three transparent sub-scores | **Applied** |
| 5 | Single elevator + open atrium | Dual elevators + firefighter elevator modelled in `BuildingCompliance`; simulator updated | **Applied** |
| 6 | Occupancy classification | Multiple-major-occupancy design; sprinklers, barrier-free in `BuildingCompliance` | **Applied** |
| 7 | Rooftop reservoir load | Reservoir → basement in model + simulator; pool-only rooftop | **Applied** |
| 8 | ESS under residences | `essFireCompliant` flag in `BuildingCompliance`; ESS design note in seed data | **Applied** |

> Disclaimer: this is a planning aid, not legal/engineering advice. Code citations (OBC/NBC,
> SDWA, CSA B128, MECP ECA, CMHC/NRCan programs) must be confirmed with qualified
> Ontario professionals for the specific site.
