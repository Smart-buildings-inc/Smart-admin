// Poly-modeling helpers for the 3D twin.
//
// These reproduce a few common DCC ("Blender-style") modelling operations as
// reusable three.js BufferGeometries so the realistic Habitat Twin reads less
// like a stack of raw primitives and more like fabricated architecture:
//
//   • CHAMFER  — a flat 45° cut along the top/bottom edges of a box (a hard
//                bevel with a single segment). Catches a rim of light.
//   • BEVEL    — same machinery with more segments → a rounded edge.
//   • FILLET   — rounding of the four *vertical* corners of the footprint.
//   • EXTRUDE  — sweeping a 2D profile into a solid (used by all of the above
//                via THREE.ExtrudeGeometry, and exposed directly for trims).
//
// Everything is centred on the origin and oriented with height along +Y so the
// results drop in as a replacement for boxGeometry args [width, height, depth].

import * as THREE from "three";

export interface ChamferedBoxOptions {
  /** Fillet radius applied to the four vertical corners of the footprint. */
  cornerRadius?: number;
  /** How far the top/bottom edge is cut, both inward and vertically. */
  edge?: number;
  /**
   * Segments across the top/bottom edge. 1 → a flat chamfer; higher → a
   * smoothly rounded bevel.
   */
  edgeSegments?: number;
  /** Smoothness of the vertical-corner fillet. */
  cornerSegments?: number;
}

/** Rounded-rectangle profile centred on the origin in the XY plane. */
function roundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.max(0, Math.min(radius, w - 1e-4, d - 1e-4));
  const s = new THREE.Shape();
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  return s;
}

/**
 * A box with chamfered (or rounded-bevel) top/bottom edges and optionally
 * filleted vertical corners. Drop-in replacement for boxGeometry, centred with
 * height along +Y. Built by extruding a rounded-rect profile with a bevel.
 */
export function createChamferedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  {
    cornerRadius = 0,
    edge = 0.06,
    edgeSegments = 1,
    cornerSegments = 4,
  }: ChamferedBoxOptions = {},
): THREE.ExtrudeGeometry {
  const e = Math.max(0, Math.min(edge, height / 2 - 1e-4, width / 2 - 1e-4, depth / 2 - 1e-4));
  const shape = roundedRectShape(width, depth, cornerRadius);

  const geom = new THREE.ExtrudeGeometry(shape, {
    // The bevel adds `e` to each end, so the straight section is shortened to
    // keep the overall height exact.
    depth: height - 2 * e,
    bevelEnabled: e > 0,
    bevelThickness: e,
    bevelSize: e,
    bevelSegments: Math.max(1, edgeSegments),
    curveSegments: cornerSegments,
    steps: 1,
  });

  // Extrude runs along +Z from z=0; stand it up (height → +Y) and centre it.
  geom.rotateX(-Math.PI / 2);
  geom.center();
  return geom;
}

/**
 * Extrude a 2D profile into a centred solid with a beveled rim, oriented with
 * its swept thickness along +Y. Handy for trims, caps, and plinths.
 */
export function createBeveledExtrusion(
  shape: THREE.Shape,
  thickness: number,
  bevel = 0.04,
  bevelSegments = 1,
): THREE.ExtrudeGeometry {
  const b = Math.max(0, Math.min(bevel, thickness / 2 - 1e-4));
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: Math.max(1, bevelSegments),
    steps: 1,
  });
  geom.rotateX(-Math.PI / 2);
  geom.center();
  return geom;
}
