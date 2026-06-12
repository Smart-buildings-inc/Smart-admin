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
  { hemiTop: string; hemiIntensity: number; ambIntensity: number; fogColour: string }
> = {
  serene: { hemiTop: "#4fc3f7", hemiIntensity: 1.0, ambIntensity: 0.55, fogColour: "#1a3a5c" },
  calm: { hemiTop: "#3a8ecf", hemiIntensity: 0.85, ambIntensity: 0.45, fogColour: "#0b1622" },
  concerned: { hemiTop: "#c98a3a", hemiIntensity: 0.7, ambIntensity: 0.35, fogColour: "#1a1410" },
  critical: { hemiTop: "#cf3a3a", hemiIntensity: 0.5, ambIntensity: 0.22, fogColour: "#1a0a0a" },
};

export default function BuildingMood() {
  const { scene } = useThree();
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.Fog | null>(null);
  const targetRef = useRef(MOOD_LIGHT.calm);
  const currentRef = useRef(MOOD_LIGHT.calm);

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
    const c = currentRef.current;

    // Lerp each numeric field
    c.hemiIntensity += (t.hemiIntensity - c.hemiIntensity) * speed;
    c.ambIntensity += (t.ambIntensity - c.ambIntensity) * speed;

    // Apply to lights
    if (hemiRef.current) {
      hemiRef.current.intensity = c.hemiIntensity;
      if (c.hemiTop !== t.hemiTop) {
        c.hemiTop = t.hemiTop;
        hemiRef.current.color.set(t.hemiTop);
      }
    }
    if (ambRef.current) {
      ambRef.current.intensity = c.ambIntensity;
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
