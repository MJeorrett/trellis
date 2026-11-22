import { describe, expect, it } from "vitest";
import { seedFromPath, sketchStyle } from "./sketch";

describe("sketchStyle", () => {
  it("is deterministic", () => {
    for (const seed of [0, 1, 7, 12345, Number.MAX_SAFE_INTEGER]) {
      expect(sketchStyle(seed)).toEqual(sketchStyle(seed));
    }
  });

  it("works for any non-negative integer seed, including a large one", () => {
    for (const seed of [0, 1, 2 ** 31, 2 ** 32 + 5, Number.MAX_SAFE_INTEGER]) {
      const style = sketchStyle(seed);
      expect(style.borderRadius).toBeTruthy();
      expect(style.transform).toBeTruthy();
    }
  });

  it("gives at least 3 distinct results across seeds", () => {
    const results = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(sketchStyle(seed))));
    expect(results.size).toBeGreaterThanOrEqual(3);
  });

  it("only ever tilts by less than 1 degree, in either direction", () => {
    for (let seed = 0; seed < 100; seed++) {
      const match = /^rotate\((-?\d+(?:\.\d+)?)deg\)$/.exec(sketchStyle(seed).transform);
      expect(match).not.toBeNull();
      expect(Math.abs(Number(match![1]))).toBeLessThan(1);
    }
  });

  it("uses the eight-value border-radius form", () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(sketchStyle(seed).borderRadius).toMatch(/^(\d+px ){3}\d+px \/ (\d+px ){3}\d+px$/);
    }
  });
});

describe("seedFromPath", () => {
  it("is deterministic and a non-negative integer", () => {
    const seed = seedFromPath([0, 2, 1]);
    expect(seedFromPath([0, 2, 1])).toBe(seed);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  it("differs for different paths", () => {
    expect(seedFromPath([0])).not.toBe(seedFromPath([1]));
    expect(seedFromPath([0, 1])).not.toBe(seedFromPath([1, 0]));
  });
});
