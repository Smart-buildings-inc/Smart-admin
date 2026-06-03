export type MarketingParallaxLayers = {
  backdrop: string;
  twin: string;
  foreground: string;
};

export const PARALLAX_SCENES = {
  atlas: {
    backdrop: "/marketing/atlas-parallax-backdrop.jpg",
    twin: "/marketing/atlas-parallax-twin.jpg",
    foreground: "/marketing/atlas-parallax-foreground.jpg",
  },
  solutions: {
    backdrop: "/marketing/solutions-parallax-backdrop.jpg",
    twin: "/marketing/solutions-parallax-twin.jpg",
    foreground: "/marketing/solutions-parallax-foreground.jpg",
  },
  brand: {
    backdrop: "/marketing/brand-parallax-backdrop.jpg",
    twin: "/marketing/brand-parallax-twin.jpg",
    foreground: "/marketing/brand-parallax-foreground.jpg",
  },
  fleet: {
    backdrop: "/marketing/fleet-parallax-backdrop.jpg",
    twin: "/marketing/fleet-parallax-twin.jpg",
    foreground: "/marketing/fleet-parallax-foreground.jpg",
  },
  simulator: {
    backdrop: "/marketing/simulator-parallax-backdrop.jpg",
    twin: "/marketing/simulator-parallax-twin.jpg",
    foreground: "/marketing/simulator-parallax-foreground.jpg",
  },
} satisfies Record<string, MarketingParallaxLayers>;
