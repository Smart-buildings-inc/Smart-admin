"use client";

import { useEffect, useState } from "react";

// Animated brand cube for the NavBar. This is an inline, living variant of the
// static /icon.svg favicon: the same isometric ATLAS cube, but its three faces
// share one continuous need-palette gradient that flows horizontally — visually
// matched to the .gradient-text wordmark beside it. The dark rounded-rect base,
// face shading (per-face opacity), and the raised A/O/S letters are preserved so
// the mark stays legible. The static SVG is kept untouched for favicons/OG.
//
// Accessibility: the flow stops for `prefers-reduced-motion: reduce` (SMIL can't
// be driven by CSS media queries, so we conditionally omit the <animate>). The
// mark is decorative — the parent Link carries the accessible name.

export default function BrandMark({ className }: { className?: string }) {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* One horizontal need-palette gradient spanning 2× the icon width, with
            the palette repeated twice so a -64u shift loops seamlessly. */}
        <linearGradient
          id="brandFlow"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="128"
          y2="0"
        >
          <stop offset="0" stopColor="#4ea8ff" />
          <stop offset="0.11" stopColor="#7fe7e0" />
          <stop offset="0.22" stopColor="#5ddc7a" />
          <stop offset="0.33" stopColor="#c0a4ff" />
          <stop offset="0.41" stopColor="#ff8fb1" />
          <stop offset="0.5" stopColor="#4ea8ff" />
          <stop offset="0.61" stopColor="#7fe7e0" />
          <stop offset="0.72" stopColor="#5ddc7a" />
          <stop offset="0.83" stopColor="#c0a4ff" />
          <stop offset="0.91" stopColor="#ff8fb1" />
          <stop offset="1" stopColor="#4ea8ff" />
          {animate && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="0 0"
              to="-64 0"
              dur="6s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="62" height="62" rx="14" fill="#0a0d11" />

      {/* Faces — all flow the same gradient; per-face opacity recreates the
          isometric shading (top brightest, sides progressively dimmer). */}
      <polygon
        points="32,6 54.5,19 32,32 9.5,19"
        fill="url(#brandFlow)"
        stroke="#586068"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <polygon
        points="9.5,19 32,32 32,58 9.5,45"
        fill="url(#brandFlow)"
        fillOpacity="0.62"
        stroke="#586068"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <polygon
        points="32,32 54.5,19 54.5,45 32,58"
        fill="url(#brandFlow)"
        fillOpacity="0.82"
        stroke="#586068"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Raised A / O / S letters (kept bright for legibility over the faces). */}
      <g
        transform="matrix(0.2252,0.13,-0.2252,0.13,32,6)"
        stroke="#ffffff"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M30 80 L50 22 L70 80 M38 60 L62 60" />
      </g>
      <g
        transform="matrix(0.2252,0.13,0,0.26,9.5,19)"
        stroke="#f4f8ff"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <rect x="27" y="25" width="46" height="54" rx="15" />
      </g>
      <g
        transform="matrix(0.2252,-0.13,0,0.26,32,32)"
        stroke="#eef3ff"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M67 34 C67 23 33 23 33 40 C33 53 67 51 67 67 C67 84 33 84 33 71" />
      </g>
    </svg>
  );
}
