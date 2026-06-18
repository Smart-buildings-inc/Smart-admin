# ATLAS 3D Foundation Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair ATLAS model scale/orientation, glTF hierarchy, Hero integration, lighting, responsive composition, and automated visual/model validation.

**Architecture:** Blender generators produce deterministic app-native Y-up assets with explicit Empty roots. React Three Fiber owns presentation and operational binding. Node and Playwright tests enforce the binary and rendered contracts.

**Tech Stack:** Blender Python 4.5, glTF/GLB, Three.js 0.169, React Three Fiber 9, Next.js 15, TypeScript, Playwright, Sharp.

---

### Task 1: Binary Model Contract

**Files:**
- Create: `scripts/validate-gltf-assets.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the failing GLB validator**

Parse GLB JSON chunks and assert:

```js
assertAsset("public/models/atlas-01.glb", {
  exactNodes: FLOOR_KEYS,
  requiredNodes: ["sys.vertical-transport", "car.a", "car.b", "car.ff"],
  requiredMaterials: NEED_MATERIALS,
  verticalAxis: "Y",
  maxPrimitives: 150,
});
```

For canonical floor files, assert existence and valid bounds. Report byte-identical program aliases as warnings so the later artistic-detail pass has an explicit queue without blocking this foundation repair.

- [ ] **Step 2: Verify the validator fails**

Run:

```bash
npm run validate:gltf
```

Expected: failure for missing exact floor roots, incorrect Hero vertical axis, and excessive Hero primitives. Duplicate canonical programs are reported as warnings.

- [ ] **Step 3: Add validation to CI and verification scripts**

Add `validate:gltf` and run it in the `models` CI job before the source mapping validators.

- [ ] **Step 4: Re-run after asset work**

Expected: all committed GLBs satisfy the binary contract.

### Task 2: Blender Generators and Assets

**Files:**
- Modify: `scripts/blender/build_atlas01.py`
- Modify: `_blender/build_atlas_floors.py`
- Modify: `public/models/*.glb`

- [ ] **Step 1: Preserve the failing validator evidence**

Do not alter validator expectations to match broken assets.

- [ ] **Step 2: Correct floor-module box dimensions**

Use requested dimensions directly for Blender size-1 cubes:

```python
o.scale = (size[0], size[1], size[2])
```

Keep all call sites consistent with full dimensions.

- [ ] **Step 3: Export Hero geometry in app-native Y-up coordinates**

Keep generator coordinates as X/Y/Z app coordinates and disable exporter axis conversion:

```python
export_yup=False
```

Remove fallback export paths that silently restore incompatible conversion.

- [ ] **Step 4: Add explicit hierarchy roots**

Each generated collection receives an Empty root. Meshes are parented to that root. Elevator cars are parented under `sys.vertical-transport` and named exactly:

```python
"car.a"
"car.b"
"car.ff"
```

- [ ] **Step 5: Reduce primitive fragmentation**

Join static shell meshes by floor/material where interaction does not require individual objects. Preserve front-wall and emissive meshes as addressable children.

- [ ] **Step 6: Regenerate GLBs**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/build_atlas01.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python _blender/build_atlas_floors.py
```

- [ ] **Step 7: Run the GLB validator**

Run `npm run validate:gltf`. Expected: pass.

### Task 3: Hero Runtime Binding

**Files:**
- Modify: `src/components/GltfBuilding.tsx`
- Modify: `src/components/BuildingSimulator.tsx`

- [ ] **Step 1: Add failing Hero interaction checks**

Playwright must assert that Hero mode remains visually nonblank and changes pixels when Cut-away or floor selection changes.

- [ ] **Step 2: Pass operational state into Hero**

Provide floors, incidents, selected floor, cutaway state, elevator floor, and selection callback.

- [ ] **Step 3: Bind exact roots and material names**

Use exact floor root lookup and materials beginning with `mat.need.`. Clone materials before runtime mutation.

- [ ] **Step 4: Apply operational transforms**

Hide `*.shell.front` in cutaway mode, animate `car.*`, pulse incident materials, and raycast floor roots for selection.

- [ ] **Step 5: Run focused Playwright tests**

Run:

```bash
npm run test:e2e -- e2e/simulator.spec.ts
```

Expected: Hero interaction checks pass across all configured projects.

### Task 4: Lighting and Responsive Composition

**Files:**
- Create: `src/lib/simulator-camera.ts`
- Modify: `src/components/three/MainHdrEnvironment.tsx`
- Modify: `src/components/BuildingSimulator.tsx`
- Modify: `src/components/simulator/BuildingMood.tsx`
- Modify: `src/components/simulator/SolarAnimator.tsx`
- Modify: `src/components/SimulatorView.tsx`

- [ ] **Step 1: Add failing rendered-pixel checks**

Use Sharp to calculate stage luminance statistics. Assert day, night, and Hero screenshots have:

```ts
standardDeviation > 12
brightPixelRatio < 0.82
darkPixelRatio < 0.94
```

- [ ] **Step 2: Add deterministic renderer color management**

Configure ACES filmic tone mapping, sRGB output, and controlled exposure through the renderer creation callback.

- [ ] **Step 3: Load EXR without half-float overflow**

Use float EXR data for PMREM and reduce environment intensity to a balanced range.

- [ ] **Step 4: Establish one lighting authority**

Solar time controls sun/background. Mood applies bounded multipliers rather than overwriting day/night values.

- [ ] **Step 5: Add aspect-aware camera fitting**

`simulatorCameraForViewport(width, height, totalHeight)` returns camera position, FOV, min/max distance, and target for landscape, tablet, and portrait layouts.

- [ ] **Step 6: Make the embedded stage responsive**

Replace the fixed 1040px mobile height with viewport-bounded responsive heights and enlarge touch controls.

- [ ] **Step 7: Run pixel and interaction tests**

Expected: all luminance, framing, and control checks pass on desktop, tablet, and phone.

### Task 5: Verification, Documentation, and Delivery

**Files:**
- Modify: `e2e/simulator.spec.ts`
- Modify: `public/models/README.md`
- Modify: `public/models/CREDITS.md`
- Create: `/Users/elijahroyaei/Desktop/AOS/ATLAS 3D Foundation Repair.md`

- [ ] **Step 1: Run focused validation**

```bash
npm run validate:gltf
npm run validate:models
npm run validate:blender
npm run test:e2e -- e2e/simulator.spec.ts
```

- [ ] **Step 2: Run repository gates**

```bash
npm run typecheck
npm run lint
npm run build
npm run verify
```

- [ ] **Step 3: Inspect fresh screenshots**

Review desktop, tablet, and phone screenshots in day, night, and Hero modes. Confirm no blank, clipped, white, or black canvas.

- [ ] **Step 4: Update documentation and Obsidian**

Record the coordinate contract, generator commands, validation contract, known remaining artistic work, and verification evidence.

- [ ] **Step 5: Commit and push**

Create focused commits, confirm a clean worktree, and push `main` to `origin`.
