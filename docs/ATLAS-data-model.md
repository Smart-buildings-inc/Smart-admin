# ATLAS OS — Domain Model Reference (v1)

> This document describes the expanded domain model introduced alongside the
> OpCo/PropCo de-risking plan. It is the canonical reference for every type,
> field, and business rule encoded in `src/lib/types.ts`, `src/lib/db/schema.ts`,
> and `src/lib/db/seed-data.ts`.
>
> **Disclaimer:** regulatory citations (OBC/NBC, SDWA, CSA B128, MECP ECA,
> CMHC/NRCan programs) are planning aids only and must be confirmed by
> qualified Ontario professionals for the specific site and use.

---

## 1. Why the model changed

The original data model used `unitCount` to mean both "number of floor groups"
and "number of dwellings", and left water/food KPIs unlabelled in ways that
implied capabilities (blackwater → potable, commercial food production) that are
not currently permittable in Ontario. A building-review meeting identified eight
specific flaws; the model changes here encode the fixes. See
[docs/ATLAS-derisking-plan.md](./ATLAS-derisking-plan.md) for the full decision
record.

---

## 2. Floor

### 2.1 Existing fields (unchanged)

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Stable slug, e.g. `"reclamation-core"` |
| `name` | `string` | Display name |
| `level` | `number` | Physical floor number (negative = below grade) |
| `need` | `Need` | Which human need this floor primarily serves |
| `unitCount` | `number` | Number of discrete floor sections / modules on this level — **not** dwelling count |
| `metrics` | `FloorMetrics` | Sparse per-floor telemetry (all fields optional) |
| `activeIncidents` | `number` | Count of open incidents on this floor |

### 2.2 New occupancy-classification fields

| Field | Type | Meaning |
|---|---|---|
| `occupancyGroup` | `OccupancyGroup` | OBC major occupancy letter (`"A"` through `"F"`) |
| `useScope` | `UseScope` | Functional scope — `"residential"`, `"amenity"`, `"business"`, `"mechanical"`, or `"industrial"` |
| `dwellings` | `number \| undefined` | Count of self-contained dwelling units on this floor (undefined for non-residential floors) |
| `beds` | `number \| undefined` | Total bed count / maximum sleeping capacity on this floor (undefined for non-residential floors) |
| `regulatoryNotes` | `string[]` | Free-text compliance flags, references, and design constraints specific to this floor |

### 2.3 OccupancyGroup

Mirrors the Ontario Building Code / National Building Code major-occupancy
classification letters. Only the letters relevant to ATLAS-01 are described here:

| Value | OBC class | Typical ATLAS use |
|---|---|---|
| `"A"` | Assembly | Large gathering / public assembly spaces |
| `"B"` | Care or detention | Care/detention occupancies (avoided in ATLAS design — the clinic is telehealth/first-aid only) |
| `"C"` | Residential | Market dwelling units, penthouses, amenity sky-deck |
| `"D"` | Business and personal services | Commons, telehealth clinic, co-working |
| `"E"` | Mercantile | Retail (not present in ATLAS-01) |
| `"F"` | Industrial | Mechanical plant, aquaponics bay, vertical farm, power/ops core, reclamation core |

### 2.4 UseScope

A finer-grained tag that captures the *functional* scope independently of the
OBC letter:

| Value | Meaning |
|---|---|
| `"residential"` | Contains self-contained market dwelling units |
| `"amenity"` | Resident-only amenity (no external public access, no commercial sale) |
| `"business"` | Office / services / telehealth |
| `"mechanical"` | Building-systems plant (water, power, HVAC, structural core) |
| `"industrial"` | Controlled-environment production or processing (aquaponics, vertical farm) |

---

## 3. Building

### 3.1 Existing fields (unchanged)

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Stable slug |
| `name` | `string` | Display name |
| `location` | `string` | City / address label |
| `unitCount` | `number` | Number of distinct floor zones / sections — preserved for back-compat |
| `residents` | `number` | Current occupancy headcount |
| `status` | `BuildingStatus` | `"online"`, `"degraded"`, `"offline"` |
| `kpis` | `BuildingKpis` | Aggregated KPIs |

### 3.2 New fields

