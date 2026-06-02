"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Shared navigation across the console + fleet + simulator views. Desktop shows
// inline links; mobile gets both a hamburger drawer (top) and an iOS-style
// bottom tab bar for one-thumb reach. Active route is highlighted via pathname.

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Console" },
  { href: "/simulator", label: "Simulator" },
  { href: "/fleet", label: "Fleet" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Minimal line icons for the bottom tab bar, keyed by route.
function NavIcon({ href, className }: { href: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  if (href === "/simulator") {
    // Stacked building — the per-floor twin.
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="1" />
        <line x1="5" y1="9" x2="19" y2="9" />
        <line x1="5" y1="15" x2="19" y2="15" />
        <line x1="10.5" y1="18" x2="13.5" y2="18" />
      </svg>
    );
  }
  if (href === "/fleet") {
    // Globe — the multi-building rollup.
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
      </svg>
    );
  }
  // Console — dashboard grid.
  return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function NavBar() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Close the drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + allow Escape to dismiss while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
    <nav className="sticky top-0 z-40 border-b border-ink-600/50 bg-ink-950/80 backdrop-blur supports-[backdrop-filter]:bg-ink-950/60">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
          aria-label="ATLAS OS home"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-signal-info/30 to-need-air/30 text-sm font-black text-white ring-1 ring-inset ring-white/15"
            aria-hidden
          >
            A
          </span>
          <span className="display text-base font-extrabold tracking-tight text-white lg:text-lg">
            ATLAS&nbsp;OS
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white text-ink-950"
                    : "text-slate-300 hover:bg-ink-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="relative grid h-10 w-10 place-items-center rounded-lg border border-ink-600/70 bg-ink-900/60 text-slate-200 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-signal-info focus-visible:outline-none md:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className="relative block h-4 w-5">
            <span
              className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ${
                open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-1/2 block h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ${
                open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile drawer + overlay */}
      <div
        className={`fixed inset-0 z-30 md:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Overlay */}
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Panel */}
        <div
          id="mobile-nav"
          className={`absolute inset-x-0 top-14 origin-top border-b border-ink-600/50 bg-ink-900/95 px-4 pb-4 pt-2 shadow-2xl backdrop-blur transition-all duration-300 ${
            open
              ? "translate-y-0 opacity-100"
              : "-translate-y-3 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
                      active
                        ? "bg-white text-ink-950"
                        : "text-slate-200 hover:bg-ink-800 active:bg-ink-800"
                    }`}
                  >
                    {item.label}
                    <span aria-hidden className="text-current opacity-60">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>

      {/* Mobile bottom tab bar — one-thumb reach, alongside the hamburger. */}
      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600/50 bg-ink-950/90 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-around">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-colors ${
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                      active ? "bg-white text-ink-950" : "text-current"
                    }`}
                  >
                    <NavIcon href={item.href} className="h-5 w-5" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
