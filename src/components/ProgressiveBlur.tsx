import type { CSSProperties } from "react";

// Progressive (gradient) backdrop blur. Stacks several masked backdrop-filter
// layers so the blur ramps from strong (next to the bar) down to zero across
// the strip — the frosted blur of the nav fades out smoothly instead of ending
// at a hard line. Rendered beneath the top NavBar and above the bottom
// MobileTabBar. Purely decorative + non-interactive.

type Side = "top" | "bottom";

// Heavier blur is masked tight against the bar; lighter blur reaches further
// out. Stacked, the layers add up to a smooth strong→clear ramp. Percentages
// run away from the bar (0% = the edge touching the bar).
const LAYERS: { blur: number; stops: string }[] = [
  { blur: 12, stops: "#000 0%, #000 16%, transparent 40%" },
  { blur: 8, stops: "transparent 0%, #000 16%, #000 33%, transparent 56%" },
  { blur: 4, stops: "transparent 16%, #000 33%, #000 50%, transparent 72%" },
  { blur: 2, stops: "transparent 33%, #000 50%, #000 66%, transparent 88%" },
  { blur: 1, stops: "transparent 50%, #000 66%, #000 83%, transparent 100%" },
];

export default function ProgressiveBlur({
  side,
  className = "",
}: {
  side: Side;
  className?: string;
}) {
  // Gradient runs away from the bar: the top bar sits above its strip (ramp
  // downward), the bottom bar sits below its strip (ramp upward).
  const dir = side === "top" ? "to bottom" : "to top";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${className}`}
    >
      {LAYERS.map((layer, i) => {
        const mask = `linear-gradient(${dir}, ${layer.stops})`;
        const style: CSSProperties = {
          position: "absolute",
          inset: 0,
          backdropFilter: `blur(${layer.blur}px)`,
          WebkitBackdropFilter: `blur(${layer.blur}px)`,
          maskImage: mask,
          WebkitMaskImage: mask,
        };
        return <div key={i} style={style} />;
      })}
    </div>
  );
}
