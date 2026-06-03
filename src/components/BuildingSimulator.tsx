"use client";

// F12 — Building Simulator.
//
// A live, "operating" voxel/pixel-art rendering of ATLAS-01: the full floor
// stack as a cut-away dollhouse with detailed per-floor interiors, a working
// elevator car that travels the shaft, a switchback staircase, rooftop solar +
// reservoir, and little voxel residents going about their day. Everything is
// blocky and flat-shaded on purpose — that's the ATLAS pixel branding. Blender
// isn't available in this headless environment, so the geometry is authored
// procedurally in three.js / @react-three/fiber.
//
// This file is the WebGL layer only; SimulatorView.tsx owns the DOM chrome
// (header, controls, legend, telemetry) and feeds options/selection in.

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Incident, Need } from "@/lib/types";
import { needColor } from "@/lib/ui";
import AsciiRenderer from "@/components/AsciiRenderer";
import GltfBuilding from "@/components/GltfBuilding";
import { getModel } from "@/lib/models";
import {
  GltfProp,
  ModelErrorBoundary,
  preloadModel,
  useNormalizedClone,
} from "@/components/three/gltf";

const RESIDENT = getModel("resident");
// Warm the resident asset so detailed residents stream in without pop-in.
preloadModel("resident");

type Vec3 = [number, number, number];

// --- layout constants (world units) ---------------------------------------
const FLOOR_H = 1.5; // interior clear height
const SLAB_T = 0.16; // floor slab thickness
const STEP = FLOOR_H + SLAB_T; // vertical pitch per floor
const HALF_W = 5; // building half-width  (x: -5..5)
const HALF_D = 3.5; // building half-depth  (z: -3.5..3.5)
const CORE_X = 3.4; // elevator core centre on +x
const CORE_Z = -1.9;
const STAIR_X = -3.5; // stair core centre on -x
const CAR_H = FLOOR_H * 0.86;

export interface SimOptions {
  night: boolean;
  cutaway: boolean;
  autoRotate: boolean;
  elevatorRunning: boolean;
  /** Use detailed glTF residents (else the flat-shaded voxel figures). */
  detailedModels: boolean;
  /**
   * Which building model to render: the procedural "voxel" twin (default) or a
   * Blender-authored "gltf" hero asset. The gltf path falls back to voxel when
   * no asset is installed. See docs/ATLAS-blender-model-spec.md.
   */
  source?: "voxel" | "gltf";
}

// --------------------------------------------------------------------------
// Low-level voxel primitive: a flat-shaded box. The whole scene is built from
// these so it reads as chunky pixel art.
// --------------------------------------------------------------------------
function Vox({
  position,
  size,
  color,
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
  metalness = 0.05,
  roughness = 0.85,
  onClick,
  onPointerOver,
  onPointerOut,
  visible = true,
}: {
  position: Vec3;
  size: Vec3;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  visible?: boolean;
}) {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      visible={visible}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color ?? "#ffffff"}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
        metalness={metalness}
        roughness={roughness}
        flatShading
      />
    </mesh>
  );
}

// A box whose emissive pulses — for grow-lights, server blinks, water shimmer.
function PulseVox({
  position,
  size,
  color,
  emissive,
  base = 0.3,
  amp = 0.4,
  speed = 2,
  phase = 0,
  opacity = 1,
}: {
  position: Vec3;
  size: Vec3;
  color: string;
  emissive?: string;
  base?: number;
  amp?: number;
  speed?: number;
  phase?: number;
  opacity?: number;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (mat.current) {
      mat.current.emissiveIntensity =
        base + amp * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * speed + phase));
    }
  });
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={base}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.6}
        flatShading
      />
    </mesh>
  );
}

// --------------------------------------------------------------------------
// A tiny voxel resident: legs + torso + head, gently bobbing (and on resident
// floors, pacing along the floor).
// --------------------------------------------------------------------------
function VoxPerson({
  position,
  color,
  pace = 0,
}: {
  position: Vec3;
  color: string;
  pace?: number;
}) {
  const g = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] + position[2], [position]);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime;
    g.current.position.y = position[1] + Math.abs(Math.sin(t * 3 + phase)) * 0.05;
    if (pace > 0) {
      g.current.position.x = position[0] + Math.sin(t * 0.6 + phase) * pace;
      g.current.rotation.y = Math.cos(t * 0.6 + phase) > 0 ? 0.4 : -0.4;
    }
  });
  return (
    <group ref={g} position={position}>
      <Vox position={[0, 0.12, 0]} size={[0.18, 0.24, 0.14]} color="#2c3a47" />
      <Vox position={[0, 0.36, 0]} size={[0.22, 0.26, 0.16]} color={color} />
      <Vox position={[0, 0.56, 0]} size={[0.15, 0.15, 0.15]} color="#f1c9a5" />
    </group>
  );
}

