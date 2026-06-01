# Project ATLAS — Legal & Compliance Framework

| | |
|---|---|
| **Program** | ATLAS Habitat Initiative |
| **Status** | Draft v0.1 — for review by qualified counsel |
| **Scope** | Canada (launch) → United States → international/humanitarian |
| **Companion docs** | [Business Plan](./BUSINESS_PLAN.md) · [Budget & Fundraising](./BUDGET_AND_FUNDRAISING.md) · [Pitch Deck](./PITCH_DECK.md) |

> **Disclaimer.** This document is an internal planning framework, **not legal advice.**
> It must be reviewed and adapted by qualified counsel in each operating jurisdiction
> before reliance. ATLAS is **operationally independent, not legally exempt** — every
> building code, food-safety rule, and health-data law applies in full.

---

## 1. Guiding principle

ATLAS's "decentralization" is **operational, not legal or regulatory.** We provision our
own energy, water, and partial food, but we comply with — and engage early with — every
applicable authority. We frame the project to regulators as **resilience, not
sovereignty.** This framing is a funding and approvals asset, not a constraint.

## 2. Corporate structure (decision needed)

We are evaluating three structures. The choice drives tax treatment, donor incentives,
investor rights, and governance.

| Option | Pros | Cons | Best when |
|---|---|---|---|
| **Nonprofit / registered charity** (CA: CRA registered charity; US: 501(c)(3)) | Issues tax receipts; eligible for foundation grants; mission-locked | Limits equity investment; restricted commercial activity; slower | Pure humanitarian deployments |
| **B-Corp / for-profit social enterprise** | Takes equity + impact capital; agile; can license OS/Kit | No charitable receipts; donor-grant access narrower | The software + Kit business |
| **Hybrid: Foundation + operating company** *(recommended)* | Foundation holds mission + receives charity/grants + owns/endows the assets; OpCo builds the OS/Kit and earns recurring revenue; clean separation | More structure to run; related-party governance must be arms-length | Scaling a blended-capital venture |

**Recommendation:** a **hybrid** — a charitable foundation (asset endowment, grants,
humanitarian deployments, impact reporting) plus a B-Corp operating company (ATLAS OS
SaaS, the Kit, EPC). Requires careful related-party governance and transfer-pricing so
charitable funds are not used to subsidize private gain. **Confirm with counsel + tax
advisor before P1 close.**

## 3. Building, construction & zoning

| Area | Requirement | ATLAS approach |
|---|---|---|
| **Building codes** | National Building Code of Canada + provincial codes (e.g. OBC in Ontario); IBC-based codes in the US | Design to code from day one; the over-provisioned physical layer is code-compliant, not a workaround |
| **3D-printed structure** | Limited code precedent; needs alternative-solution / engineered approval and stamped structural review | Treat 3D printing as a *shell accelerator*; foundation/roof/MEP conventional; engage AHJ early with a Professional-Engineer-stamped alternative solution |
| **Zoning** | Residential + the unusual mixed-use of farm/energy/water floors | Pre-application meetings; frame food/energy floors as building services, not industrial use; pursue variances where needed |
| **Fire & life safety** | Egress, fire separation, sprinkler/standpipe; **biogas storage is a fire-code item** | Deterministic, safety-rated controls (BMS/PLC) hold life safety — never gated on AI/cloud; biogas handling engineered to code with detection + isolation |
| **Elevators / accessibility** | Provincial elevator codes; accessibility (e.g. Accessible Canada Act, AODA, ADA in US) | Designed in; not bolted on |
| **Energy systems** | Electrical code; grid-interconnection / net-metering agreements; battery storage codes | Licensed electrical design; utility interconnection even when grid is backup-only |

## 4. Water, waste & food (the differentiators carry the heaviest regulation)

| System | Key regimes | Notes |
|---|---|---|
| **Potable water** | Provincial drinking-water regulations; treatment + testing/permitting | Self-supplied water is **more** regulated, not less — multi-stage filtration with monitored, logged water quality |
| **Greywater / blackwater reuse** | Plumbing code; provincial wastewater & reuse approvals | ~90%+ reuse must meet reuse-class standards; non-potable reuse clearly separated |
| **Anaerobic digester / biogas** | Environmental permits; fire code; emissions | Engineered containment, gas detection, pressure relief |
| **Aquaponics / produce** | Food-safety (e.g. CFIA, provincial public health, Safe Food for Canadians Regs) | Commercial food handling/sale triggers inspection + traceability |
| **Micro-livestock (eggs) & insect protein** | Animal welfare; zoning; food-safety; novel-food rules for insects | Kept isolated; **never open livestock farming in a tower** (odor/disease/welfare/zoning) |
| **Communal kitchen / distribution** | Public-health food-premises licensing | Commons & Clinic floor operates under food-premises rules |

## 5. Health & clinic data (Commons & Clinic floor / telehealth)

