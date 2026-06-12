# ATLAS-01 — Code Compliance Cutaway Renders

**Document:** CODE_COMPLIANCE_RENDER_SPEC.md  
**Version:** 1.0  
**Status:** Draft  
**Purpose:** Pre-consultation visual aids for CBO / MECP meetings — demonstrating OBC/NBC/CSA compliance through 6 schematic cutaway renders.

---

## 1. Occupancy Classification Matrix Render

**Code References:** OBC Division B 3.1.2, 3.1.3, 3.1.4  
**View:** Front cutaway, slight upward tilt, 1920×1080, dark background  
**Style:** Technical schematic — flat shaded, color-coded per occupancy group

### Content

| Occupancy Group | Colour | Floors |
|---|---|---|
| **Group C — Residential** | Teal–green gradient | Residences A–D, Penthouses, Skydeck |
| **Group D — Business** | Purple | Commons & Clinic |
| **Group F — Industrial / Mechanical** | Amber | Reclamation Core, Power & Ops, Aquaponics Bay, Vertical Farm, The Lung |

### Annotations
- Floor-by-floor occupancy group label (e.g. `"Group C — Residential Dwelling"`)
- Use-scope sub-label (e.g. `"32 dwelling units, 2 barrier-free"`)
- **Red horizontal bands** at every occupancy transition floor (C↔D, D↔F) marking fire-rated horizontal separation per OBC 3.2.3.1
- Legend box in bottom-right corner

### Production (Blender)
1. Open `build_atlas_tower.py`
2. Assign each floor mesh one of three occupancy-group materials:
   - `mtl_occ_c` (teal‑green)
   - `mtl_occ_d` (purple)
   - `mtl_occ_f` (amber)
3. Enable occupancy-group overlay collection
4. Camera: `loc=(18, -32, 28)`, `rot=(68°, 0°, -28°)` — front elevation, slight upward tilt
5. Render pass: `1920×1080`, `samples=128`, `film_transparent=True`
6. Composite: dark gradient background, title block, legend

### Production (Procedural Twin — fallback)
- Add `"occupancyMode": true` to `BuildingSimulator.tsx`
- Per-floor colour map driven from occupancy dataset
- Toggle UI: `Compliance → Occupancy Matrix`

---

## 2. Means of Egress Render

**Code References:** OBC Division B 3.2.6, 3.4.6, 3.4.7  
**View:** Front cutaway (same camera as Render 1), transparent exterior walls  
**Style:** Wireframe + solid highlights on egress elements

### Content
- **Two exit stairs** (green solid) — one on each side of building
- **Firefighter elevator** (red) with protected lobby at each landing
- **Passenger elevators A & B** (blue)
- **Areas of refuge** (yellow dots) at each stair landing — labelled `"Area of Refuge"`
- **Travel path** (white dashed line) — from a typical dwelling-unit door to the nearest exit stair at grade
- Floor labels with occupant load counts (e.g. `"Load: 48 persons"`)

### Annotations
- `"Pressurized Exit Stair 1 — OBC 3.2.6."`
- `"Pressurized Exit Stair 2 — OBC 3.2.6."`
- `"Firefighter Elevator with Protected Lobby — OBC 3.2.6.12"`
- `"Area of Refuge at Each Landing — OBC 3.4.6.12"`
- Legend box: green=exit stair, red=firefighter lift, blue=passenger lift, yellow=refuge

### Production (Procedural Twin — preferred)
- Add `"egressMode": true` toggle in `BuildingSimulator.tsx`
- Overlay: stair-core boxes, lift-shaft boxes, refuge dots
- Annotations via CSS2DRenderer labels
- Travel path drawn as a dashed THREE.Line

### Production (Blender — fallback)
- Import stair-core and lift meshes from per-floor builders
- Assign `mtl_egress_stair`, `mtl_egress_ff_lift`, `mtl_egress_pass_lift`
- Enable `Transparent Exterior` material override on curtain-wall meshes
- Render with same camera as Render 1

---

## 3. Fire Separation Render

**Code References:** OBC Division B 3.1.3.1, 3.2.3.1, 3.2.4, 3.2.5, 3.2.9  
**View:** Side cutaway (rotated ~90° from Render 1), 1920×1080  
**Style:** Technical cross-section — occupancy blocks, thick separation lines, riser pipes

### Content
- Occupancy group blocks coloured per the shared legend (C=teal, D=purple, F=amber)
- **Thick red lines** at every horizontal fire separation between groups
- **Fire-resistance rating label** per separation (e.g. `"2 hr FRR — OBC 3.2.3.1"`)
- **Sprinkler riser** (blue vertical pipe) with branch lines at each floor
- **Standpipe riser** (red vertical pipe) with 65 mm hose connections
- **Fire-alarm / detection zones** colour-coded by floor or group (light orange zones)

### Annotations
- `"Horizontal Fire Separation — 2 hr FRR"`
- `"Sprinkler System Riser — OBC 3.2.5."`
- `"Standpipe Riser — OBC 3.2.9."`
- `"Fire Detection Zone X — OBC 3.2.4."`
- Legend box

