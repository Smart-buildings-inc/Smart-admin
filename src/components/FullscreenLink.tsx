"use client";

// Shared "open fullscreen viewer" affordance for the 3D stages (twin + simulator).
//
// Both 3D viewers expose this in their top-right control cluster. Rather than
// toggling an in-place overlay, it links to the dedicated full-screen viewer
// page (/simulate/atlas-01) which renders the twin edge-to-edge on every device.
// Styled to match the other round stage controls.

import Link from "next/link";
import { CornersOut } from "@phosphor-icons/react";

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
      <CornersOut aria-hidden weight="duotone" className="h-4 w-4" />
    </Link>
  );
}
