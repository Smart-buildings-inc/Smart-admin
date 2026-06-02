"use client";

import { useEffect } from "react";

// Registers the app-shell service worker once on the client. Kept tiny and
// side-effect only — it renders nothing. Skipped in dev to avoid caching churn
// while iterating.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app still works without offline support.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