### Production (Blender)
- Same per-floor occupancy‑group material assignment as Render 1
- Add fire‑separation band meshes (flat red boxes, 300 mm tall) at transition floor slabs
- Add riser pipes using simple cylinder geometry (blue and red)
- Camera: side cutaway, `loc=(-32, 18, 28)`
- Enable `Cutaway` clipping plane in viewport

---

## 4. Dual-Plumbing & Water System Render

**Code References:** CSA B128, OBC Division B 7.2, 7.6  
**View:** Isometric of service core (NW corner), 1920×1080  
**Style:** Detailed schematic — purple vs. blue pipe runs, labelled tanks

### Content
- **Purple non-potable riser** — runs from basement reservoir to every floor, terminating at fixtures
- **Blue potable riser** — from municipal connection, serving drinking-water fixtures only
- **Basement treatment train:** holding tank → MBR → UV → storage reservoir
- **Bulk non-potable reservoir** (large tank, purple tint)
- **Backflow preventer** valve symbol at municipal connection
- Pipe diameter labels (e.g. `"DN80"`) at riser transitions

### Annotations
- `"Non‑potable reuse only — CSA B128 dual‑plumbing"`
- `"Reservoir in basement (not rooftop)"`
- `"Cross‑connection control — ASSE 1015 backflow preventer"`
- `"Potable water — municipal supply"`
- Legend box: purple=non-potable, blue=potable

### Production (Blender)
- Add purple and blue cylinder/pipe meshes in `_blender/f_energy.py` or `_blender/build_atlas_core.py`
- Add rectangular tank geometry for basement reservoir
- Assign materials `mtl_pipe_nonpotable` (purple) and `mtl_pipe_potable` (blue)
- Camera: isometric, `loc=(18, 18, 30)`, orthographic
- Render with basement level visible (no ground plane)

### Production (Procedural Twin — fallback)
- Add `"plumbingMode": true` to `BuildingSimulator.tsx`
- Draw pipe paths as TubeGeometry with per‑segment colour (purple/blue)
- Annotate with CSS2DRenderer labels

---

## 5. Barrier-Free Path Render

**Code References:** AODA (Ontario Regulation 191/11), OBC Division B 3.8, 3.4.6.12  
**View:** Front cutaway (same camera as Render 1 & 2), 1920×1080  
**Style:** Schematic with accessibility overlay — path highlighted, ♿ markers

### Content
- **Barrier-free path of travel** (thick yellow dashed line) from street-level entrance through all amenity floors and dwelling units
- **Two passenger elevators** highlighted in green — redundant accessible means of vertical travel per OBC 3.8.2.1
- **Barrier-free dwelling units** on each residential floor — marked with ♿ icon and unit number (e.g. `"BF-01"`)
- **Accessible washroom** on Commons floor (♿ + `"Accessible Washroom — OBC 3.8.3"`)
- **Areas of refuge** at each stair landing (same yellow markers as Render 2)

### Annotations
- `"Barrier‑free path of travel — AODA/OBC 3.8"`
- `"Redundant accessible vertical travel — OBC 3.8.2.1"`
- `"Barrier‑free dwelling unit — OBC 3.8.4"`
- `"Area of refuge — OBC 3.4.6.12"`
- Per-floor count: `"X of Y dwelling units barrier‑free"`
- Legend box

### Production (Procedural Twin — preferred)
- Add `"barrierFreeMode": true` toggle
- Path rendered as spline curve (TubeGeometry) with yellow translucent material
- ♿ markers via CSS2DRenderer or sprite planes
- Accessible units highlighted by a green overlay box

### Production (Blender — fallback)
- Same cutaway scene as Render 1
- Add spline path (Bezier curve, yellow emission material)
- Add ♿ icon planes (textured with ♿ SVG)
- Camera same as Render 1

---

## 6. ESS Fire-Rated Enclosure Render

**Code References:** OBC Division B 3.1.5 (Hazardous Materials), 3.2.3.7, 3.6.2, CSA C22.1 (CEC Section 64), NFPA 855  
**View:** Close-up isometric of Power & Ops Core (Level 2), 1920×1080  
**Style:** Cutaway isometric — room interior visible, fire-rated boundary hatched

### Content
- **2-hour fire-rated enclosure** (red hatched boundary around the room — diagonal hatch overlay)
- **Battery racks** (dark grey boxes arranged in rack formation)
- **Clean-agent suppression tank** (red cylinder with nozzle symbol)
- **Dedicated ventilation duct** (grey rectangular duct entering/exiting the enclosure)
- **Gas detection sensors** (small circles, one at ceiling, one at return-air grille)
- **Thermal runaway monitoring panel** (wall-mounted box with screen, orange warning stripe)
- Floor drain in corner of room

### Annotations
- `"ESS Fire‑Rated Enclosure — 2 hr FRR (OBC 3.1.5, NFPA 855)"`
- `"Clean‑Agent Suppression"`
- `"Dedicated Ventilation"`
- `"Gas Detection (H₂ / CO) — OBC 3.6.2"`
- `"Thermal Runaway Monitoring Panel"`
- Legend box

