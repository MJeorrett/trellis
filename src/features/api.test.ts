import { beforeEach, describe, expect, it } from "vitest";
import { parseSyntax } from "@/syntax/parse";
import { createFeature, getFeature, listFeatures, resetMockFeatures, setMockDelay, updateFeatureWireframe } from "./api";
import { FeatureSchema } from "./schema";

beforeEach(() => {
  resetMockFeatures();
  setMockDelay(0);
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
