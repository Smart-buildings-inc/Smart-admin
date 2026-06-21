"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

// Runtime derivative of /sundowner_overlook_1k.exr, kept smaller so the
// responsive simulator remains interactive while the HDR environment warms in.
export const MAIN_HDR_ENVIRONMENT_URL = "/hdr/sundowner_overlook_runtime_512.exr";

export default function MainHdrEnvironment({
  intensity = 0.24,
  loadDelayMs = 500,
}: {
  intensity?: number;
  loadDelayMs?: number;
}) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    let disposed = false;
    let pmremDisposed = false;
    let idleId: number | null = null;
    let delayId: number | null = null;
    let envMap: THREE.Texture | null = null;
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    const previousEnvironment = scene.environment;
    const previousEnvironmentIntensity = scene.environmentIntensity;

    const disposePmrem = () => {
      if (pmrem && !pmremDisposed) {
        pmrem.dispose();
        pmremDisposed = true;
      }
    };

    scene.environmentIntensity = intensity;
    const effectiveLoadDelayMs = loadDelayMs;

    const loadEnvironment = () => {
      if (disposed) return;

      pmrem = new THREE.PMREMGenerator(gl);
      pmremDisposed = false;
      pmrem.compileEquirectangularShader();

      new EXRLoader()
        // The source contains values outside half-float range. Decode as
        // FloatType before PMREM so highlights tone-map instead of overflowing.
        .setDataType(THREE.FloatType)
        .load(
          MAIN_HDR_ENVIRONMENT_URL,
          (texture) => {
            if (disposed) {
              texture.dispose();
              return;
            }

            texture.mapping = THREE.EquirectangularReflectionMapping;
            envRenderTarget = pmrem?.fromEquirectangular(texture) ?? null;
            if (!envRenderTarget) {
              texture.dispose();
              return;
            }
            envMap = envRenderTarget.texture;
            envMap.name = "sundowner-overlook-main-hdr";
            scene.environment = envMap;
            scene.environmentIntensity = intensity;
            invalidate();

            texture.dispose();
            disposePmrem();
          },
          undefined,
          (error) => {
            disposePmrem();
            if (process.env.NODE_ENV !== "production") {
              console.error("Failed to load the main HDR environment.", error);
            }
          },
        );
    };

    delayId = window.setTimeout(() => {
      delayId = null;
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(
          () => {
            idleId = null;
            loadEnvironment();
          },
          { timeout: 6000 },
        );
      } else {
        loadEnvironment();
      }
    }, effectiveLoadDelayMs);

    return () => {
      disposed = true;
      if (delayId !== null) window.clearTimeout(delayId);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      disposePmrem();

      if (scene.environment === envMap) {
        scene.environment = previousEnvironment;
      }

      if (scene.environment === previousEnvironment) {
        scene.environmentIntensity = previousEnvironmentIntensity;
      }

      envRenderTarget?.dispose();
      invalidate();
    };
  }, [gl, scene, invalidate, intensity, loadDelayMs]);

  return null;
}
