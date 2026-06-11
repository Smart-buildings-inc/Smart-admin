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
        // glass whites — fixed white values at low opacity for backdrop layers
        glass: {
          white: {
            5: "rgba(255,255,255,0.05)",
            8: "rgba(255,255,255,0.08)",
            10: "rgba(255,255,255,0.10)",
            14: "rgba(255,255,255,0.14)",
            18: "rgba(255,255,255,0.18)",
            25: "rgba(255,255,255,0.25)",
          },
          black: {
            4: "rgba(0,0,0,0.04)",
            8: "rgba(0,0,0,0.08)",
            12: "rgba(0,0,0,0.12)",
            20: "rgba(0,0,0,0.20)",
            32: "rgba(0,0,0,0.32)",
            55: "rgba(0,0,0,0.55)",
          },
        },
      },

      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: [
          '"SF Pro Display"', '"SF Pro Text"', '-apple-system',
          'BlinkMacSystemFont', '"Helvetica Neue"', 'Inter',
          'system-ui', 'sans-serif',
        ],
      },

      fontSize: {
        // Display sizes for hero / section headings
        "display-xs": ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-sm": ["1.5rem", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "800" }],
        "display": ["1.875rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-lg": ["2.25rem", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-xl": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-2xl": ["3.75rem", { lineHeight: "1.03", letterSpacing: "-0.03em", fontWeight: "800" }],
      },

      borderRadius: {
        // Fine-grained radius scale for panel/button/icon consistency
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
        "3xl": "20px",
      },

      boxShadow: {
        // Elevation layers matching MacOS / iOS depth hierarchy
        "elevation-0": "none",
        "elevation-1": "0 1px 2px rgba(0,0,0,0.18), 0 0 1px rgba(0,0,0,0.12)",
        "elevation-2": "0 2px 8px rgba(0,0,0,0.24), 0 0 2px rgba(0,0,0,0.12)",
        "elevation-3": "0 4px 16px rgba(0,0,0,0.32), 0 0 4px rgba(0,0,0,0.14)",
        "elevation-4": "0 8px 30px rgba(0,0,0,0.40), 0 0 8px rgba(0,0,0,0.16)",
        "elevation-5": "0 16px 60px rgba(0,0,0,0.48), 0 0 12px rgba(0,0,0,0.18)",
        // Glass-specific inner glow
        "glass": "0 0 0 1px rgba(255,255,255,0.06) inset",
        "glass-lg": "0 0 0 1px rgba(255,255,255,0.10) inset",
        // Signal glow (for active badges / critical indicators)
        "glow-ok": "0 0 12px rgba(61,220,151,0.25)",
        "glow-info": "0 0 12px rgba(78,168,255,0.25)",
        "glow-warn": "0 0 12px rgba(255,179,64,0.25)",
        "glow-crit": "0 0 12px rgba(255,93,93,0.25)",
        // Accent glow per need (reusable via inline --accent)
        "glow-accent": "0 0 20px color-mix(in srgb, var(--accent, #4ea8ff) 20%, transparent)",
      },

      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "40px",
      },

      transitionDuration: {
        fast: "120ms",
        normal: "200ms",
        slow: "350ms",
        gentle: "500ms",
      },

      transitionTimingFunction: {
        "apple-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
        "apple-in": "cubic-bezier(0.4, 0, 0.6, 1)",
        "apple-out": "cubic-bezier(0.2, 0, 0, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "75%, 100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "skeleton": {
          "0%": { opacity: "0.06" },
          "50%": { opacity: "0.18" },
          "100%": { opacity: "0.06" },
        },
      },

      animation: {
        "fade-in": "fade-in 0.3s apple-ease both",
        "fade-in-up": "fade-in-up 0.4s apple-ease both",
        "fade-in-down": "fade-in-down 0.3s apple-ease both",
        "fade-in-scale": "fade-in-scale 0.35s apple-ease both",
        "scale-in": "scale-in 0.25s apple-ease both",
        "slide-up": "slide-up 0.4s apple-ease both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "ping-soft": "ping-soft 1.5s ease-in-out infinite",
        "skeleton": "skeleton 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
