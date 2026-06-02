"use client";

// Shared fullscreen behaviour for the 3D stages (twin + simulator).
//
// Uses the native Fullscreen API where available — with the WebKit-prefixed
// fallbacks Safari still ships — and a CSS full-viewport overlay everywhere
// else (notably iOS Safari, which doesn't allow element fullscreen). Esc exits
// both paths, body scroll is locked while expanded, and the hook reconciles its
// own state whenever the user leaves fullscreen via the OS (Esc / gesture).
//
// Returns a ref to attach to the stage element, an `isFullscreen` flag to drive
// the overlay classes, and a `toggle` to wire to the button.

import { useCallback, useEffect, useRef, useState } from "react";

// Tailwind classes that turn the stage into a true full-viewport overlay. Kept
// here so every stage covers the screen identically (above the z-40 nav bars).
export const FULLSCREEN_STAGE_CLASS =
  "fixed inset-0 z-[80] h-[100dvh] w-[100vw] rounded-none border-0";

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function currentFsElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FsDocument;
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    const next = !isFullscreen;
    // Flip state first so the CSS overlay is in place even if the native
    // request is rejected or unsupported (iOS Safari).
    setIsFullscreen(next);
    try {
      if (next) {
        const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
        if (request && !currentFsElement()) {
          const p = request.call(el);
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {});
          }
        }
      } else {
        const d = document as FsDocument;
        const exit = document.exitFullscreen ?? d.webkitExitFullscreen;
        if (exit && currentFsElement()) {
          const p = exit.call(document);
          if (p && typeof (p as Promise<void>).catch === "function") {
            (p as Promise<void>).catch(() => {});
          }
        }
      }
    } catch {
      /* CSS overlay still covers the viewport if native FS is unavailable */
    }
  }, [isFullscreen]);

  // Sync state when the user leaves native fullscreen (Esc / OS gesture).
  useEffect(() => {
    const onChange = () => {
      if (!currentFsElement()) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Esc exits the CSS-only overlay path (iOS), where no native FS session runs.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // Lock body scroll while expanded so the overlay truly owns the screen.
  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  return { ref, isFullscreen, toggle };
}
