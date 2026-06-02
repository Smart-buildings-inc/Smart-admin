"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  Environment,
  Lightformer,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Incident } from "@/lib/types";
import { needColor } from "@/lib/ui";
import { annotationByFloor } from "@/lib/annotations";

export type TwinMode = "orbit" | "walkthrough";

/**
 * "standard" — the original flat 3-light rig (cheap, always available).
 * "cinematic" — image-based lighting via a procedural HDRI environment
 * (Lightformers, no external assets so it stays local-first), soft contact
 * shadows for grounded ambient occlusion, plus a real shadow-casting key light.
 */
export type ShadingMode = "standard" | "cinematic";

/** Which scene the twin renders: the habitat tower, or the site/location mimic. */
export type SceneKind = "habitat" | "site";

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
        castShadow
        receiveShadow
      >
        <boxGeometry args={[FLOOR_W, FLOOR_HEIGHT, FLOOR_D]} />
        <meshStandardMaterial
          color={base}
          emissive={hasIncident ? "#ff5d5d" : base}
          emissiveIntensity={0.12}
          metalness={0.2}
          roughness={0.45}
          envMapIntensity={0.9}
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

/**
 * Procedural HDRI: a set of Lightformers arranged like a sky dome + studio
 * rig. drei renders these into an off-screen cube map used for image-based
 * lighting, giving soft realistic ambience and reflections with zero external
 * .hdr assets (keeps the app offline / local-first).
 */
