# ATLAS-01 — Blender 3D Model Spec & Migration Brief

> **Status / honest framing.** Today the twin (`src/components/BuildingSimulator.tsx`,
> ~1,700 lines) is **procedural architectural geometry authored directly in three.js** — there are
> no required Blender or glTF assets in the repo, by design (see `CLAUDE.md`). This document is the
> brief for (1) the **geometry changes** the right-sized, permittable design demands
> (`docs/ATLAS-derisking-plan.md`), and (2) a **Blender → glTF (.glb)** asset that slots into
> the existing React-Three-Fiber pipeline. We **cannot run Blender in CI**, so the `.blend`
> source and exported `.glb` are committed binaries (use **Git LFS**).
>
> **Recommended strategy — hybrid, not replacement.** Keep the procedural architectural scene as the
> **live ops twin** (cheap, data-bound, deterministic, local-first). Author a Blender
> **"hero" `.glb`** for the marketing/walk-through and the `/simulate/atlas-01` viewer, loaded
> behind the existing `source: "voxel" | "gltf"` switch (`"voxel"` is the legacy enum
> value for the procedural tower). This preserves the "the cloud/hardware is an
> optimization, never a dependency" ethos while giving us an archviz-grade asset when we want it.
> This is a schematic massing model for visualization — **not** construction documents.

---

## 0a. Generated build (working — ships in the repo)

A reproducible Blender build of this spec exists and is wired in:

```bash
pip install bpy                         # Blender 5.x as a Python module (Py 3.11)
python3 scripts/blender/build_atlas01.py   # → public/models/atlas-01.glb
```

`scripts/blender/build_atlas01.py` procedurally generates the right-sized tower
(basement reservoir, pool-only roof, dual passenger elevators + a firefighter
car, two stair cores, ESS room, per-need emissive accents) using boxes + Array
modifiers + a 1-segment bevel, names every floor collection by `Floor.key`, and
exports `public/models/atlas-01.glb` — **~6.2k triangles, ~0.5 MB**, no textures,
no Draco (so no decoder needed). Flip the **"Hero"** toggle in the simulator /
fullscreen viewer to load it (falls back to the procedural twin on any error). Re-run
the script to regenerate after editing geometry. The sections below are the full
authoring reference for hand-modelling or extending it.

## 1. Coordinate system, scale & origin (must match the app)

The R3F scene is **Y-up, metric, origin at grade centre**. Match these exactly so a `.glb`
can replace procedural geometry with zero re-fitting:

| App constant | Value | Meaning |
|---|---|---|
| `FLOOR_H` | `1.5` | interior clear height (model units) |
| `SLAB_T` | `0.16` | slab thickness |
| `STEP` | `1.66` | vertical pitch per floor (`FLOOR_H + SLAB_T`) |
| `HALF_W` | `5` | half-width → footprint **10** on X (−5..5) |
| `HALF_D` | `3.5` | half-depth → footprint **7** on Z (−3.5..3.5) |
| `CORE_X / CORE_Z` | `3.4 / -1.9` | passenger elevator core A centre (+X side) |
| `CORE_Z2` | `-0.1` | elevator car B shaft (`CORE_Z + 1.8`) |
| `STAIR_X` | `-3.5` | exit-stair core centre (−X side) |
| floor `i` base Y | `i * STEP` | level `i` (0 = basement −1 … 12 = roof) |

> **Blender is Z-up; glTF export converts to Y-up** (`+Y Up ✓`). Model in Blender Z-up; the
> exporter handles the swap. Keep **1 Blender metre = 1 app unit** (the model is stylized: the
> "real" tower is larger, but the twin reads as ~10 × 7 × 21.6 m). If you prefer true scale
> (e.g. a 28 × 20 m floorplate), model real and apply a uniform scale on import — but matching
> the constants above is the zero-friction path.

Set each floor collection's **origin (pivot) at its slab-centre** `(0, i*STEP, 0)` so the app
can address floors by transform, and bake transforms before export (`Apply Modifiers ✓`).

---

## 2. Scene organization, collections & naming convention

