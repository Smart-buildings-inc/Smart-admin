export interface SimulatorCameraLayout {
  fov: number;
  maxDistance: number;
  minDistance: number;
  position: [number, number, number];
  target: [number, number, number];
}

export function simulatorCameraForViewport(
  width: number,
  height: number,
  totalHeight: number,
): SimulatorCameraLayout {
  const aspect = width > 0 && height > 0 ? width / height : 1.6;
  const portrait = aspect < 0.82;
  const compact = aspect < 1.18;
  // The simulator includes a 26 x 22 m site plane around the tower. Framing
  // against that full architectural footprint prevents the plaza and rooftop
  // from clipping behind the responsive control overlay.
  const distance = portrait ? 78 : compact ? 60 : 48;
  const targetY = totalHeight * 0.47;

  return {
    fov: portrait ? 48 : compact ? 44 : 40,
    position: [
      distance * (portrait ? 0.38 : 0.5),
      targetY + totalHeight * (portrait ? 0.16 : 0.11),
      distance * (portrait ? 0.82 : 0.72),
    ],
    target: [0, targetY, 0],
    minDistance: portrait ? 18 : compact ? 14 : 10,
    maxDistance: portrait ? 94 : compact ? 78 : 64,
  };
}
