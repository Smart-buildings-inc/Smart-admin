"use client";

// Procedural canvas texture generation for the ATLAS building simulator.
// All textures are deterministic (seeded) so they don't flicker across renders.
// Canvas textures are cached by key and reused across all surfaces of the same type.

import * as THREE from "three";

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Texture types ─────────────────────────────────────────────────────
export type ProcTextureType =
  | "concrete"
  | "concreteDark"
  | "metalPanel"
  | "brick"
  | "tile"
  | "solar"
  | "gravel"
  | "plaster"
  | "glassGrid"
  | "roofing";

interface TextureSpec {
  /** Width in pixels (power of 2) */
  w: number;
  /** Height in pixels (power of 2) */
  h: number;
  /** Paint function */
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) => void;
  /** Default U/V tiling (default 1) */
  repeat?: [number, number];
}

// ── Noise helpers ─────────────────────────────────────────────────────
function fillNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  baseR: number,
  baseG: number,
  baseB: number,
  amp: number,
) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * amp;
    img.data[i] = Math.max(0, Math.min(255, baseR + n));
    img.data[i + 1] = Math.max(0, Math.min(255, baseG + n));
    img.data[i + 2] = Math.max(0, Math.min(255, baseB + n));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function fillCellNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  cellsX: number,
  cellsY: number,
  palette: [number, number, number][],
) {
  const cellW = w / cellsX;
  const cellH = h / cellsY;
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const c = palette[Math.floor(rng() * palette.length)];
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      // Add slight inset for mortar/path effect
      const inset = 0.92;
      const iw = cellW * inset;
      const ih = cellH * inset;
      const ox = (cellW - iw) / 2;
      const oy = (cellH - ih) / 2;
      ctx.fillRect(cx * cellW + ox, cy * cellH + oy, iw, ih);
    }
  }
}

// ── Texture definitions ───────────────────────────────────────────────
const TEXTURE_SPECS: Record<ProcTextureType, TextureSpec> = {
  concrete: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) =>
      fillNoise(ctx, w, h, rng, 160, 168, 175, 42),
    repeat: [2, 2],
  },
  concreteDark: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) =>
      fillNoise(ctx, w, h, rng, 68, 74, 80, 28),
    repeat: [2, 2],
  },
  metalPanel: {
    w: 256,
    h: 128,
    paint: (ctx, w, h, rng) => {
      fillNoise(ctx, w, h, rng, 90, 95, 100, 14);
      // Vertical brushed lines
      ctx.globalAlpha = 0.08;
      for (let x = 0; x < w; x += 2) {
        const v = (rng() - 0.5) * 40;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
        ctx.fillRect(x, 0, 1, h);
      }
      ctx.globalAlpha = 1;
    },
    repeat: [1, 1],
  },
  brick: {
    w: 256,
    h: 128,
    paint: (ctx, w, h, rng) => {
      const brickW = 48;
      const brickH = 20;
      const mortar = 2;
      const cols = Math.ceil(w / brickW);
      const rows = Math.ceil(h / brickH);
      ctx.fillStyle = "#3a4048";
      ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < rows; row++) {
        const offset = row % 2 === 0 ? 0 : brickW / 2;
        for (let col = 0; col < cols + 1; col++) {
          const x = col * brickW + offset;
          const y = row * brickH;
          const r = 140 + (rng() - 0.5) * 30;
          const g = 95 + (rng() - 0.5) * 20;
          const b = 80 + (rng() - 0.5) * 15;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);
        }
      }
    },
    repeat: [3, 2],
  },
  tile: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) => {
      const cells = 8;
      const palette: [number, number, number][] = [
        [195, 185, 170],
        [180, 170, 155],
        [170, 160, 145],
        [185, 175, 160],
      ];
      fillCellNoise(ctx, w, h, rng, cells, cells, palette);
      // Grout lines — dark and thick for visibility
      const cellW = w / cells;
      const cellH = h / cells;
      ctx.strokeStyle = "rgba(50, 45, 40, 0.7)";
      ctx.lineWidth = 2.5;
      for (let i = 0; i <= cells; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, h);
        ctx.stroke();
      }
      for (let i = 0; i <= cells; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(w, i * cellH);
        ctx.stroke();
      }
      // Scatter a few darker stones for authenticity
      for (let i = 0; i < 5; i++) {
        const cx = Math.floor(rng() * cells);
        const cy = Math.floor(rng() * cells);
        const inset = 2;
        ctx.fillStyle = "rgb(100, 90, 80)";
        ctx.fillRect(cx * cellW + inset, cy * cellH + inset, cellW - inset * 2, cellH - inset * 2);
      }
    },
    repeat: [6, 6],
  },
  solar: {
    w: 256,
    h: 128,
    paint: (ctx, w, h, rng) => {
      // Solar cell grid
      const cellsX = 16;
      const cellsY = 8;
      const cellW = w / cellsX;
      const cellH = h / cellsY;
      const gap = 1.5;
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, w, h);
      for (let cy = 0; cy < cellsY; cy++) {
        for (let cx = 0; cx < cellsX; cx++) {
          const b = 20 + rng() * 10;
          ctx.fillStyle = `rgb(10,25,${b + 40})`;
          ctx.fillRect(cx * cellW + gap, cy * cellH + gap, cellW - gap * 2, cellH - gap * 2);
          // Finger line
          const fw = cellW * 0.7;
          const fx = cx * cellW + (cellW - fw) / 2;
          const fy = cy * cellH + cellH * 0.38;
          ctx.fillStyle = `rgba(220,230,255,${0.2 + rng() * 0.15})`;
          ctx.fillRect(fx, fy, fw, cellH * 0.24);
        }
      }
      // Grid lines over top
      ctx.strokeStyle = "rgba(180,200,230,0.25)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i <= cellsX; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, h);
        ctx.stroke();
      }
      for (let i = 0; i <= cellsY; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(w, i * cellH);
        ctx.stroke();
      }
    },
    repeat: [2, 2],
  },
  gravel: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 40 + rng() * 60;
        img.data[i] = v + 10;
        img.data[i + 1] = v + 5;
        img.data[i + 2] = v - 5;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // Dark speckles
      for (let i = 0; i < 1200; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const s = 1 + rng() * 3;
        const b = 20 + rng() * 30;
        ctx.fillStyle = `rgb(${b},${b},${b})`;
        ctx.fillRect(x, y, s, s);
      }
    },
    repeat: [4, 4],
  },
  plaster: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) =>
      fillNoise(ctx, w, h, rng, 210, 205, 195, 15),
    repeat: [1, 1],
  },
  glassGrid: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) => {
      const cells = 4;
      const cellW = w / cells;
      const cellH = h / cells;
      const margin = 3;
      // Outer frame (darker grid border)
      ctx.fillStyle = "#1a2a38";
      ctx.fillRect(0, 0, w, h);
      // Glass panes (lighter, with subtle tint variation)
      for (let cy = 0; cy < cells; cy++) {
        for (let cx = 0; cx < cells; cx++) {
          const v = 140 + rng() * 50;
          ctx.fillStyle = `rgb(${v + 20},${v + 40},${v + 60})`;
          ctx.fillRect(cx * cellW + margin, cy * cellH + margin, cellW - margin * 2, cellH - margin * 2);
        }
      }
      // Grid mullions
      ctx.strokeStyle = "#2a3a48";
      ctx.lineWidth = 3;
      for (let i = 0; i <= cells; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(w, i * cellH);
        ctx.stroke();
      }
    },
    repeat: [2, 2],
  },
  roofing: {
    w: 256,
    h: 256,
    paint: (ctx, w, h, rng) => {
      // Dark membrane with gravel
      fillNoise(ctx, w, h, rng, 30, 35, 40, 12);
      // Scattered aggregate
      for (let i = 0; i < 800; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const s = 2 + rng() * 4;
        const b = 50 + rng() * 40;
        ctx.fillStyle = `rgba(${b},${b + 5},${b - 5},0.6)`;
        ctx.fillRect(x, y, s, s);
      }
    },
    repeat: [3, 3],
  },
};

