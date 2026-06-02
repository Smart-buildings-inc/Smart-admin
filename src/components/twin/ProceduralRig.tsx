"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Need } from "@/lib/types";

export interface ProceduralRigProps {
  need: Need;
  /** base accent color for this floor (hex string, e.g. "#3aa0ff") */
  color: string;
  /** true when the floor is selected/pressed — intensify motion + emissive */
  active: boolean;
  /** true when the floor has an active incident — add a red alarm pulse */
  hasIncident: boolean;
  /** interior width available (X). Equipment must stay within +/- width/2. */
  width: number;
  /** interior depth available (Z). Equipment must stay within +/- depth/2. */
  depth: number;
  /** interior height available (Y). Equipment sits from y=0 (platform top) up to <= height. */
  height: number;
  /** optional seed so repeated floors of same need look slightly different */
  seed?: number;
}

const MARGIN = 0.1;

/** Deterministic pseudo-random generator seeded per-floor. */
function makeRng(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Shared incident-pulse helper: applies a red alarm overlay to a material. */
function applyEmissive(
  mat: THREE.MeshStandardMaterial | null | undefined,
  baseColor: THREE.Color,
  baseIntensity: number,
  hasIncident: boolean,
  t: number,
  tmp: THREE.Color,
) {
  if (!mat) return;
  if (hasIncident) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    tmp.copy(baseColor).lerp(RED, pulse);
    mat.emissive.copy(tmp);
    mat.emissiveIntensity = baseIntensity + pulse * 0.9;
  } else {
    mat.emissive.copy(baseColor);
    mat.emissiveIntensity = baseIntensity;
  }
}

const RED = new THREE.Color("#ff3b30");

