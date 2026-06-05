"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import {
  PARALLAX_SCENES,
  type MarketingParallaxLayers,
} from "@/lib/marketingParallax";

export default function MarketingParallax({
  accent = "#7fe7e0",
  className = "",
  compact = false,
  label = "ATLAS habitat layered visual",
  layers = PARALLAX_SCENES.atlas,
}: {
  accent?: string;
  className?: string;
  compact?: boolean;
  label?: string;
  layers?: MarketingParallaxLayers;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const mobile = window.matchMedia("(max-width: 640px)");
    const tablet = window.matchMedia("(max-width: 900px)");

    let frame = 0;
    let active = false;

    const clamp = (value: number, min = 0, max = 1) =>
      Math.min(max, Math.max(min, value));

    const smoothstep = (value: number) => {
      const t = clamp(value);
      return t * t * (3 - 2 * t);
    };

    const update = () => {
      frame = 0;
      if (!active) return;

      const rect = el.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      const progress = Math.min(
        1,
        Math.max(0, (window.innerHeight - rect.top) / total),
      );
      const story = smoothstep((progress - 0.08) / 0.84);
      const centered = story - 0.5;
      const intensity = mobile.matches ? 0.56 : tablet.matches ? 0.78 : 1;
      const base = mobile.matches
        ? { back: 1.28, twin: 1.08, front: 1.22, blur: 3.5, backOpacity: 0.5 }
        : { back: 1.16, twin: 0.92, front: 1.1, blur: 4.5, backOpacity: 0.55 };

      el.style.setProperty("--parallax-progress", story.toFixed(3));
      el.style.setProperty("--parallax-back", `${(centered * 20 * intensity).toFixed(2)}px`);
      el.style.setProperty("--parallax-mid", `${(centered * -28 * intensity).toFixed(2)}px`);
      el.style.setProperty("--parallax-front", `${(centered * -42 * intensity).toFixed(2)}px`);
      el.style.setProperty("--parallax-float", `${(centered * 10 * intensity).toFixed(2)}px`);
      el.style.setProperty("--parallax-back-scale", (base.back - story * 0.11 * intensity).toFixed(3));
      el.style.setProperty("--parallax-twin-scale", (base.twin + story * 0.11 * intensity).toFixed(3));
      el.style.setProperty("--parallax-front-scale", (base.front + story * 0.15 * intensity).toFixed(3));
      el.style.setProperty("--parallax-back-blur", `${(base.blur + story * 5.5 * intensity).toFixed(2)}px`);
      el.style.setProperty("--parallax-back-opacity", (base.backOpacity - story * 0.13 * intensity).toFixed(3));
      el.style.setProperty("--parallax-back-brightness", (0.77 - story * 0.12 * intensity).toFixed(3));
      el.style.setProperty("--parallax-twin-opacity", (0.88 + story * 0.07 * intensity).toFixed(3));
      el.style.setProperty("--parallax-front-opacity", (0.9 + story * 0.08 * intensity).toFixed(3));
      el.style.setProperty("--parallax-grid-opacity", (0.2 - story * 0.08 * intensity).toFixed(3));
      el.style.setProperty("--parallax-veil-opacity", (0.9 + story * 0.1 * intensity).toFixed(3));
    };

    const schedule = () => {
      if (!active) return;
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        active = Boolean(entry?.isIntersecting);
        if (active) schedule();
      },
      { rootMargin: "160px" },
    );

    observer.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
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
          src={layers.backdrop}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="marketing-parallax__image marketing-parallax__backdrop"
        />
        <Image
          src={layers.twin}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 900px, 100vw"
          className="marketing-parallax__image marketing-parallax__twin"
        />
        <Image
          src={layers.foreground}
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