| Field | Type | Meaning |
|---|---|---|
| `dwellings` | `number` | Total self-contained dwelling units across all residential floors |
| `beds` | `number` | Total bed capacity across all residential and amenity floors |
| `gridTied` | `boolean` | Whether the building maintains a live utility-grid connection (always `true` for ATLAS-01 under the right-sized design) |
| `islandCapable` | `boolean` | Whether the building's ESS and controls can sustain islanded operation during a grid outage |

> **Design rationale:** the original model implied off-grid operation, which is
> not achievable under current LDC interconnection rules in Ontario. The
> `gridTied` flag makes the energy strategy explicit: ATLAS-01 is grid-tied and
> meets islanding safety requirements (IEEE 1547 / CSA C22.2 No. 107.1), but it
> is not off-grid.

---

## 4. BuildingKpis

### 4.1 Existing fields (with relabels)

| Field | Type | Meaning |
|---|---|---|
| `autonomyPct` | `number` | **Kept for back-compat** — equals `resilience.energyPct`. Represents energy autonomy (% of electrical demand met by on-site solar + ESS), not blanket self-sufficiency. |
| `batteryPct` | `number` | Current state of charge of the building's ESS (0–100) |
| `solarKw` | `number` | Live solar generation, kilowatts |
| `waterReusePct` | `number` | **Non-potable reuse only.** Percentage of non-potable demand (toilets, irrigation) met by on-site greywater/rainwater reclamation. Dual-plumbing + cross-connection control required. No blackwater→potable pathway. |
| `foodKgPerDay` | `number` | Resident-amenity produce yield, kg/day. Amenity use only — no external commercial sale (avoids CFIA/food-premises licensing). |
| `residentCount` | `number` | Current headcount of residents in the building |
| `openIncidents` | `number` | Count of unresolved incidents |

### 4.2 New: Resilience Index

```
resilience: {
  overall:    number   // 0–100; average of the three sub-scores
  energyPct:  number   // 0–100; on-site solar + ESS vs. total electrical demand
  waterPct:   number   // 0–100; greywater/rainwater reuse vs. non-potable demand
  foodPct:    number   // 0–100; amenity yield vs. resident daily food target
}
```

#### Why a Resilience Index?

The previous "Autonomy %" implied a blanket self-sufficiency claim that cannot
be honoured for water (no blackwater→potable) or food (amenity only). The
Resilience Index is transparent: each sub-score measures only what the system
actually does, clearly labelled, and the headline `overall` is the arithmetic
mean of the three.

#### Sub-score definitions

| Sub-score | Formula | Notes |
|---|---|---|
| `energyPct` | `(solarKw × capacity_factor) / total_electrical_load × 100`, capped at 100 | Measures the fraction of electrical demand covered by on-site generation and ESS dispatch. ESS must comply with OBC fire separation and ventilation requirements. |
| `waterPct` | `greywater_yield / non_potable_demand × 100`, capped at 100 | Non-potable demand = toilets + irrigation + mechanical cooling make-up. CSA B128 dual-plumbing; MECP Environmental Compliance Approval required for the reclamation system. Bulk cistern located at basement level (structural load relief vs. rooftop). |
| `foodPct` | `foodKgPerDay / (residentCount × FOOD_TARGET_KG_PER_RESIDENT) × 100`, capped at 100 | Uses the planning assumption below. |

#### Planning assumption — food target

```
FOOD_TARGET_KG_PER_RESIDENT = 0.5 kg/day/resident
```

This is a conservative planning-phase estimate for the fraction of a resident's
diet that the amenity aquaponics/farm floors might realistically supply (roughly
leafy greens, herbs, and some fish protein). It is **not** a claim of full
caloric sufficiency. The actual figure will depend on floor area, crop selection,
and yield data from the operating building. Update the constant as measured data
becomes available.

#### `autonomyPct` back-compat

`autonomyPct` in `BuildingKpis` is preserved as an alias:

```
autonomyPct === resilience.energyPct
```

Existing consumers (KPI strip, API callers, tests) that read `autonomyPct` will
continue to receive the energy-autonomy sub-score without changes.

---

## 5. Per-floor occupancy matrix — ATLAS-01

The table below encodes the right-sized permitting strategy for the Toronto
flagship. Occupancy letters and use scopes are stored in the seed data so
the `FloorPanel` can surface them to operators alongside `regulatoryNotes`.

