# ATLAS-01 — Pre-Consultation Briefing for Municipal CBO & MECP

**Project:** ATLAS-01 — a self-sufficient residential habitat  
**Location:** Toronto, ON (flagship)  
**Date:** [DRAFT — for review]  
**Prepared for:** Municipality of Toronto Chief Building Official, Ministry of Environment, Conservation and Parks (MECP)

---

## 1. Executive Summary

ATLAS-01 is a 13-storey, 64-dwelling multi-unit residential building designed to operate within the existing Ontario Building Code (OBC) framework as a Group C occupancy with supporting Group D and Group F ancillary spaces. The building integrates enhanced mechanical systems for on-site energy generation, non-potable water reuse, and resident-amenity food production. Every novel capability is implemented as an overlay on code-compliant building services — not as an experimental or unproven technology.

This is a grid-tied, fully sprinklered, code-compliant building with a software-based monitoring and optimization layer. The building does not sever utility connections. It does not treat blackwater for potable reuse. It does not require novel AI safety certification. ATLAS OS is an observability and demand-forecasting platform layered atop a deterministic BMS/PLC that holds all life-safety functions. The building can be permitted, constructed, and occupied under existing codes even if the software layer were never installed.

The purpose of this pre-consultation is to confirm the occupancy classification strategy, introduce the non-potable water reuse system path with MECP, review the fire protection approach, and align with the Authority Having Jurisdiction on the permit pathway before formal submission. We are seeking guidance, not approvals.

## 2. What We Are Building

**Building summary.** ATLAS-01 is a 13-storey mixed-use residential building comprising a basement level, 11 occupied floors, and a rooftop mechanical level. It contains 64 market dwellings across five residential floors, building-services floors dedicated to mechanical and environmental processing, and resident amenity spaces for food production and recreation.

**What is standard.** The residential units (Levels 5–8 and 10) are conventional OBC Group C dwellings — suites with kitchens, washrooms, living areas, and bedrooms. Means of egress follow OBC Part 3: two pressurized exit stairs with vestibules, a dedicated firefighter elevator with protected lobby, areas of refuge at each landing, and full NFPA 13 sprinkler coverage. The building meets Toronto Green Standard and AODA requirements. Construction is Type II or I-A rated assembly depending on final storey count.

**What is novel.** Three building-services floors perform functions typically distributed across municipal utility connections: water reclamation at Level -1, power and operations management at Level 2, and centralized air handling at Level 9. These are mechanical rooms — OBC Group F — with enhanced equipment. Two amenity floors at Level 3 (aquaponics bay) and Level 4 (vertical farm) produce food exclusively for resident use, with no external commercial sale. These are classified as Group F building-service amenity spaces. The software layer (ATLAS OS) monitors telemetry and forecasts demand but exercises no control over life-safety systems, which remain under deterministic PLC logic.

**What we are not building.** ATLAS-01 is not an off-grid structure. It does not sever municipal water, wastewater, or electrical connections. It does not treat blackwater for potable reuse. It is not a research laboratory, industrial food-production facility, or health-care occupancy.

## 3. Why We Are Here (Pre-Consultation Objectives)

1. **Confirm occupancy classification strategy.** The building spans three major occupancy groups (Group C residential, Group D business, Group F mechanical/industrial). We seek AHJ concurrence on how these are classified, separated, and treated under OBC Division B.

2. **Discuss the non-potable water reuse system and MECP pathway.** Greywater and rainwater collection, treatment, and distribution via CSA B128 dual-plumbing requires an MECP Environmental Compliance Approval. We seek pre-consultation guidance on the application pathway, testing requirements, and monitoring protocols.

3. **Review fire protection approach for novel elements.** Fully sprinklered throughout, two pressurized exit stairs, firefighter elevator, areas of refuge. Additional considerations: ESS battery storage in a fire-rated enclosure with clean-agent suppression, biogas containment and detection, and fire-rated separations between each major occupancy group.

4. **Introduce the bulk reservoir relocation.** The non-potable water reservoir was moved from rooftop to basement (reclamation core) to reduce structural loading and enable gravity feed to lower-level treatment equipment.

