// Ambient type declarations for the three.js example/addon modules we use
// directly. three ships these as plain .js with no bundled .d.ts, so under
// `strict` TS we declare the minimal surface we actually call.

declare module "three/examples/jsm/effects/AsciiEffect.js" {
  import type { Camera, Scene, WebGLRenderer } from "three";

  export interface AsciiEffectOptions {
    /** Higher = more characters / more detail (default 0.15). */
    resolution?: number;
    scale?: number;
    /** Colorize each glyph from the source pixel — pricier but on-brand. */
    color?: boolean;
    /** Transparent background. */
    alpha?: boolean;
    /** Use block glyphs. */
    block?: boolean;
    /** Invert luminance→glyph mapping (use for dark backgrounds). */
    invert?: boolean;
    strResolution?: "low" | "medium" | "high";
  }

  export class AsciiEffect {
    constructor(
      renderer: WebGLRenderer,
      charSet?: string,
      options?: AsciiEffectOptions,
    );
    domElement: HTMLDivElement;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: Camera): void;
  }
}
