# ATLAS‑01 — Owner's Project Requirements (OPR) & Code‑Compliance Matrix

| | |
|---|---|
| **Program** | ATLAS Habitat Initiative |
| **Asset** | ATLAS‑01 (first habitat) |
| **Status** | Draft v0.1 — for review by Architect/Record + Professional Engineers |
| **Scope** | Canada (launch: Ontario assumed) → United States → international |
| **Companion docs** | [Legal & Compliance](./LEGAL_COMPLIANCE.md) · [Requirements (PRD)](./REQUIREMENTS.md) · [Business Plan](./BUSINESS_PLAN.md) |

> **Disclaimer.** This OPR is an internal design‑intent document, **not a permit set and not
> engineering certification.** Every system must be designed, stamped, and approved by
> licensed professionals and the Authority Having Jurisdiction (AHJ) before construction.
> ATLAS is **operationally independent, not legally exempt** — all codes apply in full.

---

## 1. Owner's intent

A self‑sufficient residential habitat: one floor per human need (water, energy, food,
shelter, air, health, restoration), with a basement reclamation core and a rooftop
amenity. The building generates power, recycles water/waste, and grows part of its food.
**Life‑safety never depends on AI or cloud** — see §4.

## 2. Functional program (per‑level intent)

| Level | Use | Key owner requirements |
|---|---|---|
| Basement | Reclamation core: reservoir, water treatment, anaerobic digester/biogas | Code‑rated containment, gas detection, isolation; potable/non‑potable separation |
| Energy | ESS (battery), inverters, controls | **ESS in a fire‑rated room** (not an open wall): rated walls, vented louvers, deluge |
| Water | Treatment, dual plumbing | CSA B128 dual‑plumbing; purple non‑potable riser + backflow preventer |
| Food | Vertical farm / aquaponics | Food‑safety handling; isolated micro‑livestock if any (never open farming) |
| Shelter | Dwelling floors | Unit/bed counts per program; barrier‑free units; fire separation |
| Air | Atrium "Lung" / ventilation | IAQ, pressurization integration |
| Health | Commons + telehealth + accessible WC | Keep out of Group B (no clinical bays) to avoid hospital occupancy |
| Restoration | Skydeck / pool | Roof pool only; parapet + fall protection |
| Rooftop | PV array, reservoir, comms mast | Structural + electrical + lightning/grounding |

## 3. Code‑compliance matrix (verify per AHJ)

| Domain | Governing code/standard (CA launch) | Owner requirement |
|---|---|---|
| Structure | National Building Code of Canada + provincial (e.g. OBC); IBC‑based in US | PE‑stamped; 3D‑printed shell as *accelerator* with engineered alternative solution |
| Fire & life safety | OBC Part 3; NFPA where referenced | 2 pressurized exit stairs + vestibules; **firefighter elevator** (OBC 3.2.6); areas of refuge; sprinkler/standpipe risers |
| Egress / accessibility | OBC barrier‑free; Accessible Canada Act / AODA; ADA (US) | Barrier‑free units + paths; areas of refuge designed‑in |
| Elevators | Provincial elevator code (e.g. TSSA) | Passenger cars A/B + protected firefighter car |
| Electrical / ESS | CE Code; battery storage standards | Licensed design; ESS fire‑rated room; utility interconnection even if grid is backup |
| Potable water | Provincial drinking‑water regs | Multi‑stage treatment; monitored, **logged** water quality |
| Greywater/blackwater reuse | Plumbing code; provincial reuse approvals | Reuse‑class standards; non‑potable clearly separated |
| Biogas / digester | Environmental permits; fire code; emissions | Engineered containment, detection, pressure relief |
| Food production | CFIA / Safe Food for Canadians; provincial public health | Inspection + traceability if sold |
| Zoning | Municipal | Pre‑application meetings; frame food/energy as building services |

## 4. The safety boundary (non‑negotiable)

Deterministic, safety‑rated controls (BMS/PLC) hold fire, egress, electrical isolation,
and biogas safety. **ATLAS OS / AI / cloud is observe‑and‑advise only** and must never be a
prerequisite for any life‑safety function. This boundary is a design requirement and a
regulatory‑approval asset.

## 5. Permits & approvals checklist (initiate early)

- [ ] Zoning pre‑application / variances
- [ ] Building permit (PE/architect‑stamped set; alternative‑solution package for 3D print)
- [ ] Electrical permit + utility interconnection/net‑metering agreement
- [ ] Plumbing permit (dual‑plumbing, backflow)
- [ ] Drinking‑water system approval + sampling plan
- [ ] Wastewater/greywater reuse approval
- [ ] Environmental permit (digester/biogas) + fire‑code review
- [ ] Food premises / CFIA registration (if selling produce)
- [ ] Elevator licensing (incl. firefighter car)
- [ ] Fire‑department plan review + occupancy permit

## 6. Commissioning & verification

Independent commissioning of water quality, ESS, fire/egress, and the safety boundary.
Telemetry logs (water quality, energy, incidents) retained for audit and SR&ED.

---
*Pair this OPR with stamped Basis‑of‑Design documents from each discipline before P1 close.*