### Production (Blender)
- Extend `_blender/f_energy.py` to add:
  - Fire-rated enclosure frame + hatched boundary planes (red emission, transparent)
  - Battery rack array (instanced)
  - Clean-agent tank (cylinder + sphere)
  - Ventilation duct (box geometry)
  - Detection sensor dots (small spheres, `mtl_sensor`)
  - Monitoring panel (flat box with screen material)
- Camera: close-up isometric, `loc=(6, -6, 6)`, orthographic, `scale=4`
- Render with Level 2 slab visible but other floors hidden

---

## Shared Specifications

| Parameter | Value |
|---|---|
| **Resolution** | 1920 × 1080 px (16:9) |
| **Format** | PNG, transparent or dark‑grey (#1a1a1a) background |
| **Colour space** | sRGB |
| **Typeface** | Inter (primary) or Helvetica (fallback) — Regular for labels, Bold for titles |
| **Label style** | White text on semi‑transparent dark pill (`rgba(0,0,0,0.65)`) |
| **Title block** | Top‑left for Renders 1–5, top‑right for Render 6: render name, code reference, date |
| **Grid overlay** | Optional faint 1 m × 1 m grid (`rgba(255,255,255,0.06)`) |
| **Camera consistency** | Renders 1, 2, 5 share the identical camera and tower state |
| **Legend** | Shared colour‑to‑meaning table (see below) in every render |

### Shared Legend

| Colour | Meaning |
|---|---|
| ![#4ade80](https://via.placeholder.com/12/4ade80/000000?text=+) Green | Exit / egress path |
| ![#ef4444](https://via.placeholder.com/12/ef4444/000000?text=+) Red | Fire separation / life safety |
| ![#3b82f6](https://via.placeholder.com/12/3b82f6/000000?text=+) Blue | Potable water / passenger elevators |
| ![#a855f7](https://via.placeholder.com/12/a855f7/000000?text=+) Purple | Non‑potable water (CSA B128) |
| ![#eab308](https://via.placeholder.com/12/eab308/000000?text=+) Yellow | Area of refuge / detection |
| ![#f97316](https://via.placeholder.com/12/f97316/000000?text=+) Orange | ESS / energy systems |
| ![#14b8a6](https://via.placeholder.com/12/14b8a6/000000?text=+) Teal | Group C — Residential |
| ![#a855f7](https://via.placeholder.com/12/d946ef/000000?text=+) Purple | Group D — Business |
| ![#f59e0b](https://via.placeholder.com/12/f59e0b/000000?text=+) Amber | Group F — Industrial / Mechanical |

---

## Implementation Checklist

- [ ] **Render 1 — Occupancy Classification Matrix**
  - [ ] Assign occupancy-group materials per floor
  - [ ] Add red separation bands at group transitions
  - [ ] Camera: front cutaway (18, -32, 28)
  - [ ] Composite: dark background, title block, legend
  - [ ] Export `renders/compliance/01_occupancy_matrix.png`

- [ ] **Render 2 — Means of Egress**
  - [ ] Highlight exit stairs (green), firefighter lift (red), passenger lifts (blue)
  - [ ] Add refuge dots (yellow) at each stair landing
  - [ ] Draw travel-path dashed line
  - [ ] Export `renders/compliance/02_means_of_egress.png`

- [ ] **Render 3 — Fire Separation**
  - [ ] Side cutaway camera (rotated ~90°)
  - [ ] Occupancy blocks coloured, separation lines as thick red bands
  - [ ] Sprinkler riser (blue) + standpipe riser (red)
  - [ ] Fire-alarm/detection zone overlays
  - [ ] Export `renders/compliance/03_fire_separation.png`

- [ ] **Render 4 — Dual-Plumbing & Water System**
  - [ ] Purple non-potable riser from basement to all floors
  - [ ] Blue potable riser from municipal connection
  - [ ] Basement treatment tanks + bulk reservoir
  - [ ] Backflow preventer symbol
  - [ ] Isometric camera, no ground plane
  - [ ] Export `renders/compliance/04_dual_plumbing.png`

- [ ] **Render 5 — Barrier-Free Path**
  - [ ] Barrier-free path (yellow dashed) from entrance through all floors
  - [ ] Passenger elevators highlighted (green) as redundant accessible travel
  - [ ] ♿ markers on barrier-free dwelling units + accessible washroom
  - [ ] Refuge markers (yellow) at stair landings
  - [ ] Same camera as Renders 1 & 2
  - [ ] Export `renders/compliance/05_barrier_free_path.png`

- [ ] **Render 6 — ESS Fire-Rated Enclosure**
  - [ ] Close-up isometric of Level 2 Power & Ops Core
  - [ ] Red hatched 2 hr FRR boundary
  - [ ] Battery racks, clean-agent tank, ventilation duct
  - [ ] Gas detection sensors, thermal monitoring panel
  - [ ] Export `renders/compliance/06_ess_enclosure.png`

- [ ] **Shared assets**
  - [ ] Legend graphic (consistent across all 6 renders)
  - [ ] Title block template
  - [ ] Grid overlay (optional)
  - [ ] Verify all 6 renders at 1920×1080, sRGB, same typeface