The binding contract: **collection / root-node name === `Floor.key`.** The loader indexes glTF
nodes by name and binds telemetry automatically (emissive accent, incident pulse, presence heat).

```
ATLAS-01 (root empty, name "atlas-01")
├─ reclamation-core      (level -1)   ┐
├─ commons-clinic        (level  1)   │  one collection per floor,
├─ power-ops-core        (level  2)   │  named EXACTLY by Floor.key
├─ aquaponics-bay        (level  3)   │
├─ vertical-farm         (level  4)   │
├─ residences-a..d       (5..8)       │
├─ the-lung              (level  9)   │
├─ penthouses            (level 10)   │
├─ skydeck-reservoir     (level 11)   ┘  (pool only — see §3)
├─ sys.vertical-transport   (elevators A/B + firefighter car + 2 stairs)
├─ sys.egress-lifesafety    (pressurized stairs, standpipe, exit signage, refuge)
├─ sys.water                (dual-plumbing purple + potable risers, backflow)
├─ sys.energy               (ESS fire-rated room, PV, inverters, main bus)
├─ sys.hvac                 (AHUs, ducts, the-lung biofilter)
├─ sys.presence             (RuView ESP32 nodes — wall pucks, NO cameras)
└─ env (ground plane, context, not exported or exported as `env.*`)
```

Within each floor collection use sub-meshes with **stable suffixes** the loader can target:
`*.shell` (slab + 3 solid walls), `*.shell.front` (the cut-away wall — hidden in cut-away
mode), `*.interior`, `*.emissive` (the need-accent mesh that pulses on incident),
`*.dwelling.NN` (residential partitions), `*.glass`.

**Material names** (so the app can find/override them):
`mat.need.<need>` (emissive accent), `mat.glass.cutaway`, `mat.metal`, `mat.concrete`,
`mat.purple.nonpotable` (CSA B128), `mat.signal.crit/warn/ok`.

---

## 3. Per-level modeling brief (all 13 levels)

Need-accent hexes (keep in sync with `src/lib/ui.ts`): water `#3aa0ff`, energy `#ffcf4d`,
food `#5ddc7a`, shelter `#c0a4ff`, air `#7fe7e0`, health `#ff8fb1`, restoration `#ffd9a0`.

| Lvl | `key` | Occupancy/Use | Model (geometry + right-sized changes) | Poly budget* |
|----|-------|---------------|----------------------------------------|------|
| −1 | `reclamation-core` | F / mechanical | **Bulk reservoir cistern** (relocated to basement — Flaw 7), 3 greywater/rainwater **treatment tanks**, pump skid, **dual-plumbing manifold** (purple non-potable + separate potable, with a visible **backflow preventer**). Already in the procedural simulator; refine as tanks + pipe runs. | 6–10k |
| 1 | `commons-clinic` | D / business | Commons seating + **telehealth booth** (screen, not clinical bays — avoids Group B), **first-aid** alcove, **accessible WC** (barrier-free turning circle), reception. | 6–9k |
| 2 | `power-ops-core` | F / mechanical | **ESS room as a fire-rated enclosure** (2-hr walls, vented louvers, clean-agent/deluge head — Flaw 8) instead of an open battery wall; inverter cabinets, main bus, ops desk with screens. | 6–10k |
| 3 | `aquaponics-bay` | F / amenity | Fish tanks + biofilter loop, **wet-location electrical** fittings (drip loops, sealed conduit), floor drains. Amenity scale (not commercial). | 5–8k |
| 4 | `vertical-farm` | F / amenity | Tiered grow racks + magenta grow-light bars (keep emissive flicker procedural), **dedicated exhaust duct** to riser, **humidity-separation** wall to the residences slab above. | 6–10k |
| 5–8 | `residences-a..d` | C / residential | **Dwelling partitions matching the data**: A/B = 14 units, C/D = 12 units; show **beds** (A/B 30, C/D 28). Corridor + unit doors; balcony reveals on `*.shell.front`. | 7–11k each |
| 9 | `the-lung` | F / mechanical | AHUs, large **biofilter green-wall / tree**, supply/return ducts, **airtight separation** detail to residences. Keep the breathing-tree shader procedural. | 6–9k |
| 10 | `penthouses` | C / residential | 12 premium dwellings, double-height glazing, soffit to the Skydeck above. | 9–12k |
| 11 | `skydeck-reservoir` | C / amenity | **POOL ONLY** (Flaw 7 — bulk reservoir removed from roof), pool coping + shimmer surface (procedural), pergola, **PV array** on the structural roof, parapet + fall protection. | 6–9k |

