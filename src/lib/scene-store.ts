"use client";

// Lightweight reactive store for the ATLAS building simulator's global scene
// state: time-of-day, mood, demo mode. Zero dependencies — just a pub/sub
// pattern that React components subscribe to via useSyncExternalStore.

export type SceneMood = "serene" | "calm" | "concerned" | "critical";

export interface SceneState {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset */
  timeOfDay: number;
  /** Multiplier: 0 = paused, 1 = real-time-ish, 60 = fast-forward */
  timeSpeed: number;
  /** Emotional state of the building (derived from incident severity) */
  mood: SceneMood;
  /** Whether the 60s cinematic demo is running */
  isDemoMode: boolean;
  /** Phase within demo mode (null when not running) */
  demoPhase: "intro" | "sunset" | "night" | null;
  /** When true, the sunset cascade is actively playing */
  cascadeActive: boolean;
  /** Internal counter of last time-of-day crossing for edge detection */
  _prevTimeOfDay: number;
}

const defaultState: SceneState = {
  timeOfDay: 0.28, // just after sunrise — building looks best
  timeSpeed: 1,
  mood: "calm",
  isDemoMode: false,
  demoPhase: null,
  cascadeActive: false,
  _prevTimeOfDay: 0.28,
};

// ── Store implementation ──────────────────────────────────────────────

type Listener = () => void;

let state: SceneState = { ...defaultState };
const listeners = new Set<Listener>();

function setState(partial: Partial<SceneState>): void {
  const next = { ...state, ...partial };
  // Detect time-of-day crossing for sunrise/sunset edge triggers
  const prev = state._prevTimeOfDay;
  if (partial.timeOfDay !== undefined && Math.abs(partial.timeOfDay - prev) > 0.001) {
    next._prevTimeOfDay = partial.timeOfDay;
    // Detect sunset crossing (0.65 → 0.75 zone)
    const wasDusk = prev >= 0.65 && prev < 0.75;
    const isDusk = partial.timeOfDay >= 0.65 && partial.timeOfDay < 0.75;
    if (!wasDusk && isDusk) {
      next.cascadeActive = true;
    }
    if (partial.timeOfDay > 0.78) {
      next.cascadeActive = false;
    }
  }
  state = next;
  listeners.forEach((fn) => fn());
}

function getState(): SceneState {
  return state;
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Public API ────────────────────────────────────────────────────────

export const sceneStore = { getState, setState, subscribe };

/** Snap timeOfDay to the nearest epoch */
export function setTimeOfDay(t: number): void {
  setState({ timeOfDay: ((t % 1) + 1) % 1 });
}

export function setTimeSpeed(speed: number): void {
  setState({ timeSpeed: speed, isDemoMode: false, demoPhase: null });
}

export function setMood(mood: SceneMood): void {
  setState({ mood });
}

/** Derive mood from the worst incident severity across all floors. */
export function deriveMoodFromIncidents(incidents: { severity: string }[]): void {
  const hasCrit = incidents.some((i) => i.severity === "crit");
  const hasWarn = incidents.some((i) => i.severity === "warn");
  const hasInfo = incidents.some((i) => i.severity === "info" || i.severity === "ok");
  let mood: SceneMood;
  if (hasCrit) mood = "critical";
  else if (hasWarn) mood = "concerned";
  else if (!hasInfo) mood = "serene";
  else mood = "calm";
  setState({ mood });
}

/** Start the 60-second cinematic demo. Resets time to just before sunset. */
export function startDemo(): void {
  setState({
    isDemoMode: true,
    demoPhase: "intro",
    timeOfDay: 0.62,
    timeSpeed: 0.08, // slow enough to watch the whole sunset unfold
    cascadeActive: false,
    _prevTimeOfDay: 0.62,
  });
}

export function stopDemo(restoreSpeed = 1): void {
  setState({
    isDemoMode: false,
    demoPhase: null,
    timeSpeed: restoreSpeed,
    cascadeActive: false,
  });
}

export function resetScene(): void {
  state = { ...defaultState, _prevTimeOfDay: defaultState.timeOfDay };
  listeners.forEach((fn) => fn());
}

// ── React hook (selector-based, no re-render on unrelated changes) ────

import { useSyncExternalStore, useCallback } from "react";

/** Subscribe to a slice of scene state. Re-renders only when that slice changes. */
export function useSceneSelector<T>(selector: (s: SceneState) => T): T {
  const subscribeFn = useCallback((cb: () => void) => sceneStore.subscribe(cb), []);
  const getSnapshot = useCallback(() => selector(sceneStore.getState()), [selector]);
  const getServerSnapshot = useCallback(() => selector(defaultState), [selector]);
  return useSyncExternalStore(subscribeFn, getSnapshot, getServerSnapshot);
}

/** Convenience: get a single field */
export function useSceneField<K extends keyof SceneState>(key: K): SceneState[K] {
  return useSceneSelector((s) => s[key]);
}
