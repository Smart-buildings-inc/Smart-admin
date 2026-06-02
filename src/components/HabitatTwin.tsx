"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Incident } from "@/lib/types";
import { needColor } from "@/lib/ui";
import { annotationByFloor } from "@/lib/annotations";

export type TwinMode = "orbit" | "walkthrough";

const FLOOR_HEIGHT = 0.9;
const FLOOR_GAP = 0.12;
const FLOOR_W = 3.4;
const FLOOR_D = 3.4;
const STEP = FLOOR_HEIGHT + FLOOR_GAP;

interface SlabProps {
  floor: Floor;
  index: number;
  selected: boolean;
  hasIncident: boolean;
  showAnnotation: boolean;
  onSelect: (key: string) => void;
}

function FloorSlab({
  floor,
  index,
  selected,
  hasIncident,
  showAnnotation,
  onSelect,
}: SlabProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const y = index * STEP;
  const base = needColor[floor.need];
  const annotation = annotationByFloor.get(floor.key);

  useFrame((state) => {
    const mat = meshRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    let intensity = selected ? 0.55 : hovered ? 0.4 : 0.12;
    if (hasIncident) {
      const t = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      intensity = Math.max(intensity, 0.3 + t * 0.5);
    }
    if (showAnnotation) intensity = Math.max(intensity, 0.5);
    mat.emissiveIntensity = intensity;
  });

  return (
    <group position={[0, y, 0]}>
      <mesh
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => {
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
        scale={selected || hovered ? 1.04 : 1}
      >
        <boxGeometry args={[FLOOR_W, FLOOR_HEIGHT, FLOOR_D]} />
        <meshStandardMaterial
          color={base}
          emissive={hasIncident ? "#ff5d5d" : base}
          emissiveIntensity={0.12}
          metalness={0.2}
          roughness={0.45}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Hover/select label */}
      {(hovered || selected) && !showAnnotation && (
        <Html
          position={[FLOOR_W / 2 + 0.25, 0, 0]}
          center
          distanceFactor={9}
          style={{ pointerEvents: "none" }}
        >
          <div className="annotation whitespace-nowrap rounded-md px-2 py-1 text-xs text-white">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: base }}
            />
            {floor.name}
          </div>
        </Html>
      )}

      {/* Walk-through annotation (arrow + bold-italic quote) */}
      {showAnnotation && annotation && (
        <Html
          position={[
            annotation.arrow === "right" ? FLOOR_W / 2 + 0.4 : -(FLOOR_W / 2 + 0.4),
            0,
            0,
          ]}
          center
          distanceFactor={7}
          style={{ pointerEvents: "none" }}
          zIndexRange={[100, 0]}
        >
          <div
            className={`annotation float w-60 rounded-2xl px-4 py-3 text-white ${
              annotation.arrow === "right" ? "text-left" : "text-right"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              {annotation.arrow === "left" && <span>{floor.name}</span>}
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: base }}
              />
              {annotation.arrow === "right" && <span>{floor.name}</span>}
            </div>
            <div className="annotation-quote text-lg leading-tight">
              {annotation.arrow === "right" ? "→ " : ""}
              {annotation.quote}
              {annotation.arrow === "left" ? " ←" : ""}
            </div>
            <div className="mt-1 text-xs leading-snug text-slate-300">
              {annotation.caption}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Drives the camera on a top→underground descent during walk-through mode. */
function WalkthroughCamera({
  active,
  floorCount,
  totalHeight,
  onFloorChange,
  onComplete,
}: {
  active: boolean;
  floorCount: number;
  totalHeight: number;
  onFloorChange: (index: number) => void;
  onComplete: () => void;
}) {
  const { camera } = useThree();
  const tRef = useRef(0);
  const lastFloorRef = useRef(-1);

  useEffect(() => {
    if (active) {
      tRef.current = 0;
      lastFloorRef.current = -1;
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;
    // Progress 0→1 over ~10s.
    tRef.current = Math.min(1, tRef.current + delta / 10);
    const t = tRef.current;

    // Tower group is centered: slab i sits at (i*STEP - totalHeight/2).
    const topY = (floorCount - 1) * STEP - totalHeight / 2;
    const bottomY = -totalHeight / 2 - STEP * 1.4; // dip below ground for B1

    const y = THREE.MathUtils.lerp(topY + 1.5, bottomY, t);
    // Spiral inward as we descend.
    const angle = t * Math.PI * 1.5;
    const radius = THREE.MathUtils.lerp(7.5, 5, t);
    camera.position.set(
      Math.sin(angle) * radius,
      y,
      Math.cos(angle) * radius,
    );
    camera.lookAt(0, y - 0.3, 0);

    // Report which floor is currently in frame (top→bottom).
    const floorAtT = Math.min(
      floorCount - 1,
      Math.floor((1 - t) * floorCount),
    );
    if (floorAtT !== lastFloorRef.current) {
      lastFloorRef.current = floorAtT;
      onFloorChange(floorAtT);
    }

    if (t >= 1) onComplete();
  });

  return null;
}

/** Mounts a WebXR "Enter AR" button bound to the live renderer. */
function ARLauncher({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const { gl } = useThree();

  useEffect(() => {
    let button: HTMLElement | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { ARButton } = await import("three/examples/jsm/webxr/ARButton.js");
        if (cancelled || !containerRef.current) return;
        gl.xr.enabled = true;
        button = ARButton.createButton(gl);
        button.classList.add("atlas-ar-button");
        containerRef.current.appendChild(button);
      } catch {
        // WebXR unavailable — the parent shows guidance instead.
      }
    })();

    return () => {
      cancelled = true;
      if (button && button.parentElement) button.parentElement.removeChild(button);
      gl.xr.enabled = false;
    };
  }, [gl, containerRef]);

  return null;
}

function Tower({
  floors,
  incidentFloorKeys,
  selectedKey,
  mode,
  walkFloorIndex,
  onSelect,
}: {
  floors: Floor[];
  incidentFloorKeys: Set<string>;
  selectedKey: string | null;
  mode: TwinMode;
  walkFloorIndex: number;
  onSelect: (key: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const totalHeight = floors.length * STEP;

  useFrame((_, delta) => {
    if (groupRef.current && mode === "orbit" && !selectedKey) {
      groupRef.current.rotation.y += delta * 0.12;
    }
    if (groupRef.current && mode === "walkthrough") {
      groupRef.current.rotation.y = 0; // camera moves, tower stays put
    }
  });

  return (
    <group ref={groupRef} position={[0, -totalHeight / 2, 0]}>
      {floors.map((floor, i) => (
        <FloorSlab
          key={floor.key}
          floor={floor}
          index={i}
          selected={floor.key === selectedKey}
          hasIncident={incidentFloorKeys.has(floor.key)}
          showAnnotation={mode === "walkthrough" && i === walkFloorIndex}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export default function HabitatTwin({
  floors,
  incidents,
  selectedKey,
  mode,
  onSelect,
  onWalkthroughEnd,
}: {
  floors: Floor[];
  incidents: Incident[];
  selectedKey: string | null;
  mode: TwinMode;
  onSelect: (key: string | null) => void;
  onWalkthroughEnd: () => void;
}) {
  const arContainerRef = useRef<HTMLDivElement>(null);
  const [walkFloorIndex, setWalkFloorIndex] = useState(-1);
  const totalHeight = floors.length * STEP;

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

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [8, 2, 8], fov: 42 }}
        frameloop="always"
        onPointerMissed={() => mode === "orbit" && onSelect(null)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 10, 6]} intensity={1.1} />
        <directionalLight position={[-6, -4, -6]} intensity={0.3} color="#4ea8ff" />

        <Tower
          floors={floors}
          incidentFloorKeys={incidentFloorKeys}
          selectedKey={selectedKey}
          mode={mode}
          walkFloorIndex={walkFloorIndex}
          onSelect={onSelect}
        />

        {mode === "orbit" && (
          <OrbitControls
            enablePan={false}
            minDistance={6}
            maxDistance={18}
            maxPolarAngle={Math.PI / 1.9}
          />
        )}

        <WalkthroughCamera
          active={mode === "walkthrough"}
          floorCount={floors.length}
          totalHeight={totalHeight}
          onFloorChange={setWalkFloorIndex}
          onComplete={onWalkthroughEnd}
        />

        <ARLauncher containerRef={arContainerRef} />
      </Canvas>

      <div className="twin-overlay pointer-events-none absolute left-4 top-4 text-xs text-slate-400">
        <div className="display text-sm text-slate-200">ATLAS‑01 · Habitat Twin</div>
        <div>
          {mode === "walkthrough"
            ? "Descending — rooftop pool to the underground core…"
            : "Orbit to inspect · tap a floor for telemetry"}
        </div>
      </div>

      {/* WebXR "Enter AR" button mounts here when supported. */}
      <div ref={arContainerRef} className="absolute bottom-4 right-4 z-10" />
    </div>
  );
}