\* Triangle budget per floor for the **live** target; the hero asset can run ~2× richer.

**Cross-cutting vertical systems (model once, span the stack):**

- **Vertical transport** — three cars now: **Elevator A** (`x 3.4, z −1.9`), **Elevator B**
  (`z −0.1`, dual redundancy/accessibility — Flaw 5), and a **dedicated firefighter elevator**
  (3rd car, its own protected lobby — OBC 3.2.6). Model glass shafts + guide rails; provide
  **named car nodes** (`car.a`, `car.b`, `car.ff`) so R3F drives motion (don't bake animation).
- **Two pressurized exit stairs** (Flaw 5/6) — the existing single switchback at `x −3.5`
  plus a **second remote scissor stair**; add **pressurization vestibules** and **areas of
  refuge** at each landing (barrier-free).
- **Sprinkler/standpipe risers** + **dual-plumbing purple (non-potable) riser** beside the
  potable riser (CSA B128, cross-connection control) — thin emissive pipes the water-layer
  toggle can highlight.
- **RuView presence nodes** (`sys.presence`) — small ESP32 wall pucks, one or two per floor,
  explicitly **no cameras**; this visualizes the WiFi-CSI sensing layer (`/api/presence`).

---

## 4. Building-systems overlays (map to app layers)

Author each as a **toggleable collection** so the UI can show/hide it (mirrors the existing
Cut-away / layer toggles and the compliance/telemetry model):

- `sys.water` → non-potable (purple) vs potable risers, basement reservoir + tanks, backflow.
- `sys.energy` → ESS fire room, PV roof array, inverters, main bus.
- `sys.hvac` → AHUs + ducts + the-lung biofilter.
- `sys.egress-lifesafety` → 2 stairs, firefighter elevator + lobby, standpipe, exit signage, refuge areas.
- `sys.presence` → RuView nodes.

These overlays are exactly the right-sized story the `BuildingCompliance` model surfaces in
the Fleet panel — now made visible in 3D.

---

## 5. Materials & shading

- **PBR base, stylized** — flat-ish metal/concrete/glass; don't chase photoreal.
- **Emissive need-accent** mesh per floor (`mat.need.<need>`, emissive = the hex above). The
  app drives its intensity (idle glow; **pulse on active incident**, reusing `FloorBlock` /
  `PulseVox` logic; warmer/occupancy heat from `/api/presence`).
- **`mat.glass.cutaway`** on `*.shell.front` so the cut-away toggle can hide/fade the front wall.
- **`mat.purple.nonpotable`** for the CSA B128 riser (a literal "purple pipe").
- Optionally **bake AO** to a small atlas; keep **vertex colors** to preserve the procedural
  simulator's accent language if we want a stylized hero rather than full archviz.
- Keep **animated shaders procedural** (pool shimmer, grow-light flicker, lung breathing,
  elevator motion) — do **not** bake these; they stay in R3F.

---

## 6. Performance budget

| Target | Triangles | Draw calls | `.glb` size | Textures |
|---|---|---|---|---|
| **Live twin** (mobile-first) | ≤ 60k | ≤ 80 | ≤ 2.5 MB | 1× 1–2k atlas |
| **Hero / viewer** | ≤ 150k | ≤ 150 | ≤ 5 MB | 2–4× 2k, WebP |

- **Instance** repeated props: residents, PV panels, grow trays, dwelling doors, stair treads,
  RuView pucks (glTF `EXT_mesh_gpu_instancing` / drei `<Instances>`).
- **LODs**: LOD0 (hero), LOD1 (−50% for fleet thumbnails), LOD2 (massing block).
- **Compression**: Draco (`position 14, normal 10, texcoord 12`) **or** meshopt; WebP textures.

---

## 7. glTF export settings (exact, Blender 4.x)

`File ▸ Export ▸ glTF 2.0 (.glb)`:
- **Format:** glTF Binary `.glb`. **Include:** Visible Objects (or Selected). **+Y Up ✓.**
- **Transform:** Apply Modifiers ✓.
- **Geometry:** UVs ✓, Normals ✓, Tangents ✓ (only if normal maps), Vertex Colors ✓, Loose
  edges/points ✗.
- **Materials:** Export; Images = WebP (or Auto). 
- **Compression:** Draco ✓ (settings above) — *or* run `gltfpack -cc` (meshopt) post-export.
- **Animation:** export **only** if baking elevator clips (recommended: leave off, drive in R3F).
- **Lighting/Cameras:** Punctual Lights ✗, Cameras ✗ (the app owns lights + camera).
- **Names:** keep object/collection names (the binding contract in §2) — don't let "apply
  transform" rename nodes.
- **Validate** with the Khronos glTF-Validator before committing.

---

## 8. App integration plan (React-Three-Fiber)

1. **Asset path:** `public/models/atlas-01.glb` (+ Draco decoder at `public/draco/` or a pinned
   CDN). `.glb`/`.blend` tracked via **Git LFS**.
2. **Loader:** `@react-three/drei` `useGLTF("/models/atlas-01.glb")` with a `DRACOLoader`
   (`gltf.dracoLoader`), wrapped in `<Suspense>`; `useGLTF.preload(...)`. `next.config.mjs`
   already transpiles `three`; `/public` is served statically, so no bundler change needed.
3. **Model-source switch:** keep `source: "voxel" | "gltf"` in `SimOptions` (and/or
   `NEXT_PUBLIC_TWIN_MODEL`). **Default `"voxel"` means the procedural architectural tower**
   (local-first, no asset dependency); `gltf`
   loads the hero. The `/simulate/atlas-01` viewer is the natural first consumer.
4. **Telemetry binding:** traverse the scene once, build `Map<floor.key, Object3D>`; for each,
   set `mat.need.<need>` emissive = `needColor[floor.need]`, **pulse on active incident**, and
   tint `*.dwelling.NN` / floor by `/api/presence` occupancy. Reuse the existing select / hover
   / `onSelect` handlers by raycasting against the named floor nodes.
5. **Cut-away:** hide/fade `*.shell.front` (or a clipping plane per floor) on the existing
   Cut-away toggle.
6. **Elevators:** bind `car.a / car.b / car.ff` nodes to the current elevator logic
   (`onElevatorArrive` etc.) — geometry from Blender, motion from R3F.
7. **Fleet/LOD:** use LOD1/2 for fleet thumbnails to keep the map cheap.

---

## 9. Workflow & QA checklist

- [ ] Source `.blend` at `assets/blender/atlas-01.blend` (Git LFS); export to `public/models/atlas-01.glb`.
- [ ] Collection/node names === `Floor.key`; material names per §2.
- [ ] +Y up, transforms applied, scale matches §1 constants.
- [ ] glTF-Validator clean; Draco/meshopt applied; `.glb` within §6 budget.
- [ ] Loads in `/simulate/atlas-01` behind `source: "gltf"`; procedural architectural tower remains default + fallback.
- [ ] Telemetry binding verified (emissive accent, incident pulse, presence heat).
- [ ] Cut-away, dual + firefighter elevators, two stairs all read correctly.
- [ ] Mobile perf check (Pixel 5): ≥ 30 fps, draw calls within budget.
- [ ] Visual diff vs procedural architectural tower; e2e simulator tests still green.

---

## 10. Disclaimer

This is a **schematic massing/visualization model**, not a set of construction documents or a
code-compliance submission. Elevator counts, stair pressurization, fire separations, barrier-free
provisions, ESS enclosure, and CSA B128 dual-plumbing shown here are **design intent** to be
confirmed with the project architect and engineers against the OBC/NBC and the MECP path in
`docs/ATLAS-derisking-plan.md`.
