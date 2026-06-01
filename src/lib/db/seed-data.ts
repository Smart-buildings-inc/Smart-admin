// Canonical ATLAS-01 seed data — the floor stack from PRD §7.2, plus a starter
// incident feed and broadcast. This module has NO database dependency so it can
// be imported by both the API layer (seed fallback) and the seed script.

import type { Broadcast, Building, Floor, Incident } from "@/lib/types";

/** ATLAS-01 floor stack, ordered bottom → top by physical level. */
export const seedFloors: Floor[] = [
  {
    key: "reclamation-core",
    name: "Reclamation Core",
    need: "water",
    category: "Water & Waste",
    level: -1,
    residents: 0,
    metrics: { waterLph: 1840, waterReusePct: 92, energyKw: 12, tempC: 18 },
  },
  {
    key: "commons-clinic",
    name: "Commons & Clinic",
    need: "health",
    category: "Community & Health",
    level: 1,
    residents: 0,
    metrics: { occupancy: 34, tempC: 21.5, humidityPct: 44, co2Ppm: 620 },
  },
  {
    key: "power-ops-core",
    name: "Power & Ops Core",
    need: "energy",
    category: "Energy & Intelligence",
    level: 2,
    residents: 0,
    metrics: { energyKw: 148, loadKw: 96, batteryPct: 78 },
  },
  {
    key: "aquaponics-bay",
    name: "Aquaponics Bay",
    need: "food",
    category: "Protein (Food)",
    level: 3,
    residents: 0,
    metrics: { foodKgDay: 41, waterLph: 320, tempC: 23, energyKw: 18 },
  },
  {
    key: "vertical-farm",
    name: "Vertical Farm",
    need: "food",
    category: "Produce (Food)",
    level: 4,
    residents: 0,
    metrics: { foodKgDay: 86, energyKw: 54, humidityPct: 65, tempC: 22 },
  },
  {
    key: "residences-a",
    name: "Residences A",
    need: "shelter",
    category: "Shelter",
    level: 5,
    residents: 28,
    metrics: { occupancy: 24, loadKw: 22, tempC: 21, humidityPct: 41 },
  },
  {
    key: "residences-b",
    name: "Residences B",
    need: "shelter",
    category: "Shelter",
    level: 6,
    residents: 28,
    metrics: { occupancy: 21, loadKw: 19, tempC: 21.2, humidityPct: 42 },
  },
  {
    key: "residences-c",
    name: "Residences C",
    need: "shelter",
    category: "Shelter",
    level: 7,
    residents: 26,
    metrics: { occupancy: 23, loadKw: 20, tempC: 20.8, humidityPct: 40 },
  },
  {
    key: "residences-d",
    name: "Residences D",
    need: "shelter",
    category: "Shelter",
    level: 8,
    residents: 24,
    metrics: { occupancy: 18, loadKw: 17, tempC: 21.1, humidityPct: 43 },
  },
  {
    key: "the-lung",
    name: "The Lung",
    need: "air",
    category: "Air & Restoration",
    level: 9,
    residents: 0,
    metrics: { co2Ppm: 410, pm25: 4, humidityPct: 55, occupancy: 9, tempC: 22 },
  },
  {
    key: "penthouses",
    name: "The Penthouses",
    need: "shelter",
    category: "Shelter · 12 Penthouses",
    // Up to 12 premium dwellings sharing the rooftop Skydeck pool directly above.
    level: 10,
    residents: 22,
    metrics: { occupancy: 16, loadKw: 24, tempC: 21.4, humidityPct: 42 },
  },
  {
    key: "skydeck-reservoir",
    name: "Skydeck & Reservoir",
    need: "restoration",
    category: "Restoration / Reserve · Shared rooftop pool",
    level: 11,
    residents: 0,
    metrics: { waterLph: 0, waterReusePct: 100, occupancy: 12, tempC: 24 },
  },
];

/** Starter incident feed, newest first. */
export const seedIncidents: Incident[] = [
  {
    id: "seed-inc-1",
    severity: "warn",
    floorKey: "vertical-farm",
    title: "Grow-light bank 3 drawing 12% over baseline",
    detail:
      "Photoperiod controller flagged anomalous draw. AI ops proposes shifting the bank to off-peak; awaiting operator approval.",
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "seed-inc-2",
    severity: "info",
    floorKey: "power-ops-core",
    title: "Battery wall crossed 75% — switching to solar-direct loads",
    detail: "Demand-response routine engaged. Grid import remains at 0 kW.",
    createdAt: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
  },
  {
    id: "seed-inc-3",
    severity: "crit",
    floorKey: "reclamation-core",
    title: "Blackwater pump B fault — failover to pump A confirmed",
    detail:
      "Deterministic controller handled failover locally. No service interruption. Maintenance ticket auto-created.",
    createdAt: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
  },
  {
    id: "seed-inc-4",
    severity: "ok",
    floorKey: "commons-clinic",
    title: "Telehealth link tested green for evening clinic block",
    createdAt: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
  },
];

/** Starter broadcast history. */
export const seedBroadcasts: Broadcast[] = [
  {
    id: "seed-bc-1",
    message:
      "Fresh harvest from the Vertical Farm is available in the Commons kitchen this evening.",
    audience: "all",
    recipients: 106,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

// --- F7: fleet ---

/**
 * The ATLAS fleet — buildings deployed across Canada and the US. ATLAS-01 is
 * the flagship (online); the rest vary in status to exercise the fleet map.
 * Coordinates are real city lat/lng so the normalized plot reads correctly.
 */
export const seedBuildings: Building[] = [
  {
    id: "atlas-01",
    name: "ATLAS-01 · Toronto",
    location: { label: "Toronto, ON", lat: 43.6532, lng: -79.3832 },
    status: "online",
    unitCount: 12,
    autonomyPct: 96,
    residents: 128,
    openIncidents: 1,
  },
  {
    id: "atlas-02",
    name: "ATLAS-02 · Montréal",
    location: { label: "Montréal, QC", lat: 45.5019, lng: -73.5674 },
    status: "online",
    unitCount: 10,
    autonomyPct: 91,
    residents: 104,
    openIncidents: 0,
  },
  {
    id: "atlas-03",
    name: "ATLAS-03 · Vancouver",
    location: { label: "Vancouver, BC", lat: 49.2827, lng: -123.1207 },
    status: "degraded",
    unitCount: 11,
    autonomyPct: 74,
    residents: 116,
    openIncidents: 3,
  },
  {
    id: "atlas-04",
    name: "ATLAS-04 · Calgary",
    location: { label: "Calgary, AB", lat: 51.0447, lng: -114.0719 },
    status: "online",
    unitCount: 9,
    autonomyPct: 88,
    residents: 92,
    openIncidents: 1,
  },
  {
    id: "atlas-05",
    name: "ATLAS-05 · Detroit",
    location: { label: "Detroit, MI", lat: 42.3314, lng: -83.0458 },
    status: "degraded",
    unitCount: 8,
    autonomyPct: 69,
    residents: 78,
    openIncidents: 2,
  },
  {
    id: "atlas-06",
    name: "ATLAS-06 · Buffalo",
    location: { label: "Buffalo, NY", lat: 42.8864, lng: -78.8784 },
    status: "offline",
    unitCount: 7,
    autonomyPct: 0,
    residents: 64,
    openIncidents: 5,
  },
];
