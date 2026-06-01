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
        ink: {
          950: "#070b10",
          900: "#0b121a",
          800: "#101a24",
          700: "#17242f",
          600: "#22323f",
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
