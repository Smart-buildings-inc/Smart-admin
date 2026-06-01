// Shared presentation helpers: maps domain enums to colors/labels used by both
// the 3D twin and the 2D panels so the color-coding stays consistent (F1/F2).

import type { Need, Severity } from "@/lib/types";

/** Hex colors per human need — matches tailwind.config `need.*`. */
export const needColor: Record<Need, string> = {
  water: "#3aa0ff",
  energy: "#ffcf4d",
  food: "#5ddc7a",
  shelter: "#c0a4ff",
  air: "#7fe7e0",
  health: "#ff8fb1",
  restoration: "#ffd9a0",
};

export const severityColor: Record<Severity, string> = {
  crit: "#ff5d5d",
  warn: "#ffb340",
  info: "#4ea8ff",
  ok: "#3ddc97",
};

export const severityLabel: Record<Severity, string> = {
  crit: "Critical",
  warn: "Warning",
  info: "Info",
  ok: "OK",
};

/** Rank for sorting feeds by urgency (lower = more urgent). */
export const severityRank: Record<Severity, number> = {
  crit: 0,
  warn: 1,
  info: 2,
  ok: 3,
};

/** Human-readable relative time, e.g. "7m ago". */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
