"use client";

// Paradigm 3 — Time travel as a first-class gesture.
//
// Advances scene time via useFrame. The SimulatorView DOM chrome renders
// the slider; this R3F component runs the clock and updates the shared store.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { sceneStore } from "@/lib/scene-store";

/** How many seconds of real time equal one full day cycle at speed=1. */
const DAY_CYCLE_SECONDS = 120; // 2 minutes = full day

export default function SceneTime() {
  const lastTime = useRef(performance.now() / 1000);

  useFrame(() => {
    const now = performance.now() / 1000;
    const dt = Math.min(now - lastTime.current, 0.1); // cap to avoid spiral
    lastTime.current = now;

    const { timeSpeed, timeOfDay } = sceneStore.getState();
    if (timeSpeed <= 0) return; // paused

    const delta = (dt * timeSpeed) / DAY_CYCLE_SECONDS;
    const next = ((timeOfDay + delta) % 1 + 1) % 1;
    if (Math.abs(next - timeOfDay) > 0.00001) {
      sceneStore.setState({ timeOfDay: next, _prevTimeOfDay: timeOfDay });
    }
  });

  return null; // invisible; only drives state
}
