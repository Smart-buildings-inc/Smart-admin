"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "@/components/BrandMark";
import ProgressiveBlur from "@/components/ProgressiveBlur";

// Shared top navigation across the console + simulator + fleet views. Desktop
// shows inline links; mobile collapses them behind a hamburger drawer (the
// fixed bottom tab bar in MobileTabBar complements this on phones). Active
// route is highlighted via the current pathname.

type NavItem = { href: string; label: string };
type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "atlas-theme";

const GITHUB_REPO_URL = "https://github.com/Smart-buildings-inc/Smart-admin";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Console" },
  { href: "/simulator", label: "Simulator" },
  { href: "/fleet", label: "Fleet" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/carbon", label: "Carbon" },
  { href: "/landing", label: "Overview" },
  { href: "/for", label: "Solutions" },
  { href: "/brand", label: "Brand" },
  { href: "/sitemap", label: "Site Map" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.style.colorScheme = theme;
}

function ThemeToggleButton({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={theme === "light"}
      title={label}
      data-testid="theme-toggle"
      className="theme-toggle-button relative grid h-10 w-10 place-items-center rounded-lg border border-ink-600/70 bg-ink-900/60 text-slate-200 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
    >
      <span className="sr-only">{label}</span>
      {theme === "dark" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            d="M12 4V2m0 20v-2m6.36-14.36 1.42-1.42M4.22 19.78l1.42-1.42M20 12h2M2 12h2m14.36 6.36 1.42 1.42M4.22 4.22l1.42 1.42"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            d="M20.25 14.15A8.2 8.2 0 0 1 9.85 3.75 8.2 8.2 0 1 0 20.25 14.15Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      )}
    </button>
  );
}

export default function NavBar() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const preferredTheme = window.matchMedia("(prefers-color-scheme: light)")
      .matches
      ? "light"
      : "dark";
    const nextTheme = isThemeMode(storedTheme) ? storedTheme : preferredTheme;

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

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

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-ink-600/50 bg-gradient-to-b from-ink-950 to-ink-950/60 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal-info"
          aria-label="ATLAS OS home"
        >
          <BrandMark className="h-8 w-8 lg:h-9 lg:w-9" />
          <span className="gradient-text-soft display text-base font-extrabold tracking-tight lg:text-lg">
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

        <div className="ml-auto flex items-center gap-2">
          {/* GitHub repo — show off the source */}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
            data-testid="github-link"
            className="relative hidden h-10 w-10 place-items-center rounded-lg border border-ink-600/70 bg-ink-900/60 text-slate-200 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info md:grid"
          >
            <span className="sr-only">View source on GitHub</span>
            <GitHubIcon className="h-5 w-5" />
          </a>

          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="relative grid h-10 w-10 place-items-center rounded-lg border border-ink-600/70 bg-ink-900/60 text-slate-200 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-info md:hidden"
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
      </div>

      {/* Progressive blur beneath the bar: the frosted blur ramps gradually
          down to zero so scrolling content fades out smoothly instead of
          hitting a hard edge. */}
      <ProgressiveBlur side="top" className="top-full h-16" />

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
            <li>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-slate-200 transition-colors hover:bg-ink-800 active:bg-ink-800"
              >
                <span className="flex items-center gap-2.5">
                  <GitHubIcon className="h-5 w-5" />
                  GitHub
                </span>
                <span aria-hidden className="text-current opacity-60">
                  ↗
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
