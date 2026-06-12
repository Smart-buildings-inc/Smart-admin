"use client";

// Paradigm 1+2 — The building IS the interface; Direct manipulation.
//
// Clickable invisible meshes positioned at key building elements. When clicked
// they reveal a floating data label with the relevant metric — no side panel
// needed. The building itself tells you what it's doing.

import { useState, useRef, useCallback } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

export interface HotspotData {
  /** World position of the hotspot */
  position: [number, number, number];
  /** Size of the invisible clickable volume */
  size: [number, number, number];
  /** Label title (e.g. "Reservoir") */
  title: string;
  /** Metric lines to display */
  metrics: { label: string; value: string }[];
  /** Accent colour */
  color: string;
}

interface InSceneHotspotProps {
  hotspot: HotspotData;
}

export function InSceneHotspot({ hotspot }: InSceneHotspotProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setOpen((v) => !v);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleClose = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 300);
  }, []);

  const handleOpen = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  return (
    <group>
      {/* Invisible clickable volume */}
      <mesh
        position={hotspot.position}
        onClick={handleClick}
        onPointerOver={handleOpen}
        onPointerOut={handleClose}
      >
        <boxGeometry args={hotspot.size} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Inline data label */}
      {open && (
        <Html
          position={[hotspot.position[0], hotspot.position[1] + 1.2, hotspot.position[2]]}
          center
          distanceFactor={12}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{ borderColor: hotspot.color, backgroundColor: "rgba(5,8,12,0.88)" }}
          >
            <span className="font-semibold" style={{ color: hotspot.color }}>
              {hotspot.title}
            </span>
            {hotspot.metrics.map((m, i) => (
              <span key={i} className="text-slate-300">
                {m.label}: <span className="font-mono font-semibold text-white">{m.value}</span>
              </span>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Build hotspots from floor data ─────────────────────────────────────

import type { Floor } from "@/lib/types";
import { needColor } from "@/lib/ui";

const STEP = 1.66;
const FLOOR_H = 1.5;

export function buildHotspots(floors: Floor[]): HotspotData[] {
  const result: HotspotData[] = [];

  for (const floor of floors) {
    const y = floor.level * STEP;
    const color = needColor[floor.need];

    // Reservoir (water floor)
    if (floor.need === "water") {
      result.push({
        position: [0, y + 0.55, -1.9],
        size: [3.6, 1.1, 0.6],
        title: "\U0001F4A7 Reservoir",
        color,
        metrics: [
          { label: "Flow", value: floor.metrics.waterLph != null ? `${floor.metrics.waterLph} L/h` : "—" },
          { label: "Reuse", value: floor.metrics.waterReusePct != null ? `${floor.metrics.waterReusePct}%` : "—" },
        ],
      });
    }

    // Battery banks (energy floor)
    if (floor.need === "energy") {
      result.push({
        position: [0.7, y + 0.7, -1.7],
        size: [1.6, 1.4, 0.7],
        title: "\u26A1 Battery",
        color,
        metrics: [
          { label: "SOC", value: floor.metrics.batteryPct != null ? `${floor.metrics.batteryPct}%` : "—" },
          { label: "Load", value: floor.metrics.loadKw != null ? `${floor.metrics.loadKw} kW` : "—" },
          { label: "Generation", value: floor.metrics.energyKw != null ? `${floor.metrics.energyKw} kW` : "—" },
        ],
      });
    }

    // Vertical farm (food floor)
    if (floor.need === "food") {
      result.push({
        position: [0, y + 0.85, -0.6],
        size: [3.0, 0.8, 1.6],
        title: "\U0001F33F Vertical Farm",
        color,
        metrics: [
          { label: "Yield", value: floor.metrics.foodKgDay != null ? `${floor.metrics.foodKgDay} kg/day` : "—" },
          { label: "Occupancy", value: floor.metrics.occupancy != null ? `${floor.metrics.occupancy}` : "—" },
        ],
      });
    }

    // Air quality (air floor)
    if (floor.need === "air") {
      result.push({
        position: [0, y + FLOOR_H / 2, 1.2],
        size: [2.0, 0.5, 1.0],
        title: "\U0001F32B\uFE0F Air Quality",
        color,
        metrics: [
          { label: "CO\u2082", value: floor.metrics.co2Ppm != null ? `${floor.metrics.co2Ppm} ppm` : "—" },
          { label: "PM2.5", value: floor.metrics.pm25 != null ? `${floor.metrics.pm25} \u00B5g/m\u00B3` : "—" },
          { label: "Temp", value: floor.metrics.tempC != null ? `${floor.metrics.tempC} \u00B0C` : "—" },
          { label: "Humidity", value: floor.metrics.humidityPct != null ? `${floor.metrics.humidityPct}%` : "—" },
        ],
      });
    }
  }

  // Rooftop PV (always at the top)
  const topY = floors.length * STEP;
  result.push({
    position: [-2.0, topY + 1.1, 0.12],
    size: [4.2, 0.6, 2.6],
    title: "\u2600\uFE0F Solar Array",
    color: "#ffcf4d",
    metrics: [
      { label: "Panels", value: "3 \u00D7 1.15 m" },
      { label: "Peak", value: "4.2 kW" },
    ],
  });

  // Rooftop pool
  result.push({
    position: [2.15, topY + 0.7, -1.25],
    size: [2.05, 0.6, 1.8],
    title: "\U0001F3CA Pool",
    color: "#4ea8ff",
    metrics: [
      { label: "Depth", value: "1.2 m" },
      { label: "Temp", value: "26 \u00B0C" },
    ],
  });

  return result;
}