5. **Frame the telehealth clinic to avoid Group B care occupancy.** Level 1 includes a small telehealth and first-aid room operated as a business-occupancy amenity for residents. No overnight stays, no inpatient care, no Group B classification.

6. **Present the ESS fire-rated enclosure strategy.** Battery energy storage housed in a 2-hour fire-rated room with dedicated ventilation, gas detection, clean-agent suppression, and thermal runaway containment.

## 4. Occupancy Classification Strategy

ATLAS-01 contains multiple major occupancies. The following matrix summarizes each floor's classification, use scope, and the rationale supporting that classification.

| Level | Floor | Occupancy Group | Use Scope | Key Rationale |
|-------|-------|----------------|-----------|---------------|
| -1 | Reclamation Core | F (Division 2) | mechanical & industrial | Non-potable water treatment, bulk reservoir, dual-plumbing manifold. Equipment density and function align with OBC mechanical-service spaces. |
| 1 | Commons & Clinic | D (business) | amenity & telehealth | Co-working lounge, telehealth kiosk, first-aid room. No overnight care, no inpatient beds — excludes Group B per OBC 3.1.2.1. |
| 2 | Power & Ops Core | F (Division 2) | mechanical & industrial | ESS/battery storage, inverters, BMS, anaerobic digester. Grid interconnection and islanding switchgear. Fire-rated enclosure with suppression. |
| 3 | Aquaponics Bay | F (Division 2) | resident amenity | Closed-loop aquaponics. Resident-use only, no external sale — not a commercial food-processing occupancy. Wet-location electrical. |
| 4 | Vertical Farm | F (Division 2) | resident amenity | Hydroponic and aeroponic grow systems. Airtight/humidity separation from residential above. Same use-restriction rationale as Level 3. |
| 5 | Residences A | C | residential | 13 conventional market dwelling units. Standard OBC Part 3 egress and fire separation. |
| 6 | Residences B | C | residential | 13 dwelling units. |
| 7 | Residences C | C | residential | 13 dwelling units. |
| 8 | Residences D | C | residential | 13 dwelling units. |
| 9 | The Lung | F (Division 3) | mechanical | Central air handling, heat recovery, MERV filtration. Mechanical penthouse function — conventional OBC Group F interior. |
| 10 | Penthouses | C | residential | 12 premium dwelling units. Same classification as Residences A–D. |
| 11 | Skydeck & Pool | C | amenity | Rooftop amenity with pool. Bulk reservoir not on roof — pool only. Classified as incidental to Group C occupancy. |

**Key rationale.** Group F floors are building-service and amenity spaces, not independent industrial occupancies. Each is subordinated to and accessory to the primary residential use. Fire separations between major occupancies are designed per OBC 3.1.3.

## 5. Key Building Systems & Code Approach

### 5.1 Water System

The water system is the most novel subsystem and likely the longest conversation with the AHJ. We seek alignment early.

**Scope of reuse.** The system collects and treats greywater (from showers, lavatories, laundry) and rainwater (from roof catchment) for non-potable applications only: toilet flushing, irrigation, and cooling-tower makeup. Treated water is distributed via CSA B128 dual-plumbing with purple pipe riser and labelled outlets. No cross-connection to potable lines.

**Boundary conditions.** There is no blackwater-to-potable pathway. Blackwater (kitchen, washroom soil lines) discharges to municipal sanitary sewer without on-site treatment. This is not a direct potable reuse system, and we are not seeking permission for one.

**Bulk reservoir.** Relocated from rooftop to the basement reclamation core (Level -1) to reduce structural loading, improve seismic stability, and enable gravity feed to downstream treatment equipment. This is a conventional cistern with engineered structural support, leak detection, and overflow connection to municipal storm.

**Regulatory path.** Non-potable reuse falls under MECP's Environmental Compliance Approval (ECA) framework for water-taking and treated-water distribution. We are seeking pre-consultation guidance on the appropriate ECA category, monitoring requirements, and any third-party validation standards the Ministry expects (e.g., NSF 350 or equivalent).

