"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActive } from "@/lib/nav";

// Top navigation: brand + inline links on desktop. On mobile it shrinks to just
// the brand bar — primary navigation moves to the iOS-style BottomNav, so the
// hamburger drawer is no longer needed. Active route is highlighted via the
// current pathname.

export default function NavBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="sticky top-0 z-40 border-b border-ink-600/50 bg-ink-950/80 backdrop-blur supports-[backdrop-filter]:bg-ink-950/60">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg outline-none transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-signal-info"
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
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.96] ${
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
      </div>
    </nav>
  );
}
