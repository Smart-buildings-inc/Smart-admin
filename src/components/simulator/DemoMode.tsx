"use client";

// Paradigm 10 — One-button demo mode.
//
// "Show someone ATLAS": a 60-second cinematic camera flythrough that circles
// the building, times the sunset, triggers the light cascade, then glows
// warm at night — perfectly paced, no interaction needed.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneStore } from "@/lib/scene-store";

const DEMO_DURATION = 60; // full loop in seconds

// Camera path: sequence of waypoints + timestamps (0–1)
interface Waypoint {
  t: number;              // normalised time (0–1)
  target: THREE.Vector3;
  position: THREE.Vector3;
  fov: number;
  timeOfDay: number;      // what to set scene time to
}

const WAYPOINTS: Waypoint[] = [
  // 0: Start — far establishing shot from the open (cutaway) side
  { t: 0, target: new THREE.Vector3(0, 8, 0), position: new THREE.Vector3(20, 12, 28), fov: 38, timeOfDay: 0.62 },
  // 1: Circle to front — see the full facade
  { t: 0.2, target: new THREE.Vector3(0, 7, 0), position: new THREE.Vector3(22, 10, -4), fov: 40, timeOfDay: 0.65 },
  // 2: Rooftop reveal — solar + pool
  { t: 0.35, target: new THREE.Vector3(0, 15, 0), position: new THREE.Vector3(12, 20, 14), fov: 42, timeOfDay: 0.68 },
  // 3: Pull back — see the full tower in golden light
  { t: 0.5, target: new THREE.Vector3(0, 8, 0), position: new THREE.Vector3(26, 14, 22), fov: 36, timeOfDay: 0.71 },
  // 4: Side profile — lights cascading
  { t: 0.7, target: new THREE.Vector3(0, 8, 0), position: new THREE.Vector3(-24, 12, 18), fov: 38, timeOfDay: 0.75 },
  // 5: Night glow — warm, lit building
  { t: 0.85, target: new THREE.Vector3(0, 7, 0), position: new THREE.Vector3(18, 9, 26), fov: 40, timeOfDay: 0.78 },
  // 6: Final — hover in front, building fully lit
  { t: 1, target: new THREE.Vector3(0, 7, 0), position: new THREE.Vector3(20, 12, 26), fov: 40, timeOfDay: 0.80 },
];

export default function DemoMode() {
  const { camera } = useThree();
  const { controls } = useThree((s) => ({ controls: s.controls }));
  const startTimeRef = useRef<number | null>(null);
  const prevTimeSpeed = useRef(1);
  const animRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
    timeOfDay: number;
  }>({
    pos: new THREE.Vector3(20, 12, 28),
    target: new THREE.Vector3(0, 8, 0),
    fov: 38,
    timeOfDay: 0.62,
  });

  // Find orbit controls
  useEffect(() => {
    const unsubscribe = sceneStore.subscribe(() => {
      const { isDemoMode, demoPhase } = sceneStore.getState();
      if (isDemoMode && demoPhase === "intro") {
        startTimeRef.current = performance.now() / 1000;
        prevTimeSpeed.current = 1;
      }
    });
    return unsubscribe;
  }, []);

  useFrame(() => {
    const { isDemoMode } = sceneStore.getState();
    if (!isDemoMode) return;

    const now = performance.now() / 1000;
    if (startTimeRef.current === null) return;
    const elapsed = now - startTimeRef.current;
    const t = Math.min(elapsed / DEMO_DURATION, 1);

    // Find the two surrounding waypoints
    let a = WAYPOINTS[0];
    let b = WAYPOINTS[WAYPOINTS.length - 1];
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      if (t >= WAYPOINTS[i].t && t <= WAYPOINTS[i + 1].t) {
        a = WAYPOINTS[i];
        b = WAYPOINTS[i + 1];
        break;
      }
    }

    // Interpolate between waypoints
    const seg = (t - a.t) / Math.max(0.001, b.t - a.t);
    const ease = seg * seg * (3 - 2 * seg); // smoothstep

    const pos = animRef.current.pos.lerpVectors(a.position, b.position, ease);
    const target = animRef.current.target.lerpVectors(a.target, b.target, ease);
    const fov = a.fov + (b.fov - a.fov) * ease;
    const targetTime = a.timeOfDay + (b.timeOfDay - a.timeOfDay) * ease;

    // Apply
    const pcam = camera as THREE.PerspectiveCamera;
    pcam.position.copy(pos);
    pcam.lookAt(target);
    pcam.fov = fov;
    pcam.updateProjectionMatrix();
    sceneStore.setState({ timeOfDay: targetTime });

    // Update orbit controls target
    if (controls) {
      (controls as any).target.lerp(target, 0.1);
      (controls as any).update();
    }

    // Update demo phase for UI
    const phase = t < 0.3 ? "intro" : t < 0.7 ? "sunset" : "night";
    sceneStore.setState({ demoPhase: phase as any });

    // End
    if (t >= 1) {
      sceneStore.setState({ isDemoMode: false, demoPhase: null, timeSpeed: 1 });
    }
  });

  return null;
}
