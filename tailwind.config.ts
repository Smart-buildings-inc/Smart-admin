import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ops-console palette. Dark-first; floors are color-coded by human need.
        // The `ink.*` surface scale is driven by CSS variables (space-separated
        // RGB channels) so the whole console can flip to a light theme by
        // swapping `--ink-*` under `[data-theme="light"]` (see globals.css) —
        // every `bg-ink-*` / `border-ink-*` (incl. `/opacity`) re-themes for free.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        signal: {
          ok: "#3ddc97",
          info: "#4ea8ff",
          warn: "#ffb340",
          crit: "#ff5d5d",
        },
        // per-need accent colors used by the twin + KPI strip
        need: {
          water: "#3aa0ff",
          energy: "#ffcf4d",
          food: "#5ddc7a",
          shelter: "#c0a4ff",
          air: "#7fe7e0",
          health: "#ff8fb1",
          restoration: "#ffd9a0",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