// A detailed, rigged glTF resident (RobotExpressive, CC0). Each instance gets
// its own skeleton clone + animation mixer so they move independently. Paces
// along the floor like VoxPerson and plays a walk/idle clip.
function RobotResident({
  position,
  pace = 0,
  height = RESIDENT.targetHeight,
  rotationY = 0,
}: {
  position: Vec3;
  pace?: number;
  height?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(RESIDENT.path);
  const obj = useNormalizedClone(scene, height);
  const group = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] + position[2], [position]);

  // Cheap, reliable life: a gentle bob, plus pacing along the floor. (We render
  // the bind pose rather than skeletal animation — see useNormalizedClone.)
  useFrame((s) => {
    if (!group.current) return;
    const t = s.clock.elapsedTime;
    group.current.position.y = position[1] + Math.abs(Math.sin(t * 2 + phase)) * 0.04;
    if (pace > 0) {
      group.current.position.x = position[0] + Math.sin(t * 0.6 + phase) * pace;
      group.current.rotation.y =
        (Math.cos(t * 0.6 + phase) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + rotationY;
    }
  });

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={obj} />
    </group>
  );
}

// Chooses a detailed resident when enabled, otherwise the voxel figure. The
// voxel figure is also the Suspense/error fallback, so residents always render.
// `height` lets a placement (e.g. the plaza greeter) render a larger figure.
function SimPerson({
  position,
  color,
  pace = 0,
  detailed,
  height = RESIDENT.targetHeight,
  rotationY,
}: {
  position: Vec3;
  color: string;
  pace?: number;
  detailed: boolean;
  height?: number;
  rotationY?: number;
}) {
  const voxScale = height / 0.6; // voxel figure is ~0.6 units tall
  const fallback = (
    <group position={position} scale={voxScale}>
      <VoxPerson position={[0, 0, 0]} color={color} pace={pace / voxScale} />
    </group>
  );
  if (!detailed || !RESIDENT.enabled) return fallback;
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <RobotResident
          position={position}
          pace={pace}
          height={height}
          rotationY={rotationY}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}

