"use client";

// Signature ASCII rendering layer.
//
// Drops three.js' AsciiEffect over any @react-three/fiber scene: the live WebGL
// frame is resampled into a grid of monospace glyphs every tick, so our chunky
// "Minecraft" voxel models read as animated ASCII art — the ATLAS signature
// look. Mounted inside a <Canvas>, it takes over the render loop (useFrame
// priority 1), hides the real canvas, and overlays the glyph table in its
// place. Pointer events fall through to the (invisible) canvas, so floor
// picking / orbit controls keep working underneath the ASCII.

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";

export interface AsciiRendererProps {
  /** Glyph ramp, sparse → dense. */
  characters?: string;
  /** Higher = finer grid / more glyphs. */
  resolution?: number;
  /** Monochrome glyph color (ignored when `color` is true). */
  fgColor?: string;
  bgColor?: string;
  /** Tint each glyph from the underlying pixel — lets the need-palette show. */
  color?: boolean;
  invert?: boolean;
}

export default function AsciiRenderer({
  characters = " .:-=+*#%@",
  resolution = 0.2,
  fgColor = "#7fe7e0",
  bgColor = "transparent",
  color = false,
  invert = true,
}: AsciiRendererProps) {
  const { size, gl } = useThree();

  // Build the effect once per renderer/config. Recreating swaps the DOM node,
  // which the mount effect below re-attaches.
  const effect = useMemo(() => {
    const fx = new AsciiEffect(gl, characters, { invert, resolution, color });
    const el = fx.domElement;
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.color = fgColor;
    el.style.backgroundColor = bgColor;
    el.style.pointerEvents = "none";
    el.style.zIndex = "2";
    el.classList.add("ascii-surface");
    return fx;
  }, [gl, characters, resolution, color, invert, fgColor, bgColor]);

  // Swap the live canvas out for the glyph table (and restore on unmount).
  useEffect(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentNode as HTMLElement | null;
    if (!parent) return;
    const prevOpacity = canvas.style.opacity;
    canvas.style.opacity = "0";
    parent.appendChild(effect.domElement);
    return () => {
      canvas.style.opacity = prevOpacity;
      effect.domElement.parentNode?.removeChild(effect.domElement);
    };
  }, [gl, effect]);

  // Keep the glyph grid sized to the stage.
  useEffect(() => {
    effect.setSize(size.width, size.height);
  }, [effect, size.width, size.height]);

  // Take over rendering: draw through the effect instead of the default loop.
  useFrame((state) => {
    effect.render(state.scene, state.camera);
  }, 1);

  return null;
}
