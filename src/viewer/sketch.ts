export type SketchStyle = { borderRadius: string; transform: string };

/**
 * How sketchy the look is: scales both the corner wobble and the tilt.
 * `1` is the original, very wobbly look; `0.4` was too tame, so it is `0.7` (CI-009 follow-up).
 */
const SKETCHINESS = 0.7;

/**
 * Base (sketchiness 1) variants: eight corner radii in px (the `a b c d / e f g h`
 * form) and a tilt in degrees. Radii are kept modest because browsers clamp
 * oversized radii on short boxes, which would hide any scaling.
 */
const BASE_VARIANTS: readonly { radii: readonly number[]; tilt: number }[] = [
  { radii: [60, 6, 54, 6, 6, 54, 6, 60], tilt: -0.6 },
  { radii: [6, 54, 6, 60, 60, 6, 54, 6], tilt: 0.4 },
  { radii: [54, 8, 60, 6, 6, 60, 8, 54], tilt: -0.3 },
  { radii: [6, 60, 8, 54, 54, 8, 60, 6], tilt: 0.7 },
  { radii: [60, 6, 56, 10, 8, 56, 6, 60], tilt: 0.2 },
  { radii: [10, 56, 6, 60, 60, 6, 56, 8], tilt: -0.8 },
];

/** A fixed set of hand-drawn looks. Every tilt is under 1 degree. */
const VARIANTS: readonly SketchStyle[] = BASE_VARIANTS.map(({ radii, tilt }) => {
  const px = radii.map((radius) => `${Math.max(1, Math.round(radius * SKETCHINESS))}px`);
  return {
    borderRadius: `${px.slice(0, 4).join(" ")} / ${px.slice(4).join(" ")}`,
    transform: `rotate(${Number((tilt * SKETCHINESS).toFixed(2))}deg)`,
  };
});

/**
 * Picks a sketchy border radius and tilt for a node. Pure and deterministic:
 * the same non-negative integer seed always gives the same style (no randomness).
 */
export function sketchStyle(seed: number): SketchStyle {
  return VARIANTS[Math.abs(Math.trunc(seed)) % VARIANTS.length]!;
}

/** Derives a stable non-negative integer seed from a node's child-index path (FNV-1a). */
export function seedFromPath(path: readonly number[]): number {
  let hash = 2166136261;
  for (const index of [path.length, ...path]) {
    hash = Math.imul(hash ^ index, 16777619) >>> 0;
  }
  return hash;
}
