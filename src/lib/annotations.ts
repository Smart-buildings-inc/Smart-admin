// Narrative annotations surfaced during the 3D walk-through and in AR.
// Each maps to a floor key; `quote` renders in the bold-italic Apple style,
// `arrow` points the eye toward the slab. Tone is deliberately futuristic.

export interface Annotation {
  floorKey: string;
  /** Short emphatic line — the "this is the future of housing" voice. */
  quote: string;
  /** Supporting one-liner. */
  caption: string;
  /** Direction the callout arrow points toward the floor. */
  arrow: "left" | "right";
}

export const annotations: Annotation[] = [
  {
    floorKey: "skydeck-reservoir",
    quote: "The sky is the foundation.",
    caption: "Shared rooftop pool — thermal store, water reserve, and commons in one.",
    arrow: "right",
  },
  {
    floorKey: "penthouses",
    quote: "Twelve homes above the clouds.",
    caption: "Up to 12 penthouses sharing the rooftop pool directly overhead.",
    arrow: "left",
  },
  {
    floorKey: "the-lung",
    quote: "The building breathes.",
    caption: "A living atrium scrubs the air for every floor below.",
    arrow: "right",
  },
  {
    floorKey: "vertical-farm",
    quote: "Dinner grows in the walls.",
    caption: "Fresh produce, herbs, and mushrooms — harvested floors from your door.",
    arrow: "left",
  },
  {
    floorKey: "aquaponics-bay",
    quote: "Fish feed the greens. Greens clean the water.",
    caption: "A closed protein loop — nothing leaves, nothing is wasted.",
    arrow: "right",
  },
  {
    floorKey: "power-ops-core",
    quote: "Off-grid by design.",
    caption: "Solar, a battery wall, and biogas — run by AI that never holds life-safety.",
    arrow: "left",
  },
  {
    floorKey: "reclamation-core",
    quote: "Underground, the loop closes.",
    caption: "Water reclaimed, waste digested into energy and fertilizer. The beginning is below.",
    arrow: "right",
  },
];

export const annotationByFloor: Map<string, Annotation> = new Map(
  annotations.map((a) => [a.floorKey, a]),
);
