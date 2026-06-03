"use client";

// A lightweight, stylized human guide figure for the Habitat Twin's "realistic"
// (non-pixel) mode. Rendered inside the R3F <Canvas> beside the tower as a scale
// reference / mascot.
//
// Reconstructed as a self-contained procedural humanoid (no glTF binary), so it
// always renders and never blanks the canvas — matching the app's procedural,
// flat-shaded aesthetic. The original asset-backed component was lost from git
// history; this restores the `HabitatTwin` import contract:
//   <HumanCharacter position color height rotationY variant />

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Vec3 = [number, number, number];

export interface HumanCharacterProps {
  /** World position of the figure's feet. */
  position?: Vec3;
  /** Accent colour (hi-vis vest / hard hat). */
  color?: string;
  /** Total height in world units (feet → top of head). */
  height?: number;
  /** Y rotation (radians) so the figure faces the camera. */
  rotationY?: number;
  /** Cosmetic variant; "engineer" adds a hard hat. */
  variant?: "engineer" | "resident" | string;
}

const SKIN = "#caa17a";
const BODY = "#2a3340";

export default function HumanCharacter({
  position = [0, 0, 0],
  color = "#7fe7e0",
  height = 1.3,
  rotationY = 0,
  variant = "engineer",
}: HumanCharacterProps) {
  const group = useRef<THREE.Group>(null);

  // The proportions below are authored for a 1.0-unit-tall figure, then scaled
  // uniformly to `height`. A subtle idle bob + sway keeps it alive.
  useFrame((s) => {
    const g = group.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.position.y = position[1] + Math.sin(t * 1.4) * 0.015 * height;
    g.rotation.y = rotationY + Math.sin(t * 0.6) * 0.05;
  });

  const k = height; // unit → world scale

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[k, k, k]}
    >
      {/* legs */}
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]} castShadow>
          <boxGeometry args={[0.16, 0.44, 0.18]} />
          <meshStandardMaterial color={BODY} flatShading />
        </mesh>
      ))}
      {/* torso / hi-vis vest in the accent colour */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.4, 0.42, 0.22]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0.001]}>
        <boxGeometry args={[0.18, 0.42, 0.23]} />
        <meshStandardMaterial color={BODY} flatShading />
      </mesh>
      {/* arms */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.62, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.14]} />
          <meshStandardMaterial color={BODY} flatShading />
        </mesh>
      ))}
      {/* hands */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]}>
          <boxGeometry args={[0.12, 0.1, 0.14]} />
          <meshStandardMaterial color={SKIN} flatShading />
        </mesh>
      ))}
      {/* head */}
      <mesh position={[0, 0.93, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color={SKIN} flatShading />
      </mesh>
      {/* engineer hard hat in the accent colour */}
      {variant === "engineer" && (
        <>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.24, 0.08, 0.24]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          <mesh position={[0, 1.11, 0]}>
            <boxGeometry args={[0.14, 0.06, 0.14]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
        </>
      )}
    </group>
  );
}
