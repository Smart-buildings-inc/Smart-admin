"use client";

// Paradigm 9 — No loading, no spinner, no latency.
//
// Pre-warming and optimisation utilities for the building simulator.
// Call these at module load / app init to avoid first-frame hitches.

import { prewarmTextures } from "@/lib/procedural-textures";

let prewarmed = false;

/**
 * Pre-generate all procedural textures and warm up any other lazy resources.
 * Safe to call multiple times — only runs once.
 */
export function prewarmSimulator(): void {
  if (prewarmed) return;
  prewarmed = true;
  prewarmTextures();
}
