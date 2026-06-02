import type { NavIcon } from "@/lib/nav";

// Lightweight inline glyphs for the mobile tab bar — no icon dependency, and
// they inherit `currentColor` so active/inactive coloring is purely CSS.
// `strokeWidth` is a touch heavier than hairline so they read on small screens.

type Props = {
  name: NavIcon;
  /** Filled variant gives the active tab that solid, iOS "selected" weight. */
  active?: boolean;
  className?: string;
};

export default function NavIcon({ name, active = false, className }: Props) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "console") {
    // Dashboard / gauge grid — the live ops console.
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="2" fill={active ? "currentColor" : "none"} />
        <rect x="13" y="3" width="8" height="5" rx="2" fill={active ? "currentColor" : "none"} />
        <rect x="13" y="10" width="8" height="11" rx="2" fill={active ? "currentColor" : "none"} />
        <rect x="3" y="13" width="8" height="8" rx="2" fill={active ? "currentColor" : "none"} />
      </svg>
    );
  }

  if (name === "download") {
    // Download / install to device — tray with a down arrow.
    return (
      <svg {...common}>
        <path d="M12 3v11" />
        <path d="m7.5 10 4.5 4.5 4.5-4.5" fill={active ? "currentColor" : "none"} />
        <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
      </svg>
    );
  }

  // Fleet — a cluster of habitat towers.
  return (
    <svg {...common}>
      <path d="M3 21h18" />
      <rect x="4" y="9" width="7" height="12" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="13" y="4" width="7" height="17" rx="1.5" fill={active ? "currentColor" : "none"} />
      <path d="M7 13h1M7 16h1M16 8h1M16 11h1M16 14h1" stroke={active ? "var(--icon-cutout, #0b121a)" : "currentColor"} />
    </svg>
  );
}
