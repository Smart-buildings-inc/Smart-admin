"use client";

import { useEffect, useState } from "react";
import LogoLoader from "@/components/LogoLoader";

const MIN_SPLASH_MS = 900;
const EXIT_ANIMATION_MS = 520;

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let exitTimer: number | undefined;
    let removeTimer: number | undefined;

    exitTimer = window.setTimeout(() => {
      setLeaving(true);
      removeTimer = window.setTimeout(
        () => setVisible(false),
        EXIT_ANIMATION_MS,
      );
    }, MIN_SPLASH_MS);

    return () => {
      if (exitTimer) window.clearTimeout(exitTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="app-splash"
      role="status"
      aria-label="Loading ATLAS OS"
      className={`splash-backdrop fixed inset-0 z-[100] grid place-items-center px-6 transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <LogoLoader />
      <span className="sr-only">Loading ATLAS OS</span>
    </div>
  );
}