// ── Generate a single canvas texture ──────────────────────────────────
function generateTextureCanvas(key: ProcTextureType, seed: number): THREE.CanvasTexture {
  const spec = TEXTURE_SPECS[key];
  const canvas = document.createElement("canvas");
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(seed);
  spec.paint(ctx, spec.w, spec.h, rng);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const [ru, rv] = spec.repeat ?? [1, 1];
  texture.repeat.set(ru, rv);
  texture.needsUpdate = true;
  return texture;
}

// ── Cache ─────────────────────────────────────────────────────────────
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Get (or create) a procedural texture. Textures are cached by type + seed.
 */
export function getProcTexture(type: ProcTextureType, seed = 42): THREE.CanvasTexture {
  const key = `${type}__${seed}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = generateTextureCanvas(type, seed);
    textureCache.set(key, tex);
  }
  return tex;
}

/**
 * Pre-generate all texture types into the cache. Call once at init to avoid
 * hitch on first frame.
 */
export function prewarmTextures(): void {
  const types = Object.keys(TEXTURE_SPECS) as ProcTextureType[];
  types.forEach((t) => getProcTexture(t));
}

/**
 * Get the UV repeat for a texture type (for material tiling).
 */
export function textureRepeat(type: ProcTextureType): [number, number] {
  return TEXTURE_SPECS[type].repeat ?? [1, 1];
}

/**
 * Build a complete `meshStandardMaterial` with a procedural texture map.
 * If `color` is given it tints the texture (multiply).
 */
export function procMaterial(
  type: ProcTextureType,
  color?: string,
  overrides?: Partial<THREE.MeshStandardMaterialParameters>,
): THREE.MeshStandardMaterial {
  const tex = getProcTexture(type);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false,
    ...overrides,
  });
  if (color) {
    mat.color = new THREE.Color(color);
  }
  return mat;
}
