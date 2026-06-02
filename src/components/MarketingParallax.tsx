"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const LAYERS = {
  backdrop: "/marketing/atlas-parallax-backdrop.jpg",
  twin: "/marketing/atlas-parallax-twin.jpg",
  foreground: "/marketing/atlas-parallax-foreground.jpg",
};

export default function MarketingParallax({
  accent = "#7fe7e0",
  className = "",
  compact = false,
  label = "ATLAS habitat layered visual",
}: {
  accent?: string;
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      const progress = Math.min(
        1,
        Math.max(0, (window.innerHeight - rect.top) / total),
      );
      const centered = progress - 0.5;
      el.style.setProperty("--parallax-back", `${centered * -38}px`);
      el.style.setProperty("--parallax-mid", `${centered * 64}px`);
      el.style.setProperty("--parallax-front", `${centered * -88}px`);
      el.style.setProperty("--parallax-float", `${centered * 16}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-testid="marketing-parallax"
      style={{ ["--accent" as string]: accent }}
      className={`marketing-parallax ${compact ? "marketing-parallax--compact" : ""} ${className}`}
    >
      <div
        role="img"
        aria-label={label}
        className="marketing-parallax__viewport"
      >
        <Image
          src={LAYERS.backdrop}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="marketing-parallax__image marketing-parallax__backdrop"
        />
        <Image
          src={LAYERS.twin}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 900px, 100vw"
          className="marketing-parallax__image marketing-parallax__twin"
        />
        <Image
          src={LAYERS.foreground}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="marketing-parallax__image marketing-parallax__foreground"
        />
        <div aria-hidden className="marketing-parallax__veil" />
        <div aria-hidden className="marketing-parallax__grid" />
        <div aria-hidden className="marketing-parallax__edge" />
      </div>
    </div>
  );
}
