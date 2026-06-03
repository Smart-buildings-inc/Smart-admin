"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Incident } from "@/lib/types";
import { needColor } from "@/lib/ui";
import { annotationByFloor } from "@/lib/annotations";
import AsciiRenderer from "@/components/AsciiRenderer";
import { createChamferedBoxGeometry } from "@/lib/geometry";
import HumanCharacter from "@/components/three/HumanCharacter";

export type TwinMode = "orbit" | "walkthrough";

const FLOOR_HEIGHT = 0.9;
const FLOOR_GAP = 0.12;
const FLOOR_W = 3.4;
const FLOOR_D = 3.4;
const STEP = FLOOR_HEIGHT + FLOOR_GAP;

// --- Responsive camera framing -------------------------------------------
// The camera FOV is a *vertical* angle. On a portrait phone the aspect ratio
// is < 1, which collapses the horizontal field of view and makes the tower
// look heavily zoomed-in and cropped. computeFit() widens the vertical FOV to
// preserve the desktop horizontal framing, and — once FOV hits a sane cap —
// dollies the camera back to cover whatever horizontal shortfall remains.
const BASE_ASPECT = 1.6; // framing tuned for this (desktop) aspect
const BASE_FOV = 42; // matches the <Canvas camera fov>
const MAX_FOV = 55; // cap to avoid wide-angle distortion
const MAX_SCALE = 2.1; // cap how far we dolly the camera back

function computeFit(aspect: number): { fov: number; scale: number } {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= BASE_ASPECT) {
    return { fov: BASE_FOV, scale: 1 };
  }
  const baseV = THREE.MathUtils.degToRad(BASE_FOV);
  // Horizontal half-angle we want to keep constant across aspect ratios.
  const desiredHHalf = Math.atan(Math.tan(baseV / 2) * BASE_ASPECT);
  const vNeeded = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(desiredHHalf) / aspect),
  );
  const fov = Math.min(vNeeded, MAX_FOV);
  const cappedV = THREE.MathUtils.degToRad(fov);
  const achievedHHalf = Math.atan(Math.tan(cappedV / 2) * aspect);
  const scale = Math.min(
    Math.max(Math.tan(desiredHHalf) / Math.tan(achievedHHalf), 1),
    MAX_SCALE,
  );
  return { fov, scale };
}

/** Keeps the perspective FOV (and, in orbit, the camera distance) framed for
 *  the current viewport aspect so phones aren't zoomed-in. */
function ResponsiveCamera({ mode }: { mode: TwinMode }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const { fov, scale } = computeFit(size.width / size.height);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    if (mode === "orbit") {
      const baseDist = Math.sqrt(8 * 8 + 2 * 2 + 8 * 8);
      const dir =
        cam.position.lengthSq() > 1e-4
          ? cam.position.clone().normalize()
          : new THREE.Vector3(8, 2, 8).normalize();
      cam.position.copy(dir.multiplyScalar(baseDist * scale));
    }
  }, [camera, size, mode]);
  return null;
}

/** OrbitControls with distance limits scaled for the viewport aspect. */
function OrbitRig() {
  const { size } = useThree();
  const { scale } = computeFit(size.width / size.height);
  return (
    <OrbitControls
      enablePan={false}
      minDistance={6 * scale}
      maxDistance={18 * scale}
      maxPolarAngle={Math.PI / 1.9}
    />
  );
}

// Poly-modelled floor plate: filleted vertical corners + a flat chamfer along
// the top/bottom edges so each slab catches a rim of light like a fabricated
// floor plate instead of a raw box. Shared across every slab (one BufferGeometry).
const SLAB_GEOMETRY = createChamferedBoxGeometry(FLOOR_W, FLOOR_HEIGHT, FLOOR_D, {
  cornerRadius: 0.18,
  edge: 0.08,
  edgeSegments: 1,
  cornerSegments: 4,
});

// A slightly rounder bevel for the foundation plinth at the tower's base.
const PLINTH_GEOMETRY = createChamferedBoxGeometry(FLOOR_W + 0.7, 0.5, FLOOR_D + 0.7, {
  cornerRadius: 0.28,
  edge: 0.14,
  edgeSegments: 3,
  cornerSegments: 5,
});

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
        geometry={SLAB_GEOMETRY}
      >
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
  const { camera, size } = useThree();
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
    // Pull the orbit radius out on narrow (portrait) viewports so the tower
    // stays fully framed instead of zoomed-in.
    const { scale } = computeFit(size.width / size.height);
    const radius = THREE.MathUtils.lerp(7.5, 5, t) * scale;
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
function ARLauncher({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
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
  detailed,
  onSelect,
}: {
  floors: Floor[];
  incidentFloorKeys: Set<string>;
  selectedKey: string | null;
  mode: TwinMode;
  walkFloorIndex: number;
  detailed: boolean;
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
      {/* Beveled foundation plinth the stack sits on (extruded + rounded bevel). */}
      <mesh geometry={PLINTH_GEOMETRY} position={[0, -FLOOR_HEIGHT / 2 - 0.32, 0]}>
        <meshStandardMaterial color="#1b2733" metalness={0.35} roughness={0.6} />
      </mesh>

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
      {/* detailed human guide beside the stack (realistic / non-pixel mode only)
          — mid-height and toward the camera so it sits in the default frame */}
      {detailed && (
        <HumanCharacter
          position={[2.9, totalHeight / 2, 2.9]}
          color="#7fe7e0"
          height={1.3}
          rotationY={-0.72}
          variant="engineer"
        />
      )}
    </group>
  );
}

export default function HabitatTwin({
  floors,
  incidents,
  selectedKey,
  mode,
  pixel = false,
  ascii = false,
  onSelect,
  onWalkthroughEnd,
}: {
  floors: Floor[];
  incidents: Incident[];
  selectedKey: string | null;
  mode: TwinMode;
  /** Retro pixel/poly mode: pixelation buffer + no detailed glTF props. */
  pixel?: boolean;
  ascii?: boolean;
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
        // Pixel mode renders to a low device-pixel-ratio buffer the browser
        // upscales nearest-neighbour (image-rendering: pixelated) for the retro
        // look; realistic mode renders crisp.
        dpr={pixel ? 0.4 : 1.6}
        className={pixel ? "[image-rendering:pixelated]" : ""}
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
          detailed={!pixel}
          onSelect={onSelect}
        />

        <ResponsiveCamera mode={mode} />

        {mode === "orbit" && <OrbitRig />}

        <WalkthroughCamera
          active={mode === "walkthrough"}
          floorCount={floors.length}
          totalHeight={totalHeight}
          onFloorChange={setWalkFloorIndex}
          onComplete={onWalkthroughEnd}
        />

        <ARLauncher containerRef={arContainerRef} />

        {/* Signature ASCII pass over the live twin. */}
        {ascii && <AsciiRenderer color resolution={0.2} />}
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 text-xs text-slate-400">
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
