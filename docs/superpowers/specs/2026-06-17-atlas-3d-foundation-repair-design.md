# ATLAS 3D Foundation Repair Design

## Objective

Repair the highest-impact technical defects in the ATLAS simulator before adding more artistic detail. The result must render a legible architectural twin in procedural and Hero modes on desktop, tablet, and phone.

## Scope

This pass includes:

- one consistent app-space coordinate contract for generated GLBs;
- correct floor-module dimensions;
- explicit glTF floor, system, and movable-object hierarchy;
- Hero telemetry/material binding that matches exported names;
- stable HDR/tone-mapped lighting without white or black frames;
- responsive camera fitting and touch-safe stage layout;
- binary asset validation and pixel-based Playwright regression checks;
- regenerated committed GLBs.

This pass does not include photorealistic texture authoring, full character skeletal animation, construction-document accuracy, or redesigning every floor interior. Those depend on the repaired foundation.

## Architecture

The Blender generators remain the source of geometry. They export app-native Y-up GLBs and explicit Empty roots for floors and systems. A Node validator parses the committed GLBs and enforces bounds, hierarchy, material names, file presence, draw-call budgets, and duplicate canonical assets.

The React Three Fiber renderer owns lighting, camera behavior, telemetry, and animation. Hero mode receives the same operational state as the procedural model. Tone mapping, environment intensity, and responsive camera fitting are deterministic and covered by Playwright image statistics.

## Asset Contract

- App coordinates: X width, Y height, Z depth.
- Hero bounds must have a vertical Y extent greater than 15 app units.
- Every canonical floor has an exact root node matching `Floor.key`.
- System roots use `sys.*`.
- Elevator cars use `car.a`, `car.b`, and `car.ff`.
- Need materials use `mat.need.<need>`.
- Floor-module shell dimensions must contain their wall positions rather than leaving detached walls.

## Runtime Behavior

- Hero mode supports cutaway, floor selection, incident emissive state, and elevator motion.
- Day/night and time-of-day share one lighting authority.
- HDR loading must not emit half-float overflow warnings.
- Desktop, tablet, and phone receive aspect-aware camera distance and stage height.
- The canvas must retain measurable luminance variance in day and night modes.

## Testing

1. Run the new GLB validator against the current assets and confirm failure.
2. Correct generators and regenerate assets until validation passes.
3. Add Playwright checks for nonblank/non-clipped day, night, and Hero canvases.
4. Confirm those checks fail against the current renderer before implementing fixes.
5. Run model validation, typecheck, lint, build, focused simulator Playwright tests, then the full verification gate.

## Delivery

Changes are implemented in parallel across:

- Blender generation and exported assets;
- R3F presentation and Hero integration;
- model validation and visual regression tests.

The main agent reviews and integrates each stream, updates the AOS Obsidian vault, commits focused changes, and pushes `main`.
