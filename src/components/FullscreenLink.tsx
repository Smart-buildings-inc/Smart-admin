"use client";

// Shared "open fullscreen viewer" affordance for the 3D stages (twin + simulator).
//
// Both 3D viewers expose this in their top-right control cluster. Rather than
// toggling an in-place overlay, it links to the dedicated full-screen viewer
// page (/simulate/atlas-01) which renders the twin edge-to-edge on every device.
// Styled to match the other round stage controls.

import Link from "next/link";

export default function FullscreenLink({
  href = "/simulate/atlas-01",
  label = "Open fullscreen viewer",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title="Fullscreen viewer"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-600/70 bg-ink-900/80 text-slate-200 backdrop-blur transition-colors hover:bg-ink-800 hover:text-white"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4H4v4M16 4h4v4M16 20h4v-4M8 20H4v-4" />
      </svg>
    </Link>
  );
}