// ---------------------------------------------------------------------------
// WATER
// ---------------------------------------------------------------------------
function WaterRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const rng = useMemo(() => makeRng(seed + 1), [seed]);
  const tankCount = useMemo(() => (rng() > 0.5 ? 3 : 2), [rng]);

  const tanks = useMemo(() => {
    const r = makeRng(seed + 7);
    const usableW = width - MARGIN * 2;
    const radius = Math.min(0.28, usableW / (tankCount * 2.4));
    const tankH = height * 0.82;
    return Array.from({ length: tankCount }, (_, i) => {
      const x = -usableW / 2 + radius + (usableW - radius * 2) * (i / Math.max(1, tankCount - 1));
      const z = (r() - 0.5) * (depth - MARGIN * 2 - radius * 2);
      return { x, z, radius, tankH, phase: r() * Math.PI * 2 };
    });
  }, [seed, width, depth, height, tankCount]);

  const bubbleCount = 40;
  const bubbleData = useMemo(() => {
    const r = makeRng(seed + 13);
    return Array.from({ length: bubbleCount }, () => {
      const tank = tanks[Math.floor(r() * tanks.length)];
      return {
        x: tank.x + (r() - 0.5) * tank.radius * 1.2,
        z: tank.z + (r() - 0.5) * tank.radius * 1.2,
        baseY: r() * tank.tankH,
        top: tank.tankH,
        speed: 0.2 + r() * 0.3,
        scale: 0.015 + r() * 0.02,
      };
    });
  }, [seed, tanks]);

  const groupRef = useRef<THREE.Group>(null);
  const bandRefs = useRef<(THREE.Mesh | null)[]>([]);
  const impellerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bubblesRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;
    const baseI = active ? 0.9 : 0.45;

    tanks.forEach((tank, i) => {
      const band = bandRefs.current[i];
      if (band) {
        const bob = (0.5 + 0.4 * Math.sin(t * speed + tank.phase)) * tank.tankH;
        band.position.y = bob;
        applyEmissive(
          band.material as THREE.MeshStandardMaterial,
          base,
          baseI,
          hasIncident,
          t,
          tmp,
        );
      }
      const imp = impellerRefs.current[i];
      if (imp) imp.rotation.y += 0.05 * speed;
    });

    const bm = bubblesRef.current;
    if (bm) {
      for (let i = 0; i < bubbleData.length; i++) {
        const b = bubbleData[i];
        const y = (b.baseY + t * b.speed * speed) % b.top;
        dummy.position.set(b.x, y, b.z);
        dummy.scale.setScalar(b.scale);
        dummy.updateMatrix();
        bm.setMatrixAt(i, dummy.matrix);
      }
      bm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {tanks.map((tank, i) => (
        <group key={i} position={[tank.x, 0, tank.z]}>
          <mesh position={[0, tank.tankH / 2, 0]}>
            <cylinderGeometry args={[tank.radius, tank.radius, tank.tankH, 20]} />
            <meshStandardMaterial
              color="#9fb6c4"
              metalness={0.7}
              roughness={0.3}
              transparent
              opacity={0.55}
            />
          </mesh>
          <mesh ref={(m) => { bandRefs.current[i] = m; }} position={[0, tank.tankH * 0.5, 0]}>
            <cylinderGeometry args={[tank.radius * 1.04, tank.radius * 1.04, 0.06, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
          </mesh>
          <mesh ref={(m) => { impellerRefs.current[i] = m; }} position={[0, tank.tankH + 0.04, 0]}>
            <cylinderGeometry args={[tank.radius * 0.9, tank.radius * 0.9, 0.04, 6]} />
            <meshStandardMaterial color="#c8d4dc" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {tanks.slice(0, tanks.length - 1).map((tank, i) => {
        const next = tanks[i + 1];
        const mx = (tank.x + next.x) / 2;
        const mz = (tank.z + next.z) / 2;
        return (
          <mesh key={`pipe-${i}`} position={[mx, tank.tankH * 0.3, mz]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(0.12, Math.abs(next.x - tank.x) / 2), 0.025, 8, 24]} />
            <meshStandardMaterial color="#7d8b95" metalness={0.6} roughness={0.4} />
          </mesh>
        );
      })}
      <instancedMesh ref={bubblesRef} args={[undefined, undefined, bubbleCount]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial color="#d6f0ff" emissive="#8fd0ff" emissiveIntensity={0.6} transparent opacity={0.7} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// ENERGY
// ---------------------------------------------------------------------------
function EnergyRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cols = 5;
  const rows = 4;
  const panelCount = cols * rows;

  const arrayLayout = useMemo(() => {
    const usableW = width - MARGIN * 2;
    const usableD = depth * 0.5;
    const cw = usableW / cols;
    const cd = usableD / rows;
    return { usableW, usableD, cw, cd };
  }, [width, depth]);

  const turbine = useMemo(() => {
    const r = makeRng(seed + 3);
    return {
      x: width / 2 - MARGIN - 0.2,
      z: -depth / 2 + MARGIN + 0.2,
      mastH: height * 0.85,
      phase: r() * Math.PI * 2,
    };
  }, [seed, width, depth, height]);

  const ledCount = 5;

  const panelsRef = useRef<THREE.InstancedMesh>(null);
  const arrayGroup = useRef<THREE.Group>(null);
  const bladesRef = useRef<THREE.Group>(null);
  const ledRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;
    const baseI = active ? 1.0 : 0.5;

    if (arrayGroup.current) {
      // track the "sun" — tilt array about X over time
      arrayGroup.current.rotation.x = -0.5 + 0.25 * Math.sin(t * 0.2 * speed);
    }

    const pm = panelsRef.current;
    if (pm) {
      const { usableW, usableD, cw, cd } = arrayLayout;
      let i = 0;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = -usableW / 2 + cw * (c + 0.5);
          const z = -usableD / 2 + cd * (r + 0.5);
          dummy.position.set(x, 0, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(cw * 0.85, 0.02, cd * 0.85);
          dummy.updateMatrix();
          pm.setMatrixAt(i, dummy.matrix);
          i++;
        }
      }
      pm.instanceMatrix.needsUpdate = true;
    }

    if (bladesRef.current) {
      bladesRef.current.rotation.z += 0.08 * speed;
    }

    for (let i = 0; i < ledCount; i++) {
      const led = ledRefs.current[i];
      if (led) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 * speed + i * 0.6);
        applyEmissive(
          led.material as THREE.MeshStandardMaterial,
          base,
          baseI * (0.4 + pulse * 0.8),
          hasIncident,
          t,
          tmp,
        );
      }
    }
  });

  return (
    <group>
      {/* tilted solar array, mounted up high */}
      <group ref={arrayGroup} position={[0, height * 0.7, depth * 0.1]} rotation={[-0.5, 0, 0]}>
        <instancedMesh ref={panelsRef} args={[undefined, undefined, panelCount]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#16324f" emissive={color} emissiveIntensity={0.15} metalness={0.5} roughness={0.4} />
        </instancedMesh>
      </group>

      {/* wind turbine */}
      <group position={[turbine.x, 0, turbine.z]}>
        <mesh position={[0, turbine.mastH / 2, 0]}>
          <cylinderGeometry args={[0.025, 0.04, turbine.mastH, 10]} />
          <meshStandardMaterial color="#d4d9dd" metalness={0.5} roughness={0.5} />
        </mesh>
        <group ref={bladesRef} position={[0, turbine.mastH, 0.05]}>
          {[0, 1, 2].map((b) => (
            <mesh key={b} rotation={[0, 0, (b * Math.PI * 2) / 3]} position={[0, 0, 0]}>
              <boxGeometry args={[0.03, height * 0.4, 0.01]} />
              <meshStandardMaterial color="#eef2f5" />
            </mesh>
          ))}
        </group>
      </group>

      {/* battery cabinet with LED bars */}
      <group position={[-width / 2 + MARGIN + 0.25, 0, depth / 2 - MARGIN - 0.25]}>
        <mesh position={[0, height * 0.3, 0]}>
          <boxGeometry args={[0.4, height * 0.6, 0.3]} />
          <meshStandardMaterial color="#2b3138" metalness={0.4} roughness={0.6} />
        </mesh>
        {Array.from({ length: ledCount }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => { ledRefs.current[i] = m; }}
            position={[-0.14 + (i * 0.28) / (ledCount - 1), height * 0.3, 0.16]}
          >
            <boxGeometry args={[0.025, height * 0.45, 0.01]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// FOOD
// ---------------------------------------------------------------------------
function FoodRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const growColor = useMemo(() => new THREE.Color("#ff48d0"), []);

  const levels = useMemo(() => (makeRng(seed + 5)() > 0.5 ? 4 : 3), [seed]);
  const hasAquaponics = useMemo(() => (seed % 2) === 1, [seed]);

  const shelfW = width - MARGIN * 2 - (hasAquaponics ? 0.9 : 0);
  const shelfZ = hasAquaponics ? -depth / 4 : 0;

  const fishCount = 5;
  const fishData = useMemo(() => {
    const r = makeRng(seed + 17);
    return Array.from({ length: fishCount }, () => ({
      baseX: (r() - 0.5) * 0.5,
      z: (r() - 0.5) * 0.4,
      y: 0.1 + r() * 0.3,
      amp: 0.2 + r() * 0.15,
      speed: 0.5 + r() * 0.6,
      phase: r() * Math.PI * 2,
    }));
  }, [seed]);

  const stripRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fanRef = useRef<THREE.Mesh>(null);
  const fishRef = useRef<THREE.InstancedMesh>(null);

  const tankX = width / 2 - MARGIN - 0.35;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;
    const baseI = active ? 1.2 : 0.7;

    for (let i = 0; i < levels; i++) {
      const strip = stripRefs.current[i];
      if (strip) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 2 * speed + i * 0.8);
        applyEmissive(
          strip.material as THREE.MeshStandardMaterial,
          growColor,
          baseI * pulse,
          hasIncident,
          t,
          tmp,
        );
      }
    }

    if (fanRef.current) fanRef.current.rotation.z += 0.2 * speed;

    const fm = fishRef.current;
    if (fm) {
      for (let i = 0; i < fishData.length; i++) {
        const f = fishData[i];
        const x = tankX + f.baseX + Math.sin(t * f.speed * speed + f.phase) * f.amp;
        dummy.position.set(x, f.y, shelfZ + depth / 4 + f.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.09, 0.04, 0.04);
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      }
      fm.instanceMatrix.needsUpdate = true;
    }
  });

  const shelfSpacing = (height * 0.85) / levels;

  return (
    <group>
      {/* grow-shelf rack */}
      <group position={[hasAquaponics ? -width / 2 + MARGIN + shelfW / 2 + 0.1 : 0, 0, shelfZ]}>
        {Array.from({ length: levels }, (_, i) => {
          const y = shelfSpacing * (i + 1);
          return (
            <group key={i}>
              <mesh position={[0, y, 0]}>
                <boxGeometry args={[shelfW, 0.03, depth * 0.5]} />
                <meshStandardMaterial color="#5a6b3f" roughness={0.8} />
              </mesh>
              <mesh
                ref={(m) => { stripRefs.current[i] = m; }}
                position={[0, y - 0.06, 0]}
              >
                <boxGeometry args={[shelfW * 0.9, 0.02, 0.05]} />
                <meshStandardMaterial color="#ff48d0" emissive="#ff48d0" emissiveIntensity={0.7} />
              </mesh>
            </group>
          );
        })}
        {/* uprights */}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[(sx * shelfW) / 2, (height * 0.85) / 2, 0]}>
            <boxGeometry args={[0.03, height * 0.85, 0.03]} />
            <meshStandardMaterial color="#3a4530" />
          </mesh>
        ))}
      </group>

      {/* circulation fan */}
      <mesh ref={fanRef} position={[0, height * 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 4]} />
        <meshStandardMaterial color="#c8ccd0" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* aquaponics tank variant */}
      {hasAquaponics && (
        <group>
          <mesh position={[tankX, height * 0.25, depth / 4]}>
            <boxGeometry args={[0.6, height * 0.4, depth * 0.4]} />
            <meshStandardMaterial color="#3a9fd8" transparent opacity={0.25} metalness={0.2} roughness={0.1} />
          </mesh>
          <instancedMesh ref={fishRef} args={[undefined, undefined, fishCount]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ff9f43" emissive="#ff9f43" emissiveIntensity={0.3} />
          </instancedMesh>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// SHELTER
// ---------------------------------------------------------------------------
function ShelterRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const warm = useMemo(() => new THREE.Color("#ffca73"), []);
  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  const cols = 6;
  const rows = 3;
  const windowCount = cols * rows;

  const layout = useMemo(() => {
    const usableW = width - MARGIN * 2;
    const usableH = height * 0.9;
    return {
      usableW,
      usableH,
      cw: usableW / cols,
      ch: usableH / rows,
      z: depth / 2 - MARGIN - 0.02,
    };
  }, [width, height, depth]);

  const windowMeta = useMemo(() => {
    const r = makeRng(seed + 23);
    return Array.from({ length: windowCount }, () => ({
      phase: r() * Math.PI * 2,
      speed: 0.4 + r() * 0.8,
      warmth: r(),
    }));
  }, [seed, windowCount]);

  const planterCount = 4;
  const planterData = useMemo(() => {
    const r = makeRng(seed + 29);
    return Array.from({ length: planterCount }, (_, i) => ({
      x: -width / 2 + MARGIN + 0.2 + ((width - MARGIN * 2 - 0.4) * i) / (planterCount - 1),
      z: (r() - 0.5) * (depth - MARGIN * 2 - 0.3),
    }));
  }, [seed, width, depth]);

  const facadeRef = useRef<THREE.Mesh>(null);
  const windowsRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;

    const wm = windowsRef.current;
    if (wm) {
      const { usableW, usableH, cw, ch } = layout;
      let i = 0;
      for (let c = 0; c < cols; c++) {
        for (let rr = 0; rr < rows; rr++) {
          const x = -usableW / 2 + cw * (c + 0.5);
          const y = ch * (rr + 0.5);
          dummy.position.set(x, y, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(cw * 0.7, ch * 0.7, 1);
          dummy.updateMatrix();
          wm.setMatrixAt(i, dummy.matrix);

          const meta = windowMeta[i];
          const flick = meta.warmth > 0.45 ? 0.5 + 0.5 * Math.sin(t * meta.speed * speed + meta.phase) : 0.05;
          let intensity = 0.15 + flick * 1.0;
          tmp.copy(warm);
          if (hasIncident) {
            const ip = 0.5 + 0.5 * Math.sin(t * 6);
            tmp.lerp(RED, ip);
            intensity += ip * 0.6;
          }
          wm.setColorAt(i, tmp.clone().multiplyScalar(0.3 + intensity * 0.7));
          i++;
        }
      }
      wm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
    }

    if (facadeRef.current) {
      const mat = facadeRef.current.material as THREE.MeshStandardMaterial;
      applyEmissive(mat, colorObj, active ? 0.25 : 0.1, hasIncident, t, tmp);
    }
  });

  return (
    <group>
      {/* facade slab on +Z face */}
      <mesh ref={facadeRef} position={[0, height * 0.45, layout.z - 0.03]}>
        <boxGeometry args={[width - MARGIN * 2, height * 0.9, 0.04]} />
        <meshStandardMaterial color="#3b424b" emissive={color} emissiveIntensity={0.1} roughness={0.7} />
      </mesh>
      {/* window grid */}
      <group position={[0, 0, layout.z]}>
        <instancedMesh ref={windowsRef} args={[undefined, undefined, windowCount]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={warm} emissive={warm} emissiveIntensity={0.5} toneMapped={false} />
        </instancedMesh>
      </group>
      {/* rooftop planters */}
      {planterData.map((p, i) => (
        <group key={i} position={[p.x, height * 0.92, p.z]}>
          <mesh>
            <boxGeometry args={[0.22, 0.08, 0.14]} />
            <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.12]} />
            <meshStandardMaterial color="#4caf50" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// AIR
// ---------------------------------------------------------------------------
function AirRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const atriumR = Math.min(width, depth) * 0.18;
  const atriumH = height * 0.9;

  const moteCount = 36;
  const moteData = useMemo(() => {
    const r = makeRng(seed + 31);
    return Array.from({ length: moteCount }, () => {
      const ang = r() * Math.PI * 2;
      const rad = r() * (Math.min(width, depth) / 2 - MARGIN);
      return {
        x: Math.cos(ang) * rad,
        z: Math.sin(ang) * rad,
        baseY: r() * height,
        speed: 0.15 + r() * 0.25,
        scale: 0.02 + r() * 0.025,
        sway: 0.05 + r() * 0.08,
        phase: r() * Math.PI * 2,
      };
    });
  }, [seed, width, depth, height]);

  const fanCount = 6;

  const atriumRef = useRef<THREE.Mesh>(null);
  const motesRef = useRef<THREE.InstancedMesh>(null);
  const fanRingRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;
    const baseI = active ? 0.8 : 0.4;

    if (atriumRef.current) {
      const breath = 1 + 0.06 * Math.sin(t * 0.8 * speed);
      atriumRef.current.scale.y = breath;
      applyEmissive(
        atriumRef.current.material as THREE.MeshStandardMaterial,
        base,
        baseI * (0.6 + 0.4 * Math.sin(t * 0.8 * speed)),
        hasIncident,
        t,
        tmp,
      );
    }

    const mm = motesRef.current;
    if (mm) {
      for (let i = 0; i < moteData.length; i++) {
        const m = moteData[i];
        const y = (m.baseY + t * m.speed * speed) % height;
        const sway = Math.sin(t * speed + m.phase) * m.sway;
        dummy.position.set(m.x + sway, y, m.z);
        dummy.rotation.set(t + m.phase, t * 0.5, 0);
        dummy.scale.setScalar(m.scale);
        dummy.updateMatrix();
        mm.setMatrixAt(i, dummy.matrix);
      }
      mm.instanceMatrix.needsUpdate = true;
    }

    if (fanRingRef.current) fanRingRef.current.rotation.y += 0.04 * speed;
  });

  return (
    <group>
      {/* breathing atrium column */}
      <mesh ref={atriumRef} position={[0, atriumH / 2, 0]}>
        <cylinderGeometry args={[atriumR, atriumR, atriumH, 24, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* drifting motes */}
      <instancedMesh ref={motesRef} args={[undefined, undefined, moteCount]}>
        <boxGeometry args={[1, 0.4, 1]} />
        <meshStandardMaterial color="#bff5d8" emissive="#7fe6b0" emissiveIntensity={0.5} transparent opacity={0.8} />
      </instancedMesh>

      {/* ring of fan blades around the atrium */}
      <group ref={fanRingRef} position={[0, atriumH * 0.5, 0]}>
        {Array.from({ length: fanCount }, (_, i) => {
          const ang = (i / fanCount) * Math.PI * 2;
          const rr = atriumR + 0.12;
          return (
            <mesh
              key={i}
              position={[Math.cos(ang) * rr, 0, Math.sin(ang) * rr]}
              rotation={[0, -ang, Math.PI / 4]}
            >
              <boxGeometry args={[0.12, 0.01, 0.05]} />
              <meshStandardMaterial color="#dfe8ee" metalness={0.4} roughness={0.5} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// HEALTH
// ---------------------------------------------------------------------------
function HealthRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const crossColor = useMemo(() => new THREE.Color("#ff5a5a"), []);

  const poleH = height * 0.7;

  const peopleCount = 6;
  const peopleData = useMemo(() => {
    const r = makeRng(seed + 37);
    return Array.from({ length: peopleCount }, () => ({
      x: (r() - 0.5) * (width - MARGIN * 2 - 0.4),
      z: (r() - 0.5) * (depth - MARGIN * 2 - 0.4),
      bob: r() * Math.PI * 2,
    }));
  }, [seed, width, depth]);

  const crossRef = useRef<THREE.Group>(null);
  const crossMatRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringRef = useRef<THREE.Mesh>(null);
  const peopleRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;
    const baseI = active ? 1.3 : 0.7;

    if (crossRef.current) crossRef.current.rotation.y += 0.03 * speed;
    crossMatRefs.current.forEach((m) => {
      if (m) {
        applyEmissive(
          m.material as THREE.MeshStandardMaterial,
          crossColor,
          baseI,
          hasIncident,
          t,
          tmp,
        );
      }
    });

    if (ringRef.current) {
      const cycle = (t * 0.5 * speed) % 1;
      const s = 0.2 + cycle * 1.2;
      ringRef.current.scale.set(s, s, s);
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - cycle) * 0.8;
      mat.emissiveIntensity = (1 - cycle) * (active ? 1.5 : 0.9);
    }

    const pm = peopleRef.current;
    if (pm) {
      for (let i = 0; i < peopleData.length; i++) {
        const p = peopleData[i];
        const y = 0.08 + Math.abs(Math.sin(t * speed + p.bob)) * 0.03;
        dummy.position.set(p.x, y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.05, 0.16, 0.05);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
      }
      pm.instanceMatrix.needsUpdate = true;
    }
  });

  const armColor = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group>
      {/* pole */}
      <mesh position={[0, poleH / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.04, poleH, 10]} />
        <meshStandardMaterial color="#aab2ba" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* rotating medical cross beacon */}
      <group ref={crossRef} position={[0, poleH + 0.12, 0]}>
        <mesh ref={(m) => { crossMatRefs.current[0] = m; }}>
          <boxGeometry args={[0.22, 0.07, 0.04]} />
          <meshStandardMaterial color="#ff5a5a" emissive="#ff5a5a" emissiveIntensity={0.7} />
        </mesh>
        <mesh ref={(m) => { crossMatRefs.current[1] = m; }}>
          <boxGeometry args={[0.07, 0.22, 0.04]} />
          <meshStandardMaterial color="#ff5a5a" emissive="#ff5a5a" emissiveIntensity={0.7} />
        </mesh>
      </group>
      {/* expanding pulse ring at base */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.min(width, depth) * 0.3, 0.02, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.8} />
      </mesh>
      {/* people dots */}
      <instancedMesh ref={peopleRef} args={[undefined, undefined, peopleCount]}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color={armColor} emissive={color} emissiveIntensity={0.25} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// RESTORATION
// ---------------------------------------------------------------------------
function RestorationRig(props: ProceduralRigProps) {
  const { color, active, hasIncident, width, depth, height, seed = 0 } = props;
  const base = useMemo(() => new THREE.Color(color), [color]);
  const tmp = useMemo(() => new THREE.Color(), []);

  const poolW = width - MARGIN * 2 - 0.6;
  const poolD = depth - MARGIN * 2 - 0.6;
  const poolY = height * 0.12;

  const poolGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(poolW, poolD, 24, 24);
    return g;
  }, [poolW, poolD]);

  const basePositions = useMemo(() => {
    return (poolGeo.attributes.position.array as Float32Array).slice();
  }, [poolGeo]);

  const parasols = useMemo(() => {
    const r = makeRng(seed + 41);
    return [
      { x: width / 2 - MARGIN - 0.25, z: depth / 2 - MARGIN - 0.25, h: r() },
      { x: -width / 2 + MARGIN + 0.25, z: -depth / 2 + MARGIN + 0.25, h: r() },
    ];
  }, [seed, width, depth]);

  const lounges = useMemo(() => {
    const r = makeRng(seed + 43);
    const n = r() > 0.5 ? 3 : 2;
    return Array.from({ length: n }, (_, i) => ({
      x: -poolW / 2 + (poolW * (i + 0.5)) / n,
      z: poolD / 2 + 0.2,
    }));
  }, [seed, poolW, poolD]);

  const poolRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = active ? 1.8 : 1;

    const pool = poolRef.current;
    if (pool) {
      const pos = pool.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = basePositions[i];
        const y = basePositions[i + 1];
        arr[i + 2] =
          Math.sin(x * 3 + t * 2 * speed) * 0.03 +
          Math.cos(y * 3 + t * 1.5 * speed) * 0.03;
      }
      pos.needsUpdate = true;
      pool.geometry.computeVertexNormals();

      applyEmissive(
        pool.material as THREE.MeshStandardMaterial,
        base,
        active ? 0.6 : 0.35,
        hasIncident,
        t,
        tmp,
      );
    }
  });

  return (
    <group>
      {/* pool basin */}
      <mesh position={[0, poolY * 0.5, 0]}>
        <boxGeometry args={[poolW + 0.12, poolY, poolD + 0.12]} />
        <meshStandardMaterial color="#d8dde2" roughness={0.8} />
      </mesh>
      {/* rippling water surface */}
      <mesh
        ref={poolRef}
        geometry={poolGeo}
        position={[0, poolY + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#2f8fd6"
          emissive="#2f8fd6"
          emissiveIntensity={0.35}
          transparent
          opacity={0.7}
          metalness={0.3}
          roughness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* parasols */}
      {parasols.map((p, i) => {
        const stemH = height * 0.55;
        return (
          <group key={i} position={[p.x, 0, p.z]}>
            <mesh position={[0, stemH / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, stemH, 8]} />
              <meshStandardMaterial color="#9aa0a6" />
            </mesh>
            <mesh position={[0, stemH, 0]}>
              <coneGeometry args={[0.3, 0.18, 12]} />
              <meshStandardMaterial color={i % 2 === 0 ? "#ff7b54" : "#ffd166"} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      {/* lounge boxes */}
      {lounges.map((l, i) => (
        <mesh key={i} position={[l.x, 0.04, l.z]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.18, 0.06, 0.4]} />
          <meshStandardMaterial color="#e9e2d0" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// DISPATCHER
// ---------------------------------------------------------------------------
export default function ProceduralRig(props: ProceduralRigProps) {
  switch (props.need) {
    case "water":
      return <WaterRig {...props} />;
    case "energy":
      return <EnergyRig {...props} />;
    case "food":
      return <FoodRig {...props} />;
    case "shelter":
      return <ShelterRig {...props} />;
    case "air":
      return <AirRig {...props} />;
    case "health":
      return <HealthRig {...props} />;
    case "restoration":
      return <RestorationRig {...props} />;
    default:
      return null;
  }
}
