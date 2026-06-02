"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  AttributionControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Building, BuildingStatus } from "@/lib/types";

// F7 — Fleet map. A real Leaflet slippy map (replacing the old stylized SVG
// plot) rendering every ATLAS building as a status-colored marker. We swap
// Leaflet's default attribution for our own ATLAS OS credit.

const STATUS_COLOR: Record<BuildingStatus, string> = {
  online: "#3ddc97", // signal.ok
  degraded: "#ffb340", // signal.warn
  offline: "#ff5d5d", // signal.crit
};

const STATUS_LABEL: Record<BuildingStatus, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
};

// Our own attribution string — shown in place of the default "Leaflet" prefix.
const ATLAS_ATTRIBUTION = "ATLAS OS · Habitat Twin · Housing as a network";

// Fits the viewport to the seeded buildings on mount and whenever they change.
function FitToBuildings({ buildings }: { buildings: Building[] }) {
  const map = useMap();
  useEffect(() => {
    if (!buildings.length) return;
    const bounds = L.latLngBounds(
      buildings.map((b) => [b.location.lat, b.location.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 6 });
  }, [map, buildings]);
  return null;
}

export default function FleetMap({
  buildings,
  selectedId,
  onSelect,
}: {
  buildings: Building[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Center on the geographic mean of the fleet as an initial guess; the
  // FitToBuildings helper refines this to a tight bounding box on mount.
  const center = useMemo<[number, number]>(() => {
    if (!buildings.length) return [45, -98];
    const lat = buildings.reduce((s, b) => s + b.location.lat, 0) / buildings.length;
    const lng = buildings.reduce((s, b) => s + b.location.lng, 0) / buildings.length;
    return [lat, lng];
  }, [buildings]);

  return (
    <MapContainer
      center={center}
      zoom={4}
      minZoom={2}
      scrollWheelZoom
      // Disable the built-in control so we can render our own (no "Leaflet"
      // prefix) via <AttributionControl> below.
      attributionControl={false}
      className="h-full w-full bg-ink-900"
      style={{ background: "#070b10" }}
    >
      {/* CARTO dark basemap — matches the ops-console palette. Tile data is
          credited per its terms; the Leaflet library prefix is replaced with
          our own ATLAS OS attribution. */}
      <TileLayer
        url="https://{s}.basemap.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <AttributionControl position="bottomright" prefix={ATLAS_ATTRIBUTION} />

      <FitToBuildings buildings={buildings} />

      {buildings.map((b) => {
        const color = STATUS_COLOR[b.status];
        const active = b.id === selectedId;
        const pulsing = b.status !== "online";
        return (
          <CircleMarker
            key={b.id}
            center={[b.location.lat, b.location.lng]}
            radius={active ? 9 : 7}
            pathOptions={{
              color: "#070b10",
              weight: 1.5,
              fillColor: color,
              fillOpacity: 1,
            }}
            // SVG path picks up the shared `.pulse` keyframes for non-online sites.
            className={pulsing ? "pulse" : undefined}
            eventHandlers={{ click: () => onSelect(b.id) }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={1}
              permanent={active}
            >
              <span className="text-xs font-medium">
                {b.location.label} · {STATUS_LABEL[b.status]}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
