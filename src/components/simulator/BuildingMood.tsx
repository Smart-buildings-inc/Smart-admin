"use client";

// Paradigm 8 — The building has a mood.
//
// Ambient + hemisphere light shift as the building's health changes.
// "serene" → warm, bright. "critical" → cold, dim, with red floor accent glow.
// Also drives a subtle fog colour / density shift so the *air* feels different.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneStore, type SceneMood } from "@/lib/scene-store";

// Mood → colour/intensity targets
const MOOD_LIGHT: Record<
  SceneMood,
  { hemiTop: string; lightMultiplier: number; fogColour: string }
> = {
  serene: { hemiTop: "#4fc3f7", lightMultiplier: 1.05, fogColour: "#122942" },
  calm: { hemiTop: "#3a8ecf", lightMultiplier: 1, fogColour: "#0b1622" },
  concerned: { hemiTop: "#c98a3a", lightMultiplier: 0.88, fogColour: "#1a1410" },
  critical: { hemiTop: "#cf3a3a", lightMultiplier: 0.72, fogColour: "#1a0a0a" },
};

export default function BuildingMood({ night }: { night: boolean }) {
  const { scene } = useThree();
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.Fog | null>(null);
  const targetRef = useRef(MOOD_LIGHT.calm);
  const currentMultiplier = useRef(1);

  // Grab the lights that the Canvas already sets up — they won't have refs
  // in BuildingSimulator, so we locate the first hemisphere/ambient in the scene.
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.HemisphereLight && !hemiRef.current) {
        hemiRef.current = child;
      }
      if (child instanceof THREE.AmbientLight && !ambRef.current) {
        ambRef.current = child;
      }
    });
    fogRef.current = scene.fog as THREE.Fog;
  }, [scene]);

  // Subscribe to mood changes
  useEffect(() => {
    return sceneStore.subscribe(() => {
      const { mood } = sceneStore.getState();
      targetRef.current = MOOD_LIGHT[mood];
    });
  }, []);

  // Smoothly interpolate towards target
  useFrame((_, delta) => {
    const speed = Math.min(delta * 2.5, 0.12);
    const t = targetRef.current;
    currentMultiplier.current +=
      (t.lightMultiplier - currentMultiplier.current) * speed;
    const baseHemi = night ? 0.5 : 0.72;
    const baseAmbient = night ? 0.18 : 0.28;

    // Apply to lights
    if (hemiRef.current) {
      hemiRef.current.intensity = baseHemi * currentMultiplier.current;
      hemiRef.current.color.lerp(new THREE.Color(t.hemiTop), speed);
    }
    if (ambRef.current) {
      ambRef.current.intensity = baseAmbient * currentMultiplier.current;
    }
    // Fog
    if (fogRef.current) {
      if (fogRef.current.color.getHexString() !== t.fogColour.slice(1)) {
        const col = new THREE.Color(t.fogColour);
        fogRef.current.color.lerp(col, speed);
      }
    }
  });

  return null;
}