function CinematicHdri() {
  return (
    <group>
      {/* Sky / overhead fill */}
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#bcd4ff"
        position={[0, 12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[30, 30, 1]}
      />
      {/* Warm key from one side */}
      <Lightformer
        form="rect"
        intensity={2.2}
        color="#fff0d2"
        position={[10, 6, 8]}
        rotation={[0, -Math.PI / 4, 0]}
        scale={[12, 12, 1]}
      />
      {/* Cool sky fill from the opposite side */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#5e8bff"
        position={[-12, 4, -6]}
        rotation={[0, Math.PI / 3, 0]}
        scale={[14, 14, 1]}
      />
      {/* Subtle ground bounce */}
      <Lightformer
        form="rect"
        intensity={0.4}
        color="#1a2530"
        position={[0, -8, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[30, 30, 1]}
      />
    </group>
  );
}

/** Deterministic LCG so the scattered geometry is stable across renders. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** A single stylised conifer (cone canopy + trunk). */
function Conifer({
  position,
  scale,
}: {
  position: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.5, 6]} />
        <meshStandardMaterial color="#3b2c1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.55, 1.6, 8]} />
        <meshStandardMaterial color="#1f3d24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.38, 1.1, 8]} />
        <meshStandardMaterial color="#264a2c" roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * A stylised mimic of the user's waterfront: Georgian Bay shoreline near
 * Manitou Crescent, Tiny, ON — water, a sandy beach with rock groynes,
 * conifers, a cabin with a dark/blue gabled roof, a dock, and a pulsing
 * "you are here" marker. Authored entirely in three.js (no GLTF / map tiles)
 * to stay local-first; not a survey-accurate model.
 */
function SiteScene({ cinematic }: { cinematic: boolean }) {
  const markerRef = useRef<THREE.Group>(null);
  const waterEnv = cinematic ? 1.0 : 0.0;

  // Static scatter computed once.
  const { trees, groyneA, groyneB, dockPosts } = useMemo(() => {
    const rng = makeRng(20260602);
    const trees: { position: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const x = (rng() - 0.5) * 44;
      const z = 2 + rng() * 18; // grass side only
      // Leave a clearing around the cabin.
      if (Math.abs(x) < 4 && z < 6) continue;
      trees.push({ position: [x, 0, z], scale: 0.7 + rng() * 0.9 });
    }
    const line = (
      startX: number,
      startZ: number,
      dx: number,
      dz: number,
      n: number,
    ) =>
      Array.from({ length: n }, (_, i) => ({
        position: [
          startX + dx * i + (rng() - 0.5) * 0.4,
          0.12,
          startZ + dz * i + (rng() - 0.5) * 0.4,
        ] as [number, number, number],
        scale: 0.4 + rng() * 0.5,
      }));
    return {
      trees,
      groyneA: line(-13, -1, -0.9, -1.4, 10),
      groyneB: line(-2, -1, -0.7, -1.5, 11),
      dockPosts: Array.from({ length: 6 }, (_, i) => i),
    };
  }, []);

  useFrame((state) => {
    if (!markerRef.current) return;
    const t = state.clock.elapsedTime;
    markerRef.current.position.y = 2.4 + Math.sin(t * 2) * 0.12;
    const halo = markerRef.current.children[1] as THREE.Mesh | undefined;
    if (halo) {
      const s = 1 + (Math.sin(t * 2) + 1) * 0.35;
      halo.scale.setScalar(s);
      const mat = halo.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 - (Math.sin(t * 2) + 1) * 0.18;
    }
  });

  return (
    <group>
      {/* Water (Georgian Bay) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -16]}
        receiveShadow
      >
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial
          color="#2f6f6a"
          roughness={0.12}
          metalness={0.0}
          envMapIntensity={waterEnv}
        />
      </mesh>

      {/* Sandy beach strip */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0.6]}
        receiveShadow
      >
        <planeGeometry args={[80, 6]} />
        <meshStandardMaterial color="#d8c39a" roughness={0.95} />
      </mesh>

      {/* Grass / forest floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 18]}
        receiveShadow
      >
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#28401f" roughness={0.95} />
      </mesh>

      {/* Rock groynes / breakwaters reaching into the bay */}
      {[...groyneA, ...groyneB].map((r, i) => (
        <mesh key={`rock-${i}`} position={r.position} scale={r.scale} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#6c6a63" roughness={1} flatShading />
        </mesh>
      ))}

      {/* Conifers */}
      {trees.map((t, i) => (
        <Conifer key={`tree-${i}`} position={t.position} scale={t.scale} />
      ))}

      {/* Cabin with dark/blue gabled roof */}
      <group position={[0, 0, 4]}>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 1.4, 2.4]} />
          <meshStandardMaterial color="#cdbfa6" roughness={0.8} />
        </mesh>
        {/* Gabled roof (rotated box prism) */}
        <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <cylinderGeometry args={[1.6, 1.6, 2.7, 4, 1]} />
          <meshStandardMaterial color="#26344f" roughness={0.6} metalness={0.1} envMapIntensity={waterEnv} />
        </mesh>
        {/* Door */}
        <mesh position={[0, 0.5, 1.21]}>
          <planeGeometry args={[0.6, 1.0]} />
          <meshStandardMaterial color="#3a2c1d" roughness={0.8} />
        </mesh>
      </group>

      {/* Dock reaching out into the water (upper-right of the photo) */}
      <group position={[12, 0, 0]}>
        <mesh position={[0, 0.35, -6]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.15, 13]} />
          <meshStandardMaterial color="#7a5c3a" roughness={0.9} />
        </mesh>
        {dockPosts.map((i) => (
          <mesh key={`post-${i}`} position={[0.6, 0.05, -1 - i * 2]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.8, 6]} />
            <meshStandardMaterial color="#4a3623" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* "You are here" marker — the blue location dot from Maps */}
      <group ref={markerRef} position={[0, 2.4, 4]}>
        <mesh castShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial
            color="#2f7bff"
            emissive="#2f7bff"
            emissiveIntensity={0.8}
            roughness={0.3}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshBasicMaterial color="#67a8ff" transparent opacity={0.4} />
        </mesh>
        <Html position={[0, 0.6, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="annotation whitespace-nowrap rounded-md px-2 py-1 text-xs text-white">
            You are here · 35 Manitou Crescent
          </div>
        </Html>
      </group>
    </group>
  );
}

export default function HabitatTwin({
  floors,
  incidents,
  selectedKey,
  mode,
  shading = "standard",
  scene = "habitat",
  onSelect,
  onWalkthroughEnd,
}: {
  floors: Floor[];
  incidents: Incident[];
  selectedKey: string | null;
  mode: TwinMode;
  shading?: ShadingMode;
  scene?: SceneKind;
  onSelect: (key: string | null) => void;
  onWalkthroughEnd: () => void;
}) {
  const arContainerRef = useRef<HTMLDivElement>(null);
  const [walkFloorIndex, setWalkFloorIndex] = useState(-1);
  const totalHeight = floors.length * STEP;
  const cinematic = shading === "cinematic";
  // Walk-through + descent only make sense for the habitat tower.
  const walkActive = scene === "habitat" && mode === "walkthrough";

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
        shadows={cinematic}
        onPointerMissed={() => mode === "orbit" && onSelect(null)}
      >
        {cinematic ? (
          <>
            {/* Image-based lighting from a procedural HDRI (no external assets,
                so it works fully offline / local-first). */}
            <Environment resolution={256} background={false}>
              <CinematicHdri />
            </Environment>
            <ambientLight intensity={0.18} />
            {/* Shadow-casting key light for crisp, grounded shadows. */}
            <directionalLight
              position={[8, 14, 8]}
              intensity={1.3}
              color="#fff3da"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0005}
              shadow-camera-near={1}
              shadow-camera-far={60}
              shadow-camera-left={-16}
              shadow-camera-right={16}
              shadow-camera-top={16}
              shadow-camera-bottom={-16}
            />
            <directionalLight position={[-6, -2, -6]} intensity={0.25} color="#4ea8ff" />
          </>
        ) : (
          <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[6, 10, 6]} intensity={1.1} />
            <directionalLight position={[-6, -4, -6]} intensity={0.3} color="#4ea8ff" />
          </>
        )}

        {scene === "site" ? (
          <SiteScene cinematic={cinematic} />
        ) : (
          <Tower
            floors={floors}
            incidentFloorKeys={incidentFloorKeys}
            selectedKey={selectedKey}
            mode={mode}
            walkFloorIndex={walkFloorIndex}
            onSelect={onSelect}
          />
        )}

        {/* Soft contact shadows double as ambient occlusion against the ground. */}
        {cinematic && (
          <ContactShadows
            position={[0, scene === "site" ? -0.02 : -totalHeight / 2 - 0.5, 0]}
            scale={scene === "site" ? 48 : 14}
            far={scene === "site" ? 20 : 12}
            blur={2.6}
            opacity={0.55}
            resolution={1024}
            color="#05080c"
          />
        )}

        {(mode === "orbit" || scene === "site") && (
          <OrbitControls
            enablePan
            screenSpacePanning={false}
            minDistance={scene === "site" ? 4 : 6}
            maxDistance={scene === "site" ? 60 : 18}
            maxPolarAngle={Math.PI / 1.9}
          />
        )}

        <WalkthroughCamera
          active={walkActive}
          floorCount={floors.length}
          totalHeight={totalHeight}
          onFloorChange={setWalkFloorIndex}
          onComplete={onWalkthroughEnd}
        />

        <ARLauncher containerRef={arContainerRef} />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 text-xs text-slate-400">
        <div className="display text-sm text-slate-200">
          {scene === "site" ? "Site · Georgian Bay shoreline" : "ATLAS‑01 · Habitat Twin"}
        </div>
        <div>
          {scene === "site"
            ? "Manitou Crescent, Tiny ON · orbit · drag to pan"
            : walkActive
              ? "Descending — rooftop pool to the underground core…"
              : "Orbit to inspect · drag to pan · tap a floor"}
        </div>
      </div>

      {/* WebXR "Enter AR" button mounts here when supported. */}
      <div ref={arContainerRef} className="absolute bottom-4 right-4 z-10" />
    </div>
  );
}