| Floor | Level | Name | OccupancyGroup | UseScope | dwellings | beds | Key regulatory notes |
|---|---|---|---|---|---|---|---|
| Reclamation Core | −1 | Water reclamation + bulk cistern | F | mechanical | — | — | CSA B128 dual-plumbing; MECP ECA required; bulk reservoir at grade/basement (not rooftop); no blackwater→potable pathway |
| Commons & Clinic | 1 | Commons, telehealth, co-working | D | business | — | — | Clinic = telehealth + first-aid only (avoid OBC Group B); fire separation from residential floors above |
| Power & Ops Core | 2 | Solar inverters, ESS, BMS | F | mechanical | — | — | Grid-tied + islanding (IEEE 1547); ESS fire code: separation, detection, ventilation; not off-grid |
| Aquaponics Bay | 3 | Fish + recirculating aquaculture | F | amenity | — | — | Resident amenity, no external sale (avoids CFIA/food-premises); dedicated wet-location electrical; airtight separation under residences |
| Vertical Farm | 4 | Controlled-environment crop production | F | amenity | — | — | Same amenity classification as Aquaponics Bay; dedicated ventilation |
| Residences A | 5 | Market dwellings | C | residential | per design | per design | Conventional market units; OBC Group C fire separations + sprinkler |
| Residences B | 6 | Market dwellings | C | residential | per design | per design | As above |
| Residences C | 7 | Market dwellings | C | residential | per design | per design | As above |
| Residences D | 8 | Market dwellings | C | residential | per design | per design | As above |
| The Lung | 9 | Whole-building air management | F | mechanical | — | — | Airtight compartment separation above residences; rated mechanical floor; fire dampers at all penetrations |
| Penthouses | 10 | Premium market dwellings | C | residential | up to 12 | per design | Access to Skydeck above; barrier-free path (OBC/AODA); dual elevators + firefighter elevator |
| Skydeck & Pool | 11 | Rooftop pool + social deck | C | amenity | — | — | Pool only on roof (reservoir relocated to basement); rooftop live/dead + seismic engineering for pool sloshing |

---

## 6. How the twin tells the honest story

| Surface | What it shows |
|---|---|
| **FloorPanel (F2)** | `occupancyGroup` + `useScope` badge per floor; `regulatoryNotes` rendered as a compliance callout list so operators and investors see the permitting strategy alongside live telemetry |
| **KPI strip (F5)** | Three Resilience sub-scores (`energyPct`, `waterPct`, `foodPct`) plus the blended `overall` index; labels read "Energy autonomy", "Non-potable reuse", "Food (amenity)" — no overstatement |
| **Fleet view (F7)** | `gridTied` and `islandCapable` flags per building in the rollup so fleet operators can see grid-dependency posture across the portfolio at a glance |
| **Simulator (F12)** | Voxel building reflects the right-sized floor program (reservoir in basement, pool on rooftop only) |

---

## 7. Dwellings / beds / residents — why the split matters

The original seed data showed `unitCount: 12` alongside `residents: 128`, giving
a ratio of ~10.7 persons per "unit" — a profile consistent with congregate
housing, not market residential. This is a material misrepresentation for
financing (CMHC MLI Select), zoning, and OBC occupancy classification.

The corrected model separates four distinct counts:

| Field | What it counts |
|---|---|
| `unitCount` (on Floor) | Number of floor sections / modules — a structural/program concept |
| `dwellings` (on Floor + Building) | Self-contained dwelling units (each with private kitchen + bath) — the financing unit |
| `beds` (on Floor + Building) | Maximum sleeping capacity — used for fire egress and life-safety calculations |
| `residents` (on Building, via `BuildingKpis.residentCount`) | Current occupancy headcount — the operational metric |

For a conventional market multi-unit building the ratio `residents / dwellings`
should be 1–3 persons per unit. The pro forma and seed data are calibrated to
this range.

---

## 8. Related documents

- [De-Risking & Win-Win Plan](./ATLAS-derisking-plan.md) — the decision record
  behind every change in this model.
- `src/lib/types.ts` — TypeScript source of truth for all types described here.
- `src/lib/db/schema.ts` — Drizzle/Neon schema, mirrors `types.ts`.
- `src/lib/db/seed-data.ts` — canonical ATLAS-01 seed values for every field.
