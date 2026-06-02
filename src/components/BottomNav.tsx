"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActive } from "@/lib/nav";
import NavIcon from "@/components/NavIcons";

// iOS-style tab bar, pinned to the bottom of the viewport on every screen size.
// Frosted, translucent, honors the home-indicator safe area, and every tab
// carries an explicit hover and a slight press (scale-down) state for that
// tactile, native feel. On desktop the tabs settle into a centered pill while
// the bar still spans edge to edge.

export default function BottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40"
    >
      {/* Frosted bar. The pb uses the safe-area inset so tabs sit above the
          iOS home indicator instead of under it. */}
      <div className="border-t border-white/10 bg-ink-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-ink-950/65">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="group flex select-none flex-col items-center gap-1 rounded-2xl px-2 py-1.5 outline-none transition-transform duration-150 ease-out active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-signal-info/70 focus-visible:ring-offset-0"
                >
                  {/* Icon capsule — the active tab gets a soft tinted glow pill,
                      inactive tabs light up gently on hover. */}
                  <span
                    className={`grid h-9 w-14 place-items-center rounded-full transition-all duration-200 ease-out ${
                      active
                        ? "bg-signal-info/15 text-signal-info shadow-[0_0_18px_-4px_theme(colors.signal.info)]"
                        : "text-slate-400 group-hover:bg-white/5 group-hover:text-slate-200 group-active:bg-white/10"
                    }`}
                  >
                    <NavIcon
                      name={item.icon}
                      active={active}
                      className="h-[22px] w-[22px] transition-transform duration-200 ease-out group-active:scale-90"
                    />
                  </span>
                  <span
                    className={`text-[11px] font-semibold leading-none tracking-tight transition-colors duration-200 ${
                      active
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
