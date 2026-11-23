import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSyntax } from "@/syntax/parse";
import {
  createFeature,
  FEATURES_STORAGE_KEY,
  getFeature,
  listFeatures,
  resetMockFeatures,
  setMockDelay,
  updateFeatureWireframe,
} from "./api";
import { FeatureSchema, type Feature } from "./schema";

const fakeLocalStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

let local: ReturnType<typeof fakeLocalStorage>;

const stored = (): Feature[] => JSON.parse(local.getItem(FEATURES_STORAGE_KEY)!);

beforeEach(() => {
  local = fakeLocalStorage();
  vi.stubGlobal("localStorage", local);
  resetMockFeatures();
  setMockDelay(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local storage", () => {
  it("fills an empty local storage with the seed on first use", async () => {
    expect(local.getItem(FEATURES_STORAGE_KEY)).toBeNull();
    const features = await listFeatures();
    expect(features).toHaveLength(3);
    expect(stored()).toEqual(features);
  });

  it("uses what is already stored instead of the seed", async () => {
    const existing: Feature[] = [
      { id: "mine", name: "Mine", description: "", createdAt: "2026-01-01T00:00:00.000Z", wireframe: "" },
    ];
    local.setItem(FEATURES_STORAGE_KEY, JSON.stringify(existing));
    expect(await listFeatures()).toEqual(existing);
    expect(await getFeature("mine")).toEqual(existing[0]);
  });

  it("stores a created feature", async () => {
    const created = await createFeature({ name: "Search", description: "" });
    expect(stored().at(-1)).toEqual(created);
    expect(stored()).toHaveLength(4);
  });

  it("stores an updated wire frame", async () => {
    const [first] = await listFeatures();
    await updateFeatureWireframe(first!.id, "changed");
    expect(stored()[0]).toEqual({ ...first, wireframe: "changed" });
  });

  it("does not store a rejected create or update", async () => {
    await listFeatures();
    const before = local.getItem(FEATURES_STORAGE_KEY);
    await expect(createFeature({ name: " ", description: "" })).rejects.toBeInstanceOf(Error);
    await expect(updateFeatureWireframe("nope", "x")).rejects.toBeInstanceOf(Error);
    expect(local.getItem(FEATURES_STORAGE_KEY)).toBe(before);
  });

  it("keeps features across a reload, which is a new read of the same storage", async () => {
    const created = await createFeature({ name: "Search", description: "" });
    const [first] = await listFeatures();
    await updateFeatureWireframe(first!.id, "changed");
    const features = await listFeatures();
    expect(features.at(-1)).toEqual(created);
    expect(features[0]!.wireframe).toBe("changed");
  });

  it.each([["not json"], ['{"a":1}'], ['[{"id":"x"}]']])("replaces unusable stored data %j with the seed", async (raw) => {
    local.setItem(FEATURES_STORAGE_KEY, raw);
    expect(await listFeatures()).toHaveLength(3);
    expect(stored()).toHaveLength(3);
  });

  it("works without a usable localStorage", async () => {
    vi.stubGlobal("localStorage", undefined);
    resetMockFeatures();
    const created = await createFeature({ name: "Search", description: "" });
    expect((await listFeatures()).at(-1)).toEqual(created);
    resetMockFeatures();
    expect(await listFeatures()).toHaveLength(3);
  });
});

describe("listFeatures", () => {
  it("returns the seeded features, valid and oldest first", async () => {
    const features = await listFeatures();
    expect(features.length).toBeGreaterThanOrEqual(2);
    for (const feature of features) expect(FeatureSchema.safeParse(feature).success).toBe(true);
    const times = features.map((f) => f.createdAt);
    expect([...times].sort()).toEqual(times);
  });

  it("returns copies that do not change the store", async () => {
    const first = await listFeatures();
    first[0]!.name = "Changed";
    first.pop();
    const second = await listFeatures();
    expect(second.length).toBe(first.length + 1);
    expect(second[0]!.name).not.toBe("Changed");
  });
});

describe("createFeature", () => {
  it("creates a feature with a generated id and createdAt and trimmed values", async () => {
    const before = await listFeatures();
    const created = await createFeature({ name: "  Search  ", description: "  Find things  " });
    expect(created.name).toBe("Search");
    expect(created.description).toBe("Find things");
    expect(created.wireframe).toBe("");
    expect(created.id).not.toBe("");
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(FeatureSchema.safeParse(created).success).toBe(true);
    expect(before.some((f) => f.id === created.id)).toBe(false);

    const after = await listFeatures();
    expect(after.length).toBe(before.length + 1);
    expect(after.at(-1)).toEqual(created);
  });

  it("generates distinct ids", async () => {
    const a = await createFeature({ name: "A", description: "" });
    const b = await createFeature({ name: "B", description: "" });
    expect(a.id).not.toBe(b.id);
  });

  it("rejects a blank name with an Error and does not add a feature", async () => {
    const before = await listFeatures();
    await expect(createFeature({ name: "   ", description: "x" })).rejects.toBeInstanceOf(Error);
    await expect(createFeature({ name: "", description: "" })).rejects.toThrow("Name is required");
    expect(await listFeatures()).toEqual(before);
  });

  it("returns a copy that does not change the store", async () => {
    const created = await createFeature({ name: "Search", description: "" });
    created.name = "Changed";
    const list = await listFeatures();
    expect(list.at(-1)!.name).toBe("Search");
  });
});

describe("getFeature", () => {
  it("resolves a known feature", async () => {
    const [first] = await listFeatures();
    expect(await getFeature(first!.id)).toEqual(first);
  });

  it("resolves undefined for an unknown id", async () => {
    expect(await getFeature("nope")).toBeUndefined();
  });

  it("returns copies that do not change the store", async () => {
    const [first] = await listFeatures();
    const feature = (await getFeature(first!.id))!;
    feature.wireframe = "changed";
    expect((await getFeature(first!.id))!.wireframe).toBe(first!.wireframe);
  });
});

describe("updateFeatureWireframe", () => {
  it("updates the wire frame, which persists in getFeature and listFeatures", async () => {
    const [first] = await listFeatures();
    const updated = await updateFeatureWireframe(first!.id, 'Page "New"');
    expect(updated).toEqual({ ...first, wireframe: 'Page "New"' });
    expect(FeatureSchema.safeParse(updated).success).toBe(true);
    expect((await getFeature(first!.id))!.wireframe).toBe('Page "New"');
    expect((await listFeatures())[0]!.wireframe).toBe('Page "New"');
  });

  it("allows an empty wire frame", async () => {
    const [first] = await listFeatures();
    expect((await updateFeatureWireframe(first!.id, "")).wireframe).toBe("");
  });

  it("only changes the given feature", async () => {
    const before = await listFeatures();
    await updateFeatureWireframe(before[0]!.id, "x");
    const after = await listFeatures();
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it("rejects with an Error for an unknown id", async () => {
    await expect(updateFeatureWireframe("nope", "x")).rejects.toBeInstanceOf(Error);
  });

  it("returns a copy that does not change the store", async () => {
    const [first] = await listFeatures();
    const updated = await updateFeatureWireframe(first!.id, "x");
    updated.wireframe = "changed";
    expect((await getFeature(first!.id))!.wireframe).toBe("x");
  });
});

describe("seeded wire frames", () => {
  it("all parse with parseSyntax and are different from each other", async () => {
    const features = await listFeatures();
    expect(features).toHaveLength(3);
    for (const feature of features) {
      expect(feature.wireframe).not.toBe("");
      expect(parseSyntax(feature.wireframe).ok).toBe(true);
    }
    expect(new Set(features.map((f) => f.wireframe)).size).toBe(features.length);
  });
});

describe("resetMockFeatures", () => {
  it("restores the seed", async () => {
    const seed = await listFeatures();
    await createFeature({ name: "Extra", description: "" });
    resetMockFeatures();
    setMockDelay(0);
    expect(await listFeatures()).toEqual(seed);
  });

  it("restores the seeded wire frames", async () => {
    const seed = await listFeatures();
    await updateFeatureWireframe(seed[0]!.id, "changed");
    resetMockFeatures();
    setMockDelay(0);
    expect(await listFeatures()).toEqual(seed);
  });
});
