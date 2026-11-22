import { describe, expect, it } from "vitest";
import { CreateFeatureInputSchema, FeatureSchema } from "./schema";

const feature = {
  id: "1",
  name: "Search",
  description: "Find things",
  createdAt: "2026-11-21T10:00:00.000Z",
  wireframe: 'Page "Search"',
};

describe("FeatureSchema", () => {
  it("accepts a valid feature", () => {
    expect(FeatureSchema.safeParse(feature).success).toBe(true);
  });

  it("allows an empty description", () => {
    expect(FeatureSchema.safeParse({ ...feature, description: "" }).success).toBe(true);
  });

  it("allows an empty wireframe but requires the field to be a string", () => {
    expect(FeatureSchema.safeParse({ ...feature, wireframe: "" }).success).toBe(true);
    const { wireframe: _wireframe, ...missing } = feature;
    expect(FeatureSchema.safeParse(missing).success).toBe(false);
    expect(FeatureSchema.safeParse({ ...feature, wireframe: 1 }).success).toBe(false);
  });

  it("rejects a blank or whitespace name", () => {
    expect(FeatureSchema.safeParse({ ...feature, name: "" }).success).toBe(false);
    expect(FeatureSchema.safeParse({ ...feature, name: "   " }).success).toBe(false);
  });

  it("rejects unknown keys and missing fields", () => {
    expect(FeatureSchema.safeParse({ ...feature, extra: 1 }).success).toBe(false);
    const { createdAt: _createdAt, ...missing } = feature;
    expect(FeatureSchema.safeParse(missing).success).toBe(false);
  });
});

describe("CreateFeatureInputSchema", () => {
  it("accepts a name with a description, or with an empty description", () => {
    expect(CreateFeatureInputSchema.safeParse({ name: "Search", description: "Find things" }).success).toBe(true);
    expect(CreateFeatureInputSchema.safeParse({ name: "Search", description: "" }).success).toBe(true);
  });

  it("rejects an empty or whitespace name", () => {
    expect(CreateFeatureInputSchema.safeParse({ name: "", description: "" }).success).toBe(false);
    expect(CreateFeatureInputSchema.safeParse({ name: " \t ", description: "" }).success).toBe(false);
  });

  it("rejects unknown keys such as id", () => {
    expect(CreateFeatureInputSchema.safeParse({ name: "Search", description: "", id: "1" }).success).toBe(false);
  });
});