// --------------------------------------------------------------------------
// Per-need interior recipes. Each renders furniture/equipment for one floor,
// authored relative to the floor's slab top (y = 0) within the living zone
// (x in [-2.2, 2.2], z in [-2.6, 2.6]).
// --------------------------------------------------------------------------
function FloorInterior({
  floor,
  accent,
  night,
  detailed,
}: {
  floor: Floor;
  accent: string;
  night: boolean;
  detailed: boolean;
}) {
  switch (floor.need) {
    case "water":
      // Reclamation Core (basement / floor −1): bulk water reservoir relocated
      // here per ATLAS-derisking-plan.md §Flaw 7 (structurally trivial at grade,
      // vs. 150 t+ on the roof). Large cistern + greywater/rainwater tanks +
      // pipe runs + pump skid.
      return (
        <group>
          {/* Bulk reservoir — large cistern spanning the back wall.
              Right-sized geometry: relocated from rooftop to basement. */}
          <Vox position={[0, 0.55, -1.9]} size={[3.6, 1.1, 0.6]} color="#1a3d52" />
          <PulseVox
            position={[0, 0.72, -1.9]}
            size={[3.58, 0.5, 0.62]}
            color={accent}
            emissive={accent}
            base={0.2}
            amp={0.2}
            speed={1.0}
            opacity={0.8}
          />
          {/* reclamation treatment tanks (greywater / rainwater) */}
          {[-1.4, 0, 1.4].map((x, i) => (
            <group key={x}>
              <Vox position={[x, 0.6, -1.6]} size={[0.9, 1.2, 0.9]} color="#1d4e6b" />
              <PulseVox
                position={[x, 0.62, -1.6]}
                size={[0.92, 0.5, 0.92]}
                color={accent}
                emissive={accent}
                base={0.25}
                amp={0.25}
                speed={1.4}
                phase={i}
                opacity={0.85}
              />
            </group>
          ))}
          {/* pipe run */}
          <Vox position={[0, 1.28, -1.6]} size={[3.4, 0.12, 0.12]} color="#3a4d5a" />
          <Vox position={[-1.4, 0.95, -1.1]} size={[0.12, 0.6, 0.12]} color="#3a4d5a" />
          <Vox position={[1.4, 0.95, -1.1]} size={[0.12, 0.6, 0.12]} color="#3a4d5a" />
          {/* pump skid */}
          <Vox position={[0.8, 0.3, 1.4]} size={[1.2, 0.6, 0.8]} color="#26323d" />
          <PulseVox
            position={[0.8, 0.62, 1.4]}
            size={[0.2, 0.08, 0.2]}
            color={accent}
            base={0.4}
            amp={0.6}
            speed={6}
          />
        </group>
      );
    case "energy":
      // Battery wall + blinking server/inverter racks.
      return (
        <group>
          {[-1.7, -1.1, -0.5].map((x, i) => (
            <group key={x}>
              <Vox position={[x, 0.7, -1.7]} size={[0.5, 1.4, 0.7]} color="#2a2f1a" />
              {[0.4, 0.8, 1.2].map((y) => (
                <PulseVox
                  key={y}
                  position={[x, y, -1.32]}
                  size={[0.42, 0.18, 0.04]}
                  color={accent}
                  emissive={accent}
                  base={0.35}
                  amp={0.45}
                  speed={2 + i}
                  phase={x + y}
                />
              ))}
            </group>
          ))}
          {/* server racks with green blinks */}
          {[0.7, 1.3, 1.9].map((x, i) => (
            <group key={x}>
              <Vox position={[x, 0.7, -1.7]} size={[0.5, 1.4, 0.7]} color="#13202a" />
              {[0.5, 0.85, 1.2].map((y, j) => (
                <PulseVox
                  key={y}
                  position={[x, y, -1.32]}
                  size={[0.06, 0.06, 0.04]}
                  color="#5ddc7a"
                  base={0.5}
                  amp={0.5}
                  speed={5 + j}
                  phase={x * 3 + y * 7 + i}
                />
              ))}
            </group>
          ))}
          {/* control desk */}
          <Vox position={[0, 0.4, 1.4]} size={[2.4, 0.1, 0.7]} color="#26323d" />
          <PulseVox
            position={[0, 0.62, 1.5]}
            size={[1.4, 0.32, 0.04]}
            color="#4ea8ff"
            base={night ? 0.5 : 0.25}
            amp={0.2}
            speed={1.2}
          />
        </group>
      );
    case "food": {
      const isFarm = floor.key === "vertical-farm";
      if (isFarm) {
        // Tiered grow shelves with magenta grow-lights pulsing over green crops.
        return (
          <group>
            {[-1.5, 0, 1.5].map((x) =>
              [0.45, 0.95, 1.35].map((y, tier) => (
                <group key={`${x}-${y}`}>
                  <Vox position={[x, y - 0.06, -0.6]} size={[1.1, 0.06, 1.6]} color="#2c3a30" />
                  {/* crops */}
                  {[-0.3, 0, 0.3].map((dz) => (
                    <Vox
                      key={dz}
                      position={[x, y + 0.12, -0.6 + dz]}
                      size={[0.7, 0.22, 0.18]}
                      color={tier % 2 ? "#4cc56a" : "#67e08a"}
                    />
                  ))}
                  {/* grow light bar */}
                  <PulseVox
                    position={[x, y + 0.32, -0.6]}
                    size={[1.0, 0.05, 1.4]}
                    color="#ff7be0"
                    emissive="#ff7be0"
                    base={night ? 0.7 : 0.4}
                    amp={0.3}
                    speed={1.5}
                    phase={x + y}
                  />
                </group>
              )),
            )}
          </group>
        );
      }
      // Aquaponics: fish tank + grow bed fed from it.
      return (
        <group>
          <Vox position={[-0.9, 0.45, 0]} size={[1.8, 0.9, 2.4]} color="#123347" opacity={0.55} />
          {[-0.4, 0.2, -1.0].map((z, i) => (
            <Vox
              key={z}
              position={[-0.9 + (i - 1) * 0.2, 0.45, z]}
              size={[0.28, 0.14, 0.14]}
              color="#ff9d4d"
            />
          ))}
          <PulseVox
            position={[-0.9, 0.9, 0]}
            size={[1.7, 0.04, 2.3]}
            color={accent}
            base={0.15}
            amp={0.15}
            speed={2.2}
            opacity={0.5}
          />
          {/* grow bed */}
          <Vox position={[1.2, 0.5, 0]} size={[1.4, 0.2, 2.2]} color="#2c3a30" />
          {[-0.7, 0, 0.7].map((z) => (
            <Vox key={z} position={[1.2, 0.7, z]} size={[1.0, 0.28, 0.4]} color="#5ddc7a" />
          ))}
        </group>
      );
    }
    case "shelter": {
      // Two or three dwelling units: bed, side table, warm lamp, a resident.
      const units: Vec3[] = [
        [-1.4, 0, -1.2],
        [1.4, 0, -1.2],
        [0, 0, 1.4],
      ];
      return (
        <group>
          {units.map(([ux, , uz], i) => (
            <group key={i} position={[ux, 0, uz]}>
              {/* bed */}
              <Vox position={[0, 0.18, 0]} size={[1.0, 0.22, 0.7]} color="#3a4656" />
              <Vox position={[-0.32, 0.34, 0]} size={[0.3, 0.16, 0.6]} color="#e9eef5" />
              {/* side table + warm lamp */}
              <Vox position={[0.62, 0.22, -0.3]} size={[0.24, 0.3, 0.24]} color="#2c3a47" />
              <PulseVox
                position={[0.62, 0.46, -0.3]}
                size={[0.16, 0.16, 0.16]}
                color="#ffd9a0"
                emissive="#ffd9a0"
                base={night ? 0.8 : 0.2}
                amp={0.15}
                speed={0.8}
                phase={i}
              />
            </group>
          ))}
          {/* a couple of residents at home */}
          <SimPerson position={[-1.0, 0, -1.2]} color={accent} pace={0.25} detailed={detailed} />
          <SimPerson position={[0.4, 0, 1.4]} color="#7fe7e0" pace={0.2} detailed={detailed} />
        </group>
      );
    }
    case "air":
      // The Lung — a living atrium tree that gently sways.
      return <LungTree accent={accent} />;
    case "health":
      // Commons & clinic: beds, a red cross, equipment, staff + visitors.
      return (
        <group>
          {[-1.4, 0, 1.4].map((x) => (
            <group key={x}>
              <Vox position={[x, 0.22, -1.4]} size={[0.8, 0.24, 1.4]} color="#e9eef5" />
              <Vox position={[x, 0.42, -2.0]} size={[0.8, 0.2, 0.2]} color="#cdd6e2" />
              <Vox position={[x + 0.5, 0.5, -1.4]} size={[0.1, 0.6, 0.1]} color="#9aa7b6" />
            </group>
          ))}
          {/* red cross on the back wall */}
          <PulseVox position={[0, 1.0, -2.55]} size={[0.5, 0.16, 0.05]} color="#ff5d5d" base={0.6} amp={0.3} speed={1} />
          <PulseVox position={[0, 1.0, -2.55]} size={[0.16, 0.5, 0.05]} color="#ff5d5d" base={0.6} amp={0.3} speed={1} />
          {/* reception desk */}
          <Vox position={[0.6, 0.4, 1.4]} size={[2.0, 0.1, 0.7]} color="#26323d" />
          <SimPerson position={[-0.6, 0, 1.0]} color={accent} pace={0.2} detailed={detailed} />
          <SimPerson position={[1.2, 0, 0.6]} color="#c0a4ff" pace={0.3} detailed={detailed} />
        </group>
      );
    case "restoration":
      // Skydeck: shared rooftop pool with a shimmering surface + loungers.
      return (
        <group>
          <Vox position={[0, 0.12, 0]} size={[3.4, 0.24, 2.6]} color="#15384d" />
          <PoolSurface accent={accent} />
          {[-1.9, 1.9].map((x) =>
            [-0.7, 0.7].map((z) => (
              <Vox key={`${x}-${z}`} position={[x, 0.18, z]} size={[0.5, 0.12, 1.0]} color="#e9eef5" />
            )),
          )}
          {/* planters */}
          {[-2.0, 2.0].map((x) => (
            <Vox key={x} position={[x, 0.3, -2.2]} size={[0.5, 0.5, 0.5]} color="#3aa56a" />
          ))}
          <SimPerson position={[-1.9, 0.3, -0.7]} color="#ffd9a0" detailed={detailed} />
        </group>
      );
    default:
      return null;
  }
}

