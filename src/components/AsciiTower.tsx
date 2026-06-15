"use client";

// The ATLAS ASCII signature — a self-contained voxel tower rendered as live,
// colored ASCII art. Seven stacked blocks (one per human need, base→roof) plus
// a rooftop array and reservoir, lit so the need-palette tints carry through the
// glyphs via AsciiRenderer's per-pixel color. On mount the floors "boot" in
// bottom-up, then the tower slowly turns. No data, no assets — pure three.js,
// so it can headline any page. Honors prefers-reduced-motion.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import AsciiRenderer from "@/components/AsciiRenderer";
import MainHdrEnvironment from "@/components/three/MainHdrEnvironment";

type Vec3 = [number, number, number];

// Base → roof, matching the landing tower + need palette.
const FLOORS: { color: string }[] = [
  { color: "#3aa0ff" }, // water
  { color: "#ffcf4d" }, // energy
  { color: "#5ddc7a" }, // food
  { color: "#c0a4ff" }, // shelter
  { color: "#7fe7e0" }, // air
  { color: "#ff8fb1" }, // health
  { color: "#ffd9a0" }, // restoration
];

const FLOOR_H = 0.9;
const GAP = 0.14;
const STEP = FLOOR_H + GAP;
const W = 3.2;
const D = 3.2;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// One glowing floor slab with a row of "windows" for glyph texture.
function Slab({
  index,
  color,
  reduced,
}: {
  index: number;
  color: string;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  // Stagger the boot-in: each floor rises a beat after the one below.
  const delay = index * 0.22;

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    if (reduced) {
      g.scale.setScalar(1);
      g.position.y = index * STEP;
      return;
    }
    const t = state.clock.elapsedTime - delay;
    const k = THREE.MathUtils.clamp(t / 0.7, 0, 1);
    const ease = 1 - Math.pow(1 - k, 3); // easeOutCubic
    g.scale.setScalar(0.0001 + ease);
    // Settle into place from slightly below.
    g.position.y = index * STEP - (1 - ease) * 0.6;
  });

  const windows: Vec3[] = useMemo(
    () => [-1, 0, 1].map((x) => [x * 0.9, 0, D / 2 + 0.02] as Vec3),
    [],
  );

  return (
    <group ref={ref} position={[0, index * STEP, 0]} scale={0.0001}>
      <mesh>
        <boxGeometry args={[W, FLOOR_H, D]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>
      {/* bright window strip so the glyph ramp has contrast to chew on */}
      {windows.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.45, FLOOR_H * 0.5, 0.06]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.1} />
        </mesh>
      ))}
    </group>
  );
}

function Rooftop({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      {/* tilted solar array */}
      <group position={[-0.9, 0.4, 0]} rotation={[-0.5, 0, 0]}>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * 0.8, 0, 0]}>
            <boxGeometry args={[0.7, 0.06, 1.0]} />
            <meshStandardMaterial color="#16314f" emissive="#4ea8ff" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      {/* reservoir */}
      <mesh position={[1.1, 0.5, -0.6]}>
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial color="#1d4e6b" emissive="#3aa0ff" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function TowerGroup({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const total = FLOORS.length * STEP;

  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    group.current.rotation.y += delta * 0.35;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.12;
  });

  return (
    <group ref={group} position={[0, -total / 2, 0]}>
      {FLOORS.map((f, i) => (
        <Slab key={i} index={i} color={f.color} reduced={reduced} />
      ))}
      <Rooftop y={total - GAP} />
    </group>
  );
}

export default function AsciiTower({
  resolution = 0.18,
  characters = " .:-=+*#%@",
}: {
  resolution?: number;
  characters?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <Canvas
      camera={{ position: [7, 3.5, 9], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      frameloop={reduced ? "demand" : "always"}
    >
      <MainHdrEnvironment intensity={0.75} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} />
      <directionalLight position={[-6, -2, -6]} intensity={0.4} color="#4ea8ff" />
      <TowerGroup reduced={reduced} />
      <AsciiRenderer characters={characters} resolution={resolution} color invert />
    </Canvas>
  );
}
