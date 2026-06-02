/**
 * Procedural RGBA texture generation for the 3D twin.
 *
 * Everything here is authored in code (no image assets, keeps the app
 * local-first / offline) as `THREE.DataTexture`s with explicit RGBA channels.
 * We synthesize value-noise / fBm height fields and derive albedo, roughness
 * and tangent-space normal maps from them so the PBR materials read as real
 * surfaces (concrete, sand, grass, water) instead of flat color.
 *
 * Generators are cached by key — each texture is built at most once.
 */
import * as THREE from "three";

/* ----------------------------- noise helpers ----------------------------- */

function hash(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 144269504) | 0;
  n = (n ^ (n >> 13)) >>> 0;
  n = (Math.imul(n, 1274126177)) >>> 0;
  return (n & 0xffff) / 0x10000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const v00 = hash(ix, iy, seed);
  const v10 = hash(ix + 1, iy, seed);
  const v01 = hash(ix, iy + 1, seed);
  const v11 = hash(ix + 1, iy + 1, seed);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

/** Fractal Brownian motion — layered octaves of value noise in [0,1]. */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* --------------------------- texture assembly ----------------------------- */

function finishTexture(
  tex: THREE.DataTexture,
  repeat: [number, number],
  srgb: boolean,
) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Build a height field once so albedo/rough/normal stay consistent. */
function heightField(size: number, seed: number, scale: number, octaves: number) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Wrap the sample domain so the texture tiles seamlessly.
      h[y * size + x] = fbm((x / size) * scale, (y / size) * scale, seed, octaves);
    }
  }
  return h;
}

function normalFromHeight(
  h: Float32Array,
  size: number,
  strength: number,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) =>
    h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // Tangent-space normal = normalize(-dx, -dy, 1)
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  return new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
}

export interface SurfaceMaps {
  albedoMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
}

interface SurfaceOpts {
  size?: number;
  seed?: number;
  scale?: number;
  octaves?: number;
  /** base albedo [r,g,b] 0..255 */
  base: [number, number, number];
  /** how much fBm tints the albedo (0..1) */
  tint?: number;
  /** roughness range [min,max] mapped from the height field */
  rough?: [number, number];
  /** normal-map bump strength */
  bump?: number;
  repeat?: [number, number];
}

const cache = new Map<string, SurfaceMaps>();

/** Generate (and cache) a coherent albedo + roughness + normal map set. */
export function getSurfaceMaps(key: string, opts: SurfaceOpts): SurfaceMaps {
  const cached = cache.get(key);
  if (cached) return cached;

  const size = opts.size ?? 256;
  const seed = opts.seed ?? 1;
  const scale = opts.scale ?? 8;
  const octaves = opts.octaves ?? 4;
  const tint = opts.tint ?? 0.25;
  const [rMin, rMax] = opts.rough ?? [0.5, 0.95];
  const repeat = opts.repeat ?? [1, 1];

  const h = heightField(size, seed, scale, octaves);

  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const n = h[i];
    const shade = 1 - tint + n * tint * 2; // around 1.0
    albedo[i * 4] = Math.min(255, opts.base[0] * shade);
    albedo[i * 4 + 1] = Math.min(255, opts.base[1] * shade);
    albedo[i * 4 + 2] = Math.min(255, opts.base[2] * shade);
    albedo[i * 4 + 3] = 255;
    const r = (rMin + (rMax - rMin) * n) * 255;
    rough[i * 4] = r;
    rough[i * 4 + 1] = r;
    rough[i * 4 + 2] = r;
    rough[i * 4 + 3] = 255;
  }

  const albedoMap = finishTexture(
    new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat),
    repeat,
    true,
  );
  const roughnessMap = finishTexture(
    new THREE.DataTexture(rough, size, size, THREE.RGBAFormat),
    repeat,
    false,
  );
  const normalMap = finishTexture(
    normalFromHeight(h, size, opts.bump ?? 6),
    repeat,
    false,
  );

  const maps: SurfaceMaps = { albedoMap, roughnessMap, normalMap };
  cache.set(key, maps);
  return maps;
}

/* ----------------------- ready-made surface presets ----------------------- */

/** Fine micro-surface detail (normal + roughness only) for the floor slabs. */
export function slabDetailMaps(): Pick<SurfaceMaps, "roughnessMap" | "normalMap"> {
  const { roughnessMap, normalMap } = getSurfaceMaps("slab", {
    seed: 7,
    scale: 22,
    octaves: 5,
    base: [255, 255, 255],
    rough: [0.32, 0.6],
    bump: 2.2,
    repeat: [3, 1],
  });
  return { roughnessMap, normalMap };
}

export function sandMaps(): SurfaceMaps {
  return getSurfaceMaps("sand", {
    seed: 21,
    scale: 30,
    octaves: 5,
    base: [216, 195, 154],
    tint: 0.22,
    rough: [0.8, 0.98],
    bump: 4,
    repeat: [10, 1],
  });
}

export function grassMaps(): SurfaceMaps {
  return getSurfaceMaps("grass", {
    seed: 44,
    scale: 26,
    octaves: 5,
    base: [40, 64, 31],
    tint: 0.45,
    rough: [0.7, 0.95],
    bump: 5,
    repeat: [14, 8],
  });
}

export function woodMaps(): SurfaceMaps {
  return getSurfaceMaps("wood", {
    seed: 9,
    scale: 14,
    octaves: 4,
    base: [205, 191, 166],
    tint: 0.18,
    rough: [0.55, 0.8],
    bump: 2.5,
    repeat: [2, 2],
  });
}

/** Animated-water normal map (no albedo — color comes from the material). */
export function waterNormalMap(): THREE.DataTexture {
  const size = 256;
  const h = heightField(size, 88, 10, 4);
  return finishTexture(normalFromHeight(h, size, 3.2), [6, 3], false);
}