**Potable water.** Municipal supply with multi-stage filtration, UV disinfection, and continuous quality monitoring with automated logging.

### 5.2 Energy System

**Grid interconnection.** The building is grid-tied and remains connected to Toronto Hydro distribution. Islanding capability (IEEE 1547) allows the building to disconnect from the grid during utility outages and operate on stored/buffered energy, but the default operating mode is grid-parallel. This is not an off-grid system.

**Generation.** Rooftop photovoltaic array sized for site load offset. Battery energy storage system (ESS) housed in a dedicated fire-rated enclosure on Level 2. Backup generation via biogas from on-site anaerobic digestion of organic waste — biogas is stored in engineered containment with gas detection, pressure relief, and automatic isolation valves.

**Code compliance.** ESS room designed to 2-hour fire-rated construction with clean-agent suppression, dedicated ventilation, and thermal runaway detection. Biogas system follows CSA B149.6 for gas detection and emergency shutdown. Electrical service entrance meets OESC and Toronto Hydro requirements.

### 5.3 Food Production

**Resident amenity only.** The vertical farm (Level 4) and aquaponics bay (Level 3) produce leafy greens, herbs, fish, and related produce exclusively for resident consumption. There is no external commercial sale, wholesale distribution, or retail component. This avoids CFIA food-premises licensing and OBC Group E (mercantile) or Group F2 (medium-hazard industrial) classification.

**Nutritional scope.** The systems are designed to supplement 30–60% of resident fresh produce and protein needs. The building does not claim full caloric self-sufficiency. Residents retain access to external grocery and food supply chains.

**Building systems integration.** Dedicated ventilation with humidity control, wet-location electrical per OBC Section 34, and fire-rated separation from residential floors above. Drainage routed to the reclamation core. Lighting is horticultural LED with spectral tuning — no high-pressure sodium or combustion-based supplemental CO₂.

### 5.4 Fire & Life Safety

ATLAS-01 is fully sprinklered throughout (NFPA 13 / OBC 3.2.5). The fire protection design is conventional for a 13-storey residential building with three additional considerations:

1. **Means of egress.** Two pressurized exit stairs with vestibules at each floor level. Dedicated firefighter elevator with protected lobby meeting OBC 3.2.6. Areas of refuge at each landing for barrier-free evacuation.

2. **Fire separations.** Each major occupancy group (C, D, F) is separated by fire-rated construction per OBC 3.1.3. Group F mechanical floors are separated from residential floors above by minimum 2-hour fire-rated assemblies.

3. **Hazard-specific enclosures.**
   - **ESS room (Level 2):** 2-hour fire-rated enclosure with clean-agent suppression, gas detection, thermal runaway monitoring, dedicated exhaust, and automatic disconnect.
   - **Biogas containment (Level 2):** Engineered gas-tight enclosure with continuous methane/H₂S detection, automatic isolation valves, pressure relief vent to atmosphere, and explosion-rated construction.
   - **Dual-plumbing riser:** Purple pipe in rated shaft with firestop at each penetration.

### 5.5 Accessibility

The building provides a complete barrier-free path of travel from the public way to every dwelling unit and amenity space. Two passenger elevators plus the firefighter elevator serve all occupied levels. Barrier-free dwelling units are distributed across all residential floors in compliance with OBC 3.8 and AODA Design Standards.

## 6. Siting & Zoning Considerations

**Zoning pre-application.** A zoning due-diligence review has been completed indicating general conformance with applicable Toronto Zoning By-law 569-2013 provisions for the subject site. A formal zoning pre-application will be submitted concurrently with or following this pre-consultation.

**Mechanical floors as building services.** The Group F floors (Levels -1, 2, 3, 4, 9) are framed as building-service and amenity spaces subordinate to the residential use. They are not independent industrial occupancies and do not trigger industrial-zoning setbacks, parking ratios, or separation distances. Each is interior to the building envelope and accessed through the common residential core.

**Major-occupancy separations.** All fire-rated separations between occupancy groups are handled within the building envelope. No exterior segregation or separate means of access is required. The single building address and unified means of egress simplify the zoning and site-plan review.