- **Canada:** **PHIPA** (Ontario health info) and **PIPEDA** (private-sector personal
  data) govern any clinic/telehealth data. Health data is high-sensitivity.
- **Telehealth:** clinician licensing per province/state; cross-jurisdiction practice
  rules; consent and record-retention requirements.
- **Approach:** minimize collection; encrypt at rest and in transit; strict access
  control and audit logging; clear consent; data-retention schedule. Telehealth uses
  vetted, compliant video APIs.

## 6. Resident data, privacy & surveillance

- **Data dignity is a product feature, not an afterthought.** Minimize collection;
  residents can see and control their own data.
- **Common-area cameras & occupancy sensing** governed by clear, posted policy and
  tenant-privacy law; no surveillance of private dwellings.
- **Sub-metering** per unit is operational telemetry, not behavioral surveillance —
  scoped and disclosed.
- **Legal basis:** PIPEDA (CA) / state privacy laws (US) / GDPR-class rules where
  applicable internationally.

## 7. Cybersecurity & building-automation security

Building-automation systems are a known ransomware/botnet target — **threat-model at
design time, not after an incident.**

- **Network segmentation:** the building-automation network is isolated from tenant
  networks. A compromised tenant device must never reach lock or life-safety controllers.
- **Local fail-safe:** the building stays safe and functional during internet/grid loss.
  A front door that won't open during an ISP outage is a liability, not a bug.
- **Auditability:** SR&ED/CRA-grade logging of system decisions and R&D experiments.

## 8. AI governance & liability

- **The AI never holds a life-safety function.** A failed model, lost network, or bad
  inference may degrade *optimization*, never *safety*. This is contractual and
  architectural, and it is central to our liability posture.
- **Human-in-the-loop** for any safety-critical action; the AI proposes, humans approve
  within pre-authorized, bounded envelopes.
- **Emerging AI regulation:** track Canada's AIDA (proposed) / provincial rules, the EU AI
  Act for international deployments, and sector guidance. Maintain model documentation,
  decision logs, and incident reporting.

## 9. SR&ED & R&D tax-credit compliance (a funding edge)

The forecasting, multi-agent optimization, and anomaly-detection work is plausibly
**SR&ED-eligible experimental R&D** — non-dilutive funding most housing projects lack.

- **Maintain from day one:** hypothesis → experiment → outcome logs; time tracking on
  eligible R&D; technical-uncertainty documentation; segregation of eligible vs routine
  engineering.
- This is CRA-grade record-keeping — a transferable compliance discipline. Get a SR&ED
  specialist to scope the claim before P1.

## 10. Fundraising & securities compliance

| Capital type | Compliance considerations |
|---|---|
| **Charitable donations / grants** | Charitable-receipt rules (CRA / IRS); grant-agreement covenants; restricted-fund accounting |
| **Equity (B-Corp / OpCo)** | Securities law; exemptions for private placements; investor accreditation; cap-table/governance |
| **Crowdfunding** | Securities crowdfunding rules (CA provincial / SEC Reg CF in US) — disclosure + limits |
| **Carbon credits** | Verification/registry standards; additionality; avoid double-counting |
| **Cross-border philanthropy** | Qualified-donee rules; international grant-making compliance |

See [Budget & Fundraising](./BUDGET_AND_FUNDRAISING.md) for the capital stack itself.

## 11. International & humanitarian deployments

- **Data residency:** each destination's data-protection rules apply; resident/clinic data
  may not leave certain jurisdictions. ATLAS OS supports per-region data residency.
- **Local building/health/food law** governs in each country — no assumption of Canadian
  rules carrying over.
- **Humanitarian context:** coordinate with host-government and agency frameworks (e.g.
  UNHCR shelter standards); import/customs for the Kit; local labor and licensing.

## 12. Compliance roadmap by phase

| Phase | Legal priorities |
|---|---|
| **P0** | Choose corporate structure; engage construction/zoning + SR&ED counsel; draft data-privacy policy |
| **P1 (pilot)** | AHJ alternative-solution approval for 3D-print shell; water/food permits; first SR&ED claim setup; donor grant agreements |
| **P2 (ATLAS‑01)** | Full code compliance + occupancy; PHIPA/PIPEDA for clinic; tenant agreements + privacy disclosures |
| **P3 (Kit)** | OS licensing terms; IP protection; repeatable approvals playbook |
| **P4 (expansion)** | US + international counsel; per-region data residency; securities compliance for scaled fundraising |

## 13. Open legal questions

1. Final corporate structure (nonprofit vs B-Corp vs hybrid).
2. Jurisdiction-specific approval path for the 3D-printed structural shell.
3. SR&ED claim scope and specialist engagement.
4. Securities structure for blended equity + philanthropic capital.
5. First-site province (drives the specific code/health/food regime).

---

*Reviewed claims and structures herein must be validated by qualified legal and tax
professionals in each operating jurisdiction prior to reliance.*
