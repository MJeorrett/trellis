import { describe, expect, it } from "vitest";
import { appendFeature, validateFeatureForm } from "./logic";
import type { Feature } from "./schema";

const feature = (id: string): Feature => ({ id, name: id, description: "", createdAt: "2026-11-21T10:00:00.000Z",
  wireframe: "",
});

describe("validateFeatureForm", () => {
  it("trims name and description", () => {
    expect(validateFeatureForm({ name: "  Search ", description: "  Find  " })).toEqual({
      ok: true,
      input: { name: "Search", description: "Find" },
    });
  });

  it("allows an empty description", () => {
    expect(validateFeatureForm({ name: "Search", description: "   " })).toEqual({
      ok: true,
      input: { name: "Search", description: "" },
    });
  });

  it("rejects an empty or whitespace name with a message", () => {
    expect(validateFeatureForm({ name: "", description: "x" })).toEqual({ ok: false, error: "Name is required" });
    expect(validateFeatureForm({ name: "  ", description: "" })).toEqual({ ok: false, error: "Name is required" });
  });
});

describe("appendFeature", () => {
  it("adds the feature at the end without mutating the original list", () => {
    const list = [feature("a"), feature("b")];
    const next = appendFeature(list, feature("c"));
    expect(next.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(list.map((f) => f.id)).toEqual(["a", "b"]);
  });
});
