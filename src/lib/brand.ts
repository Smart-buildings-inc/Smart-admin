// ATLAS OS — Brand identity (single source of truth)
//
// Everything the Brand page (`/brand`) renders and everything the downloadable
// brand-kit zip (`/api/brand/zip`) ships is derived from the tokens here, so the
// living style guide and the exported assets can never drift apart. Keep the
// color hexes in sync with `tailwind.config.ts` and `src/lib/ui.ts`.

export type BrandColor = {
  /** Token name, e.g. "ink-950" or "signal-ok". */
  name: string;
  /** Hex value (lowercase, 6-digit). */
  hex: string;
  /** What the color is for. */
  use: string;
  /** Whether white or near-black text reads best on top. */
  on: "light" | "dark";
};

export type BrandColorGroup = {
  /** Group id used for the Tailwind namespace, e.g. "ink". */
  id: string;
  /** Display title. */
  title: string;
  /** One-line description of the group's role. */
  blurb: string;
  colors: BrandColor[];
};

// — Identity —————————————————————————————————————————————————————————————

export const BRAND = {
  name: "ATLAS OS",
  short: "AOS",
  product: "Habitat Twin",
  tagline: "Building the future. Creating lasting spaces.",
  description:
    "ATLAS OS is the building-operations platform for self-sufficient ATLAS habitats — one floor per human need, rendered as an interactive 3D digital twin with live telemetry, incident triage, and resident broadcast.",
  // The mark is a brushed-metal isometric cube whose three visible faces carry
  // the letters A · O · S. Authored as pure SVG (no raster source).
  markStory:
    "An isometric, brushed-metal cube. Its three lit faces carry the letters A · O · S — one habitat, many faces, a single system.",
} as const;

// — Color ————————————————————————————————————————————————————————————————

export const COLOR_GROUPS: BrandColorGroup[] = [
  {
    id: "ink",
    title: "Ink — surfaces",
    blurb: "Dark, layered console surfaces. Ink-950 is the page; lighter steps lift panels and borders.",
    colors: [
      { name: "ink-950", hex: "#070b10", use: "App background", on: "light" },
      { name: "ink-900", hex: "#0b121a", use: "Panels / cards", on: "light" },
      { name: "ink-800", hex: "#101a24", use: "Raised surfaces", on: "light" },
      { name: "ink-700", hex: "#17242f", use: "Hover / inputs", on: "light" },
      { name: "ink-600", hex: "#22323f", use: "Borders / dividers", on: "light" },
    ],
  },
  {
    id: "signal",
    title: "Signal — status",
    blurb: "Operational status. Reserved for state — never decoration — so a color always means something.",
    colors: [
      { name: "signal-ok", hex: "#3ddc97", use: "Nominal / healthy", on: "dark" },
      { name: "signal-info", hex: "#4ea8ff", use: "Info / focus ring", on: "dark" },
      { name: "signal-warn", hex: "#ffb340", use: "Warning / degraded", on: "dark" },
      { name: "signal-crit", hex: "#ff5d5d", use: "Critical / incident", on: "dark" },
    ],
  },
  {
    id: "need",
    title: "Need — floor accents",
    blurb: "One accent per human need. Color-codes floors across the twin, KPI strip, and fleet rollup.",
    colors: [
      { name: "need-water", hex: "#3aa0ff", use: "Water", on: "dark" },
      { name: "need-energy", hex: "#ffcf4d", use: "Energy", on: "dark" },
      { name: "need-food", hex: "#5ddc7a", use: "Food", on: "dark" },
      { name: "need-shelter", hex: "#c0a4ff", use: "Shelter", on: "dark" },
      { name: "need-air", hex: "#7fe7e0", use: "Air", on: "dark" },
      { name: "need-health", hex: "#ff8fb1", use: "Health", on: "dark" },
      { name: "need-restoration", hex: "#ffd9a0", use: "Restoration", on: "dark" },
    ],
  },
];

// — Typography ——————————————————————————————————————————————————————————

export type BrandType = {
  role: string;
  sample: string;
  /** Tailwind/utility note describing the treatment. */
  spec: string;
  /** CSS class from globals.css that realizes it (if any). */
  className?: string;
};

export const TYPE_RAMP: BrandType[] = [
  {
    role: "Display",
    sample: "ATLAS OS",
    spec: "SF Pro Display · 800 · tracking -0.03em",
    className: "display",
  },
  {
    role: "Emphasis",
    sample: "Building the future.",
    spec: "SF Pro · 800 italic · gradient fill",
    className: "important",
  },
  {
    role: "Body",
    sample: "One floor per human need, rendered as a live digital twin.",
    spec: "SF Pro Text · 400 · tracking -0.01em",
  },
  {
    role: "KPI label",
    sample: "RESERVOIR CAPACITY",
    spec: "11px · 500 · uppercase · tracking 0.14em",
    className: "kpi-label",
  },
  {
    role: "KPI value",
    sample: "98.4%",
    spec: "SF Mono · 600 · tabular-nums",
    className: "kpi-value",
  },
];

export const FONT_STACK =
  '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", system-ui, sans-serif';
export const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, monospace';

// — Voice ———————————————————————————————————————————————————————————————

export const VOICE = {
  pillars: [
    {
      title: "Calm under load",
      body: "We run mission-critical systems. The interface stays quiet so the signal is loud — status is shown, never shouted.",
    },
    {
      title: "Precise, not clinical",
      body: "Numbers are exact and monospaced; language is plain and human. We name things the way an operator would.",
    },
    {
      title: "Tactile & alive",
      body: "Glassy surfaces, soft motion, a twin that breathes. The product should feel like a place, not a dashboard.",
    },
  ],
  dos: [
    'Lead with the metric, then the context.',
    "Use Signal colors only to mean state.",
    'Keep one accent per need — never recolor a floor.',
    "Italic gradient emphasis for the line that matters most.",
  ],
  donts: [
    "Don't use red for anything but critical.",
    "Don't stack more than one emphasis style per view.",
    "Don't place dark text on Ink surfaces.",
    "Don't stretch or recolor the AOS cube.",
  ],
} as const;

// — Asset references (served from /public and src/app) ————————————————————

export const LOGO_ASSETS = [
  { label: "App mark (512)", path: "/logo.svg", note: "Full brushed-metal cube on its app tile." },
  { label: "Icon (64)", path: "/icon.svg", note: "Compact mark for nav + favicons." },
  { label: "Icon 192", path: "/icon-192.png", note: "PWA / maskable raster." },
  { label: "Icon 512", path: "/icon-512.png", note: "High-res raster." },
] as const;