function LungTree({ accent }: { accent: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.5) * 0.03;
  });
  return (
    <group ref={g}>
      <Vox position={[0, 0.6, 0]} size={[0.4, 1.2, 0.4]} color="#5a4632" />
      {[
        [0, 1.4, 0, 1.6],
        [-0.7, 1.2, 0.4, 1.0],
        [0.7, 1.25, -0.3, 1.0],
        [0.1, 1.7, -0.4, 0.9],
      ].map(([x, y, z, sz], i) => (
        <PulseVox
          key={i}
          position={[x, y, z]}
          size={[sz, sz * 0.8, sz]}
          color={i % 2 ? "#3aa56a" : "#4cc56a"}
          emissive={accent}
          base={0.08}
          amp={0.08}
          speed={1 + i * 0.3}
          phase={i}
        />
      ))}
      {/* planters around the atrium */}
      {[-2, 2].map((x) =>
        [-2, 2].map((z) => (
          <Vox key={`${x}-${z}`} position={[x, 0.25, z]} size={[0.5, 0.4, 0.5]} color="#2c3a30" />
        )),
      )}
    </group>
  );
}

function PoolSurface({ accent }: { accent: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (mesh.current) {
      mesh.current.position.y = 0.26 + Math.sin(s.clock.elapsedTime * 1.5) * 0.015;
    }
  });
  return (
    <mesh ref={mesh} position={[0, 0.26, 0]}>
      <boxGeometry args={[3.0, 0.04, 2.2]} />
      <meshStandardMaterial
        color={accent}
        emissive={accent}
        emissiveIntensity={0.25}
        transparent
        opacity={0.7}
        roughness={0.2}
        flatShading
      />
    </mesh>
  );
}

