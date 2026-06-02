"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mobile-only fixed bottom tab bar (iOS-style). Complements the top NavBar's
// hamburger drawer — both stay available on phones. Hidden at md+ where the
// inline desktop links in NavBar take over. Honors the bottom safe-area inset.

type Tab = { href: string; label: string; icon: (active: boolean) => JSX.Element };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Console",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <path
          d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M4 7.5 12 12m0 0 8-4.5M12 12v9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/fleet",
    label: "Fleet",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <path
          d="M4 21V6.5L11 4v17M11 21V9l8 2.5V21"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M7 8.5v.01M7 12v.01M7 15.5v.01M15 14v.01M15 17.5v.01"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function MobileTabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600/50 bg-ink-950/85 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70 md:hidden"
    >
      <ul className="mx-auto flex max-w-[520px] items-stretch justify-around px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal-info ${
                  active
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200 active:text-white"
                }`}
              >
                <span
                  className={`grid h-8 w-12 place-items-center rounded-full transition-colors ${
                    active ? "bg-white/10 ring-1 ring-inset ring-white/15" : ""
                  }`}
                >
                  {tab.icon(active)}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
