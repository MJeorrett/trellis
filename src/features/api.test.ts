import { beforeEach, describe, expect, it } from "vitest";
import { createFeature, listFeatures, resetMockFeatures, setMockDelay } from "./api";
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

describe("resetMockFeatures", () => {
  it("restores the seed", async () => {
    const seed = await listFeatures();
    await createFeature({ name: "Extra", description: "" });
    resetMockFeatures();
    setMockDelay(0);
    expect(await listFeatures()).toEqual(seed);
  });
});