// --------------------------------------------------------------------------
// One floor: slab, three walls (front cut away), side windows, selector hit-
// box, incident rim, and the interior recipe.
// --------------------------------------------------------------------------
function FloorBlock({
  floor,
  index,
  selected,
  hasIncident,
  night,
  cutaway,
  detailed,
  onSelect,
}: {
  floor: Floor;
  index: number;
  selected: boolean;
  hasIncident: boolean;
  night: boolean;
  cutaway: boolean;
  detailed: boolean;
  onSelect: (key: string) => void;
}) {
  const baseY = index * STEP;
  const accent = needColor[floor.need];
  const [hovered, setHovered] = useState(false);
  const rim = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((s) => {
    if (!rim.current) return;
    if (hasIncident) {
      rim.current.emissiveIntensity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 5));
    } else {
      rim.current.emissiveIntensity = selected ? 0.7 : hovered ? 0.4 : 0;
    }
  });

  const wallColor = "#16222d";
  const isResidential = floor.need === "shelter";

  return (
    <group position={[0, baseY, 0]}>
      {/* structural slab */}
      <Vox position={[0, -SLAB_T / 2, 0]} size={[HALF_W * 2 + 0.3, SLAB_T, HALF_D * 2 + 0.3]} color="#0d161e" />
      <Vox position={[0, -SLAB_T / 2 + 0.02, 0]} size={[HALF_W * 2, SLAB_T * 0.6, HALF_D * 2]} color="#1a2832" />

      {/* selection / incident rim sitting on the slab edge */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[HALF_W * 2 + 0.36, 0.05, HALF_D * 2 + 0.36]} />
        <meshStandardMaterial
          ref={rim}
          color={hasIncident ? "#ff5d5d" : accent}
          emissive={hasIncident ? "#ff5d5d" : accent}
          emissiveIntensity={0}
          transparent
          opacity={0.9}
          flatShading
        />
      </mesh>

      {/* back + side walls (front left open for the dollhouse cut-away) */}
      <Vox position={[0, FLOOR_H / 2, -HALF_D]} size={[HALF_W * 2, FLOOR_H, 0.16]} color={wallColor} />
      <Vox position={[-HALF_W, FLOOR_H / 2, 0]} size={[0.16, FLOOR_H, HALF_D * 2]} color={wallColor} />
      <Vox position={[HALF_W, FLOOR_H / 2, 0]} size={[0.16, FLOOR_H, HALF_D * 2]} color={wallColor} />

      {/* optional translucent glass front when not in cut-away mode */}
      {!cutaway && (
        <Vox
          position={[0, FLOOR_H / 2, HALF_D]}
          size={[HALF_W * 2, FLOOR_H, 0.08]}
          color="#7fe7e0"
          opacity={0.12}
        />
      )}

      {/* side windows — warm glow at night on residential floors */}
      {[-HALF_W - 0.01, HALF_W + 0.01].map((x) =>
        [-1.8, 0, 1.8].map((z) => (
          <PulseVox
            key={`${x}-${z}`}
            position={[x, FLOOR_H * 0.55, z]}
            size={[0.06, 0.6, 0.7]}
            color={isResidential ? "#ffd9a0" : accent}
            emissive={isResidential ? "#ffd9a0" : accent}
            base={night ? 0.7 : 0.18}
            amp={0.08}
            speed={0.6}
            phase={x + z}
          />
        )),
      )}

      {/* interior */}
      <FloorInterior floor={floor} accent={accent} night={night} detailed={detailed} />

      {/* invisible (opacity-0) selector spanning the floor volume */}
      <Vox
        position={[0, FLOOR_H / 2, 0]}
        size={[HALF_W * 2, FLOOR_H, HALF_D * 2]}
        opacity={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(floor.key);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      />

      {/* hover / selected label */}
      {(hovered || selected) && (
        <Html position={[HALF_W + 0.4, FLOOR_H * 0.6, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="annotation whitespace-nowrap rounded-md px-2 py-1 text-xs text-white">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: accent }} />
            {floor.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// --- elevator geometry constants ------------------------------------------
// Second elevator shaft is offset +1.8 in Z from the primary.
// Dual elevators per ATLAS-derisking-plan.md §Flaw 5 (redundancy + accessibility).
const CORE_Z2 = CORE_Z + 1.8; // second shaft Z offset

// --------------------------------------------------------------------------
// Elevator: a glass shaft running the full height with a car that visits each
// floor (ping-pong), doors, and an interior light.
// Primary elevator (Elevator A) — animated, ping-pong across all floors.
// --------------------------------------------------------------------------
function Elevator({
  stops,
  running,
  detailed,
  onArrive,
}: {
  stops: number[];
  running: boolean;
  detailed: boolean;
  onArrive: (floorIndex: number) => void;
}) {
  const car = useRef<THREE.Group>(null);
  const idx = useRef(0);
  const dir = useRef(1);
  const wait = useRef(0);
  const top = stops[stops.length - 1] + CAR_H / 2 + 0.6;

  useFrame((_, dt) => {
    if (!car.current || !running) return;
    const y = car.current.position.y;
    const target = stops[idx.current];
    const d = target - y;
    if (Math.abs(d) < 0.03) {
      wait.current -= dt;
      if (wait.current <= 0) {
        let next = idx.current + dir.current;
        if (next >= stops.length) {
          dir.current = -1;
          next = idx.current - 1;
        } else if (next < 0) {
          dir.current = 1;
          next = idx.current + 1;
        }
        idx.current = next;
        wait.current = 1.6;
        onArrive(next);
      }
    } else {
      car.current.position.y = y + Math.sign(d) * Math.min(2.4 * dt, Math.abs(d));
    }
  });

  return (
    <group position={[CORE_X, 0, CORE_Z]}>
      {/* shaft frame: four glass corner panels + back, open to the cabin */}
      <Vox position={[0, top / 2, -0.78]} size={[1.6, top, 0.08]} color="#0d161e" />
      <Vox position={[-0.78, top / 2, 0]} size={[0.08, top, 1.5]} color="#7fe7e0" opacity={0.12} />
      <Vox position={[0.78, top / 2, 0]} size={[0.08, top, 1.5]} color="#7fe7e0" opacity={0.12} />
      {/* shaft guide rails */}
      <Vox position={[-0.5, top / 2, -0.6]} size={[0.06, top, 0.06]} color="#2c3a47" />
      <Vox position={[0.5, top / 2, -0.6]} size={[0.06, top, 0.06]} color="#2c3a47" />

      {/* the car */}
      <group ref={car} position={[0, CAR_H / 2, 0]}>
        <Vox position={[0, 0, -0.6]} size={[1.3, CAR_H, 0.08]} color="#1a2832" />
        <Vox position={[-0.6, 0, 0]} size={[0.08, CAR_H, 1.2]} color="#1a2832" />
        <Vox position={[0.6, 0, 0]} size={[0.08, CAR_H, 1.2]} color="#1a2832" />
        <Vox position={[0, -CAR_H / 2, 0]} size={[1.3, 0.08, 1.2]} color="#26323d" />
        <Vox position={[0, CAR_H / 2, 0]} size={[1.3, 0.08, 1.2]} color="#26323d" />
        {/* cabin light */}
        <PulseVox position={[0, CAR_H / 2 - 0.1, 0]} size={[1.0, 0.06, 0.9]} color="#ffd9a0" base={0.7} amp={0.05} speed={0.5} />
        {/* doors */}
        <Vox position={[-0.3, 0, 0.58]} size={[0.55, CAR_H * 0.92, 0.06]} color="#4ea8ff" opacity={0.85} />
        <Vox position={[0.3, 0, 0.58]} size={[0.55, CAR_H * 0.92, 0.06]} color="#4ea8ff" opacity={0.85} />
        <SimPerson position={[0, -CAR_H / 2 + 0.02, -0.1]} color="#c0a4ff" detailed={detailed} />
      </group>
    </group>
  );
}

// --------------------------------------------------------------------------
// Elevator B (second shaft) — static car parked mid-height for redundancy /
// accessibility. Dual elevators per ATLAS-derisking-plan.md §Flaw 5.
// Shares the same core column (CORE_X) but is offset to CORE_Z2.
// --------------------------------------------------------------------------
function ElevatorB({ stops }: { stops: number[] }) {
  const top = stops[stops.length - 1] + CAR_H / 2 + 0.6;
  // Park the standby car roughly mid-building (offset phase so it reads
  // as independently positioned, not a duplicate of car A).
  const parkedY = stops[Math.floor(stops.length / 2)] ?? CAR_H / 2;

  return (
    <group position={[CORE_X, 0, CORE_Z2]}>
      {/* shaft frame — identical profile to Elevator A */}
      <Vox position={[0, top / 2, -0.78]} size={[1.6, top, 0.08]} color="#0d161e" />
      <Vox position={[-0.78, top / 2, 0]} size={[0.08, top, 1.5]} color="#7fe7e0" opacity={0.12} />
      <Vox position={[0.78, top / 2, 0]} size={[0.08, top, 1.5]} color="#7fe7e0" opacity={0.12} />
      {/* shaft guide rails */}
      <Vox position={[-0.5, top / 2, -0.6]} size={[0.06, top, 0.06]} color="#2c3a47" />
      <Vox position={[0.5, top / 2, -0.6]} size={[0.06, top, 0.06]} color="#2c3a47" />
      {/* standby car — static, parked at mid-floor */}
      <group position={[0, parkedY, 0]}>
        <Vox position={[0, 0, -0.6]} size={[1.3, CAR_H, 0.08]} color="#1a2832" />
        <Vox position={[-0.6, 0, 0]} size={[0.08, CAR_H, 1.2]} color="#1a2832" />
        <Vox position={[0.6, 0, 0]} size={[0.08, CAR_H, 1.2]} color="#1a2832" />
        <Vox position={[0, -CAR_H / 2, 0]} size={[1.3, 0.08, 1.2]} color="#26323d" />
        <Vox position={[0, CAR_H / 2, 0]} size={[1.3, 0.08, 1.2]} color="#26323d" />
        {/* cabin light — dimmer to signal standby */}
        <PulseVox position={[0, CAR_H / 2 - 0.1, 0]} size={[1.0, 0.06, 0.9]} color="#ffd9a0" base={0.3} amp={0.05} speed={0.5} />
        {/* doors — closed */}
        <Vox position={[-0.3, 0, 0.58]} size={[0.55, CAR_H * 0.92, 0.06]} color="#4ea8ff" opacity={0.85} />
        <Vox position={[0.3, 0, 0.58]} size={[0.55, CAR_H * 0.92, 0.06]} color="#4ea8ff" opacity={0.85} />
      </group>
    </group>
  );
}

// --------------------------------------------------------------------------
// Switchback staircase linking every floor, alternating direction each flight.
// --------------------------------------------------------------------------
function Staircase({ floorCount }: { floorCount: number }) {
  const steps = useMemo(() => {
    const out: { pos: Vec3; size: Vec3 }[] = [];
    const n = 7; // steps per flight
    const zSpan = 2.4;
    for (let f = 0; f < floorCount; f++) {
      const baseY = f * STEP;
      const flip = f % 2 === 0 ? 1 : -1;
      for (let s = 0; s < n; s++) {
        const frac = (s + 0.5) / n;
        out.push({
          pos: [STAIR_X, baseY + frac * STEP - STEP / 2 + 0.08, flip * (zSpan * (frac - 0.5))],
          size: [1.3, 0.12, zSpan / n + 0.06],
        });
      }
      // landing
      out.push({ pos: [STAIR_X, baseY + STEP - 0.06, (flip * zSpan) / 2], size: [1.3, 0.12, 0.7] });
    }
    return out;
  }, [floorCount]);

  return (
    <group>
      {steps.map((st, i) => (
        <Vox key={i} position={st.pos} size={st.size} color={i % 2 ? "#2c3a47" : "#22323f"} />
      ))}
      {/* a faint guide rail up the outer edge */}
      <Vox position={[STAIR_X - 0.7, (floorCount * STEP) / 2, 0]} size={[0.05, floorCount * STEP, 0.05]} color="#4ea8ff" opacity={0.5} />
    </group>
  );
}

// --------------------------------------------------------------------------
// Rooftop: tilted solar array, POOL ONLY (bulk reservoir relocated to
// basement per ATLAS-derisking-plan.md §Flaw 7 — pool stays, tank removed
// to reduce rooftop structural load), and comms mast.
// --------------------------------------------------------------------------
function Rooftop({ y, night }: { y: number; night: boolean }) {
  return (
    <group position={[0, y, 0]}>
      <Vox position={[0, 0.08, 0]} size={[HALF_W * 2 + 0.3, 0.16, HALF_D * 2 + 0.3]} color="#0d161e" />
      {/* solar array (tilted panels) */}
      <group position={[-1.6, 0.5, 0]} rotation={[-0.5, 0, 0]}>
        {[-1, 0, 1].map((i) => (
          <PulseVox
            key={i}
            position={[i * 1.0, 0, 0]}
            size={[0.9, 0.06, 1.4]}
            color="#16314f"
            emissive="#4ea8ff"
            base={night ? 0.05 : 0.2}
            amp={0.1}
            speed={0.7}
            phase={i}
          />
        ))}
      </group>
      {/* Skydeck pool (shallow) — the only rooftop water mass after reservoir
          relocation; coping surround + shimmering water surface */}
      <Vox position={[2.2, 0.16, -1.4]} size={[1.6, 0.32, 1.6]} color="#15384d" />
      <PulseVox position={[2.2, 0.34, -1.4]} size={[1.4, 0.06, 1.4]} color="#3aa0ff" base={0.2} amp={0.15} speed={1.5} opacity={0.75} />
      {/* comms mast */}
      <Vox position={[2.4, 1.4, 1.6]} size={[0.1, 2.0, 0.1]} color="#2c3a47" />
      <PulseVox position={[2.4, 2.45, 1.6]} size={[0.18, 0.18, 0.18]} color="#ff5d5d" base={0.5} amp={0.5} speed={3} />
      {/* optional detailed rooftop prop (additive; off until an asset is set) */}
      <GltfProp slot="rooftopProp" position={[-1.6, 0.16, 0]} />
    </group>
  );
}

// --------------------------------------------------------------------------
// The assembled tower (everything below the DOM chrome).
// --------------------------------------------------------------------------
function Tower({
  floors,
  incidentFloorKeys,
  selectedKey,
  options,
  onSelect,
  onElevatorArrive,
}: {
  floors: Floor[];
  incidentFloorKeys: Set<string>;
  selectedKey: string | null;
  options: SimOptions;
  onSelect: (key: string) => void;
  onElevatorArrive: (i: number) => void;
}) {
  const totalHeight = floors.length * STEP;
  const stops = useMemo(() => floors.map((_, i) => i * STEP + CAR_H / 2), [floors]);

  return (
    <group>
      {/* ground plaza */}
      <Vox position={[0, -SLAB_T - 0.1, 0]} size={[22, 0.2, 18]} color="#0a1117" />
      <Vox position={[0, -SLAB_T - 0.01, 0]} size={[HALF_W * 2 + 3, 0.06, HALF_D * 2 + 3]} color="#101a24" />

      {/* corner columns */}
      {[-HALF_W, HALF_W].map((x) =>
        [-HALF_D, HALF_D].map((z) => (
          <Vox key={`${x}-${z}`} position={[x, totalHeight / 2, z]} size={[0.3, totalHeight + 0.2, 0.3]} color="#0d161e" />
        )),
      )}

      {floors.map((floor, i) => (
        <FloorBlock
          key={floor.key}
          floor={floor}
          index={i}
          selected={floor.key === selectedKey}
          hasIncident={incidentFloorKeys.has(floor.key)}
          night={options.night}
          cutaway={options.cutaway}
          detailed={options.detailedModels}
          onSelect={onSelect}
        />
      ))}

      {/* A detailed "greeter" robot on the plaza out front — large and
          unobstructed so the real 3D model reads at a glance (detailed mode). */}
      {options.detailedModels && (
        <group>
          {/* dedicated key light so the greeter reads against the dark plaza */}
          <pointLight position={[5, 5, 9]} intensity={2.2} distance={22} decay={2} color="#fff3da" />
          {/* a detailed "greeter" robot on the plaza out front — large and
              unobstructed so the real 3D model reads at a glance */}
          <SimPerson
            position={[3.4, -SLAB_T, 7.5]}
            color="#7fe7e0"
            detailed
            height={3.2}
            rotationY={-0.5}
          />
        </group>
      )}

      <Staircase floorCount={floors.length} />
      {/* Elevator A — animated primary car */}
      <Elevator
        stops={stops}
        running={options.elevatorRunning}
        detailed={options.detailedModels}
        onArrive={onElevatorArrive}
      />
      {/* Elevator B — second shaft (redundancy/accessibility, ATLAS-derisking-plan.md §5) */}
      <ElevatorB stops={stops} />
      <Rooftop y={totalHeight} night={options.night} />
    </group>
  );
}

// --------------------------------------------------------------------------
// Public component: the Canvas + lighting + controls. Centred so orbit feels
// natural; pixelation is achieved with a low device-pixel-ratio buffer that
// the browser upscales with nearest-neighbour (image-rendering: pixelated).
// --------------------------------------------------------------------------
export default function BuildingSimulator({
  floors,
  incidents,
  selectedKey,
  options,
  pixel,
  ascii,
  onSelect,
  onElevatorArrive,
}: {
  floors: Floor[];
  incidents: Incident[];
  selectedKey: string | null;
  options: SimOptions;
  pixel: boolean;
  ascii: boolean;
  onSelect: (key: string | null) => void;
  onElevatorArrive: (floorIndex: number) => void;
}) {
  const totalHeight = floors.length * STEP;
  const target = useMemo<Vec3>(() => [0, totalHeight * 0.46, 0], [totalHeight]);

  const incidentFloorKeys = useMemo(
    () =>
      new Set(
        incidents
          .filter((i) => i.severity === "crit" || i.severity === "warn")
          .map((i) => i.floorKey)
          .filter((k): k is string => Boolean(k)),
      ),
    [incidents],
  );

  const bg = options.night ? "#05080c" : "#0b1622";
  const skyTop: string = options.night ? "#0a1830" : "#1d3a5f";

  return (
    <Canvas
      // Pixelation comes from a low device-pixel-ratio buffer the browser
      // upscales with nearest-neighbour. R3F updates the renderer's pixel ratio
      // reactively from `dpr` — no Canvas remount (which would recreate the
      // WebGL context) needed.
      dpr={ascii ? 1 : pixel ? 0.4 : 1.6}
      className={pixel && !ascii ? "[image-rendering:pixelated]" : ""}
      gl={{ antialias: true }}
      // 3/4 view from the open (cut-away) front-right so interiors, the
      // elevator core and the stair core all read; pulled back to frame the
      // whole tower including the rooftop.
      camera={{ position: [20, totalHeight * 0.62 + 4, 26], fov: 40 }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 35, 70]} />

      <hemisphereLight args={[skyTop, "#0a1117", options.night ? 0.35 : 0.8]} />
      <ambientLight intensity={options.night ? 0.18 : 0.45} />
      <directionalLight position={[12, 20, 10]} intensity={options.night ? 0.35 : 1.1} color={options.night ? "#9fb8ff" : "#fff3da"} />
      <directionalLight position={[-10, 6, -8]} intensity={0.3} color="#4ea8ff" />

      {(() => {
        // The voxel twin is the default and the fallback for the optional glTF
        // hero model (which renders only when a /models/atlas-01.glb exists).
        const voxelTower = (
          <Tower
            floors={floors}
            incidentFloorKeys={incidentFloorKeys}
            selectedKey={selectedKey}
            options={options}
            onSelect={onSelect}
            onElevatorArrive={onElevatorArrive}
          />
        );
        return (options.source ?? "voxel") === "gltf" ? (
          <GltfBuilding fallback={voxelTower} />
        ) : (
          voxelTower
        );
      })()}

      <OrbitControls
        target={target}
        enablePan={false}
        autoRotate={options.autoRotate && !selectedKey}
        autoRotateSpeed={0.6}
        minDistance={10}
        maxDistance={48}
        maxPolarAngle={Math.PI / 1.95}
      />

      {/* Signature ASCII pass — the voxel tower resampled into live glyphs. */}
      {ascii && <AsciiRenderer color resolution={0.16} characters=" .:-=+*#%@" />}
    </Canvas>
  );
}
