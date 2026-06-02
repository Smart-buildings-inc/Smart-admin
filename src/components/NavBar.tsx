"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Shared top navigation across the console + fleet views. Desktop shows inline
// links; mobile collapses them behind a hamburger that opens an accessible
// slide-down drawer. Active route is highlighted via the current pathname.

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Console" },
  { href: "/fleet", label: "Fleet" },
  { href: "/sitemap", label: "Site Map" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <nav className="sticky top-0 z-40 border-b border-ink-600/50 bg-ink-950/80 backdrop-blur supports-[backdrop-filter]:bg-ink-950/60">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
          aria-label="ATLAS OS home"
        >
          <Image
            src="/icon.svg"
            alt=""
            width={36}
            height={36}
            priority
            unoptimized
            aria-hidden
            className="h-8 w-8 lg:h-9 lg:w-9"
          />
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

      {/* Gradient fade: extends the bar's background downward into a soft fade so
          scrolling content blends with the page bg instead of a hard edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-ink-950/80 to-transparent"
      />

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
  );
}