## 7. The Software Layer (ATLAS OS)

The software platform is a recurring topic of curiosity and concern during pre-consultation discussions. The following framing is critical:

**ATLAS OS observes and advises.** The platform ingests telemetry from building systems (water quality, energy flow, HVAC performance, occupancy patterns) and provides dashboards, demand forecasts, and incident triage recommendations to building operations staff. It is an observability and decision-support tool — not a control system.

**Deterministic BMS/PLC holds all life-safety functions.** All life-safety sequences (fire alarm, sprinkler activation, stair pressurization, gas detection shutdown, ESS thermal runaway response) are executed by hardwired PLC logic with no software dependency on ATLAS OS. If the software layer goes offline, the building continues to operate safely under its base controller programming.

**The 3D digital twin is a visualization tool.** The WebGL twin renders real-time and historical data overlaid on the building model. It does not actuate any building system. It is an ops tool for facility managers, not a control interface.

**Why this matters for permitting.** Because ATLAS OS has no authority over life-safety or primary building control functions, the building can be permitted under existing OBC and Ontario Regulation codes. No novel AI safety certification, software assurance, or algorithmic approval is required. The software team ships independently and deploys against a read-only telemetry stream.

## 8. Timeline & Next Steps

| Phase | Duration | Activities |
|-------|----------|-----------|
| Pre-consultation | Months 0–2 | This meeting; align occupancy classification, MECP pathway, and fire protection approach with AHJ |
| Zoning & site plan | Months 2–6 | Formal zoning application, site plan approval, MECP ECA pre-submission, CMHC Seed Funding eligibility, LDC study |
| Full permit set | Months 6–12 | Complete architectural, structural, mechanical, electrical, and fire protection drawings for building permit |
| Construction | Months 12–24 | Tender, excavation, structure, systems installation, commissioning, occupancy |
| Software delivery | Throughout | ATLAS OS ships independently through agile releases; integrates against commissioned building telemetry post-occupancy |

## 9. Open Questions for the AHJ

1. **MECP ECA pathway.** What is the preferred Environmental Compliance Approval category for non-potable greywater/rainwater reuse in a residential setting? Does the Ministry expect third-party certification (NSF 350) or is a site-specific engineering design report sufficient?

2. **Vertical hydroponics as amenity space.** Does the municipality have precedent for treating vertical hydroponics and aquaponics as building amenity space (Group F accessory to residential) rather than agricultural or industrial occupancy?

3. **Multiple-major-occupancy classification.** Does the CBO have specific concerns about the three-occupancy approach (Groups C, D, F) or the proposed fire-separation ratings between them?

4. **Pre-submission documentation.** What documentation would the CBO like to see before the formal building permit application? Would a preliminary design brief, a code-compliance matrix, or a life-safety strategy document be helpful?

5. **ESS and biogas permitting.** Are there local amendments or municipal requirements beyond the OBC and OESC for battery energy storage or biogas systems in residential buildings?

6. **Telehealth clinic framing.** Does the municipality accept the proposed telehealth/first-aid room as a Group D business occupancy accessory to residential, or is additional documentation needed to rule out Group B classification?

## 10. Attachments Referenced

- [ATLAS Data Model](./ATLAS-data-model.md) — entity-relationship model for ATLAS OS telemetry and building systems integration
- [Owner's Project Requirements](./OWNERS_PROJECT_REQUIREMENTS.md) — OPR document covering performance targets, sustainability goals, and commissioning requirements
- [Legal & Compliance Framework](./LEGAL_COMPLIANCE.md) — jurisdictional matrix, regulatory mapping, and legal strategy documentation
- [3D Code-Compliance Cutaway Render Set] — architectural and fire-protection visualization (separate deliverable)

---

**Disclaimer:** This briefing is a planning tool for pre-consultation discussion. It does not constitute a permit submission, a final design, or a professional stamp. All building systems must be designed, reviewed, and certified by licensed professionals registered in the Province of Ontario, and approved by the Authority Having Jurisdiction prior to construction.
