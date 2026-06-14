"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Floor, Incident } from "@/lib/types";
import type { CharacterProfile, Vec3 } from "@/lib/character-profiles";

type Activity =
  | "walking"
  | "working"
  | "inspecting"
  | "idle"
  | "traveling";

interface CharacterState {
  waypointIndex: number;
  t: number;
  activity: Activity;
  activityTimer: number;
  visitFloor: string | null;
  visitPhase: "going" | "there" | "returning" | null;
  visitProgress: number;
  bodyPhase: number;
}

const FLOOR_H = 1.5;
const SLAB_T = 0.16;
const STEP = FLOOR_H + SLAB_T;
const CORE_X = 3.4;
const CORE_Z = -1.9;
const ELEVATOR_POS: Vec3 = [CORE_X, 0, CORE_Z];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function dist2D(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2);
}

// ── Static detailed character (no self-animation — CharacterAI owns positioning) ──
function StaticHumanBody({
  color,
  variant,
  bodyPhase,
}: {
  color: string;
  variant: "resident" | "greeter" | "engineer";
  bodyPhase: number;
}) {
  const SKIN_TONES = ["#f2c7a3", "#c88a65", "#9a6a4e"];
  const HAIR_COLORS = ["#171311", "#3a2a20", "#8c6239"];
  const skin = SKIN_TONES[bodyPhase % SKIN_TONES.length];
  const hair = HAIR_COLORS[(bodyPhase + 1) % HAIR_COLORS.length];
  const shirtColor = variant === "engineer" ? "#cfd8e3" : color;

  return (
    <group>
      {/* legs */}
      <mesh position={[-0.075, 0.24, 0]}>
        <cylinderGeometry args={[0.036, 0.046, 0.38, 10]} />
        <meshStandardMaterial color="#26323d" roughness={0.72} />
      </mesh>
      <mesh position={[0.075, 0.24, 0]}>
        <cylinderGeometry args={[0.036, 0.046, 0.38, 10]} />
        <meshStandardMaterial color="#26323d" roughness={0.72} />
      </mesh>
      {/* hips */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.22, 0.1, 0.16]} />
        <meshStandardMaterial color="#26323d" roughness={0.74} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.14, 0.17, 0.36, 10]} />
        <meshStandardMaterial color={shirtColor} roughness={0.65} />
      </mesh>
      {/* jacket/vest for greeter/engineer */}
      {(variant === "greeter" || variant === "engineer") && (
        <mesh position={[0, 0.66, 0.093]}>
          <boxGeometry args={[0.2, 0.24, 0.018]} />
          <meshStandardMaterial
            color={variant === "engineer" ? "#f0b84f" : "#102a36"}
            roughness={0.62}
          />
        </mesh>
      )}
      {/* left arm */}
      <group position={[-0.18, 0.78, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.03, 0.038, 0.3, 10]} />
          <meshStandardMaterial color={shirtColor} roughness={0.68} />
        </mesh>
        <mesh position={[0, -0.31, 0]}>
          <sphereGeometry args={[0.044, 12, 8]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
      {/* right arm */}
      <group position={[0.18, 0.78, 0]} rotation={[0, 0, -0.2]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.03, 0.038, 0.3, 10]} />
          <meshStandardMaterial color={shirtColor} roughness={0.68} />
        </mesh>
        <mesh position={[0, -0.31, 0]}>
          <sphereGeometry args={[0.044, 12, 8]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
      {/* neck */}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.045, 0.04, 0.08, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.0, 0.005]}>
        <sphereGeometry args={[0.13, 18, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>
      {/* hair */}
      <mesh position={[0, 1.04, -0.012]}>
        <sphereGeometry args={[0.132, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.76} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.043, 1.01, 0.114]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshStandardMaterial color="#111827" roughness={0.4} />
      </mesh>
      <mesh position={[0.043, 1.01, 0.114]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshStandardMaterial color="#111827" roughness={0.4} />
      </mesh>
      {/* mouth */}
      <mesh position={[0, 0.965, 0.124]}>
        <boxGeometry args={[0.055, 0.009, 0.012]} />
        <meshStandardMaterial color="#7c3f34" roughness={0.7} />
      </mesh>
      {/* engineer hard hat */}
      {variant === "engineer" && (
        <mesh position={[0, 1.105, 0.012]}>
          <sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#f0b84f" roughness={0.55} metalness={0.02} />
        </mesh>
      )}
      {/* greeter clipboard */}
      {variant === "greeter" && (
        <mesh position={[0.15, 0.58, 0.13]} rotation={[0.18, 0.25, -0.14]}>
          <boxGeometry args={[0.16, 0.2, 0.018]} />
          <meshStandardMaterial color="#101923" roughness={0.55} metalness={0.2} />
        </mesh>
      )}
    </group>
  );
}

// ── Individual AI character ──
function Character({
  profile,
  homeFloorIndex,
  floors,
  floorKeys,
  incidents,
  detailed,
  pixel,
  selected,
  onClick,
  activityRef,
}: {
  profile: CharacterProfile;
  homeFloorIndex: number;
  floors: Floor[];
  floorKeys: string[];
  incidents: Incident[];
  detailed: boolean;
  pixel: boolean;
  selected: boolean;
  onClick: (id: string) => void;
  activityRef: React.MutableRefObject<Map<string, string>>;
}) {
  const root = useRef<THREE.Group>(null);
  const bodyRoot = useRef<THREE.Group>(null);
  const state = useRef<CharacterState>({
    waypointIndex: 0,
    t: 0,
    activity: "walking",
    activityTimer: 0,
    visitFloor: null,
    visitPhase: null,
    visitProgress: 0,
    bodyPhase: profile.id.charCodeAt(0) + profile.id.charCodeAt(profile.id.length - 1),
  });

  const floorY = homeFloorIndex * STEP;

  // Pick incident for maintenance characters
  const activeIncident = useMemo(() => {
    if (profile.role !== "maintenance" && profile.role !== "water-engineer" && profile.role !== "air-tech") return null;
    return incidents.find((i) => i.severity === "crit" || i.severity === "warn") ?? null;
  }, [incidents, profile.role]);

  useFrame((s, dt) => {
    if (!root.current) return;
    const st = state.current;
    const speed = profile.speed * 2.2;
    const clampedDt = Math.min(dt, 0.05);

    // Trigger incident response
    if (activeIncident && st.visitPhase === null && Math.random() < 0.002) {
      const targetFloor = activeIncident.floorKey;
      if (targetFloor && targetFloor !== profile.homeFloorKey) {
        st.visitFloor = targetFloor;
        st.visitPhase = "going";
        st.visitProgress = 0;
        st.activity = "traveling";
        activityRef.current.set(profile.id, `🚨 Responding to ${activeIncident.title.slice(0, 30)}`);
      }
    }

    if (st.visitPhase !== null) {
      const targetIdx = floorKeys.indexOf(st.visitFloor ?? profile.homeFloorKey);
      const targetY = targetIdx >= 0 ? targetIdx * STEP : floorY;

      switch (st.visitPhase) {
        case "going": {
          const dest: Vec3 = [ELEVATOR_POS[0], floorY, ELEVATOR_POS[2]];
          const dist = dist2D(
            [root.current.position.x, 0, root.current.position.z],
            dest,
          );
          if (dist > 0.3) {
            const dx = dest[0] - root.current.position.x;
            const dz = dest[2] - root.current.position.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            root.current.position.x += (dx / d) * speed * clampedDt;
            root.current.position.z += (dz / d) * speed * clampedDt;
            root.current.rotation.y = Math.atan2(dx, dz);
          } else {
            st.visitProgress += clampedDt * 3;
            root.current.position.y = lerp(floorY, targetY, Math.min(st.visitProgress, 1));
            if (st.visitProgress >= 1) {
              st.visitPhase = "there";
              st.visitProgress = 0;
              st.activityTimer = 3 + (st.bodyPhase % 4);
              st.activity = "inspecting";
              activityRef.current.set(profile.id, `🔧 Fixing ${activeIncident?.title.slice(0, 25) ?? "issue"}`);
            }
          }
          break;
        }
        case "there": {
          root.current.position.y = targetY;
          st.activityTimer -= clampedDt;
          if (st.activityTimer <= 0) {
            st.visitPhase = "returning";
            st.visitProgress = 0;
            activityRef.current.delete(profile.id);
          }
          break;
        }
        case "returning": {
          st.visitProgress += clampedDt * 3;
          root.current.position.y = lerp(targetY, floorY, Math.min(st.visitProgress, 1));
          if (st.visitProgress >= 1) {
            root.current.position.set(ELEVATOR_POS[0], floorY, ELEVATOR_POS[2]);
            st.visitPhase = null;
            st.visitFloor = null;
            st.activity = "walking";
            activityRef.current.delete(profile.id);
          }
          break;
        }
      }

      // Body bob while traveling/working
      if (bodyRoot.current) {
        const walkCycle = Math.sin(s.clock.elapsedTime * 4.6 + st.bodyPhase);
        bodyRoot.current.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 2.4 + st.bodyPhase)) * 0.035;
        bodyRoot.current.rotation.z = walkCycle * 0.02;
      }
      return;
    }

    // Normal waypoint patrol
    const wps = profile.waypoints;
    if (wps.length === 0) return;

    const curr = wps[st.waypointIndex];
    const nxt = wps[(st.waypointIndex + 1) % wps.length];
    const from: Vec3 = [curr[0], floorY + curr[1], curr[2]];
    const to: Vec3 = [nxt[0], floorY + nxt[1], nxt[2]];

    if (st.activity === "walking") {
      st.t += (speed * clampedDt) / Math.max(dist2D(from, to), 0.01);
      if (st.t >= 1) {
        st.t = 0;
        st.waypointIndex = (st.waypointIndex + 1) % wps.length;
        st.activity = "working";
        st.activityTimer = 1.5 + (st.bodyPhase % 5) * 0.3;
        activityRef.current.set(
          profile.id,
          profile.tasks[st.waypointIndex % profile.tasks.length],
        );
      }
      const pos = lerpVec3(from, to, Math.min(st.t, 1));
      root.current.position.set(pos[0], pos[1], pos[2]);
      const dx = to[0] - from[0];
      const dz = to[2] - from[2];
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        root.current.rotation.y = Math.atan2(dx, dz);
      }

      // Walking bob + arm sway
      if (bodyRoot.current) {
        const walkCycle = Math.sin(s.clock.elapsedTime * 4.6 + st.bodyPhase);
        bodyRoot.current.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 2.4 + st.bodyPhase)) * 0.035;
        bodyRoot.current.rotation.z = walkCycle * 0.02;
        // Swing body slightly in walk direction
        bodyRoot.current.position.x = Math.sin(s.clock.elapsedTime * 4.6 + st.bodyPhase) * 0.01;
      }
    } else if (st.activity === "working" || st.activity === "inspecting") {
      st.activityTimer -= clampedDt;
      root.current.position.set(curr[0], floorY + curr[1], curr[2]);
      // Idle bob while working
      if (bodyRoot.current) {
        bodyRoot.current.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 1.8 + st.bodyPhase)) * 0.025;
        bodyRoot.current.rotation.z = Math.sin(s.clock.elapsedTime * 1.2 + st.bodyPhase) * 0.015;
      }
      if (st.activityTimer <= 0) {
        st.activity = "walking";
        activityRef.current.delete(profile.id);
      }
    }
  });

  const CHAR_SCALE = 0.714; // scale to 0.8 units tall (53% of 1.5-unit floor, matching real-world 1.7m person in 3.2m floor)

  return (
    <group ref={root}>
      <group ref={bodyRoot} position={[0, 0, 0]} scale={CHAR_SCALE}>
        {pixel ? (
          <group>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.18, 0.24, 0.14]} />
              <meshStandardMaterial color="#2c3a47" flatShading />
            </mesh>
            <mesh position={[0, 0.36, 0]}>
              <boxGeometry args={[0.22, 0.26, 0.16]} />
              <meshStandardMaterial color={profile.color} flatShading />
            </mesh>
            <mesh position={[0, 0.56, 0]}>
              <boxGeometry args={[0.15, 0.15, 0.15]} />
              <meshStandardMaterial color="#f1c9a5" flatShading />
            </mesh>
          </group>
        ) : (
          <StaticHumanBody
            color={profile.color}
            variant={profile.variant}
            bodyPhase={state.current.bodyPhase}
          />
        )}
      </group>

      {/* Invisible click target */}
      <mesh
        position={[0, 0.6, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(profile.id);
        }}
      >
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Name label when selected */}
      {selected && (
        <Html position={[0, 1.4, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap rounded-md border border-ink-600/50 bg-ink-900/90 px-2.5 py-1.5 text-xs backdrop-blur">
            <span className="font-semibold text-white">
              {profile.emoji} {profile.name}
            </span>
            <span className="text-slate-300">{profile.role.replace("-", " ")}</span>
            <span className="max-w-[200px] text-center text-slate-400">
              {profile.purpose.slice(0, 60)}…
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Master controller — renders all characters ──
export default function CharacterAI({
  characters,
  floors,
  incidents,
  detailed,
  pixel,
  selectedCharacter,
  onSelectCharacter,
  activityRef,
}: {
  characters: CharacterProfile[];
  floors: Floor[];
  incidents: Incident[];
  detailed: boolean;
  pixel: boolean;
  selectedCharacter: string | null;
  onSelectCharacter: (id: string | null) => void;
  activityRef: React.MutableRefObject<Map<string, string>>;
}) {
  const floorKeys = useMemo(() => floors.map((f) => f.key), [floors]);

  const elements = useMemo(() => {
    return characters.map((profile) => {
      const homeIdx = floors.findIndex((f) => f.key === profile.homeFloorKey);
      if (homeIdx < 0) return null;
      return (
        <Character
          key={profile.id}
          profile={profile}
          homeFloorIndex={homeIdx}
          floors={floors}
          floorKeys={floorKeys}
          incidents={incidents}
          detailed={detailed}
          pixel={pixel}
          selected={selectedCharacter === profile.id}
          onClick={onSelectCharacter}
          activityRef={activityRef}
        />
      );
    });
  }, [characters, floors, floorKeys, incidents, detailed, pixel, selectedCharacter, onSelectCharacter, activityRef]);

  return <>{elements}</>;
}
