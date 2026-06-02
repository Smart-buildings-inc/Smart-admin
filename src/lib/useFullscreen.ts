"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

// Vendor-prefixed shims so this works on Safari (incl. older WebKit) and the
// legacy MS API, not just the standard Fullscreen API.
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? d.msFullscreenElement ?? null;
}

/**
 * Cross-browser fullscreen for a target element.
 *
 * Prefers the native Fullscreen API (with `webkit*` / `ms*` fallbacks for
 * Safari and legacy Edge). On platforms that don't support element fullscreen
 * at all — notably iPhone Safari — it falls back to a CSS "maximize" that pins
 * the element to the viewport, so the button always does something sensible.
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  const [cssFallback, setCssFallback] = useState(false);

  // Keep `active` in sync with native fullscreen changes (e.g. Esc to exit).
  useEffect(() => {
    const onChange = () => setActive(Boolean(fullscreenElement()) || cssFallback);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [cssFallback]);

  // In CSS-fallback mode, Esc should still exit.
  useEffect(() => {
    if (!cssFallback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCssFallback(false);
        setActive(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cssFallback]);

  const toggle = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    const d = document as FsDocument;

    // Currently maximized → restore.
    if (fullscreenElement() || cssFallback) {
      const exit = d.exitFullscreen ?? d.webkitExitFullscreen ?? d.msExitFullscreen;
      if (fullscreenElement() && exit) {
        try {
          await exit.call(d);
        } catch {
          /* ignore */
        }
      }
      setCssFallback(false);
      setActive(false);
      return;
    }

    // Not maximized → request native fullscreen, else CSS fallback.
    const request =
      el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
    if (request) {
      try {
        await request.call(el);
        setActive(true);
        return;
      } catch {
        /* fall through to CSS fallback (e.g. gesture/permission issues) */
      }
    }
    setCssFallback(true);
    setActive(true);
  }, [ref, cssFallback]);

  return { active, cssFallback, toggle };
}
