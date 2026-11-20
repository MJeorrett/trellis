import { describe, expect, it } from "vitest";
import { AstSchema } from "./ast";

/** Simple Login Form: Email input, Password input, Submit button. */
type RawNode = { type: string; text: unknown; children: RawNode[] };

const loginForm: RawNode = {
  type: "Box",
  text: "",
  children: [
    { type: "Text", text: "Log in", children: [] },
    {
      type: "Box",
      text: "",
      children: [
        { type: "Text", text: "Email", children: [] },
        { type: "Box", text: "you@example.com", children: [] },
      ],
    },
    {
      type: "Box",
      text: "",
      children: [
        { type: "Text", text: "Password", children: [] },
        { type: "Box", text: "********", children: [] },
      ],
    },
    { type: "Box", text: "Submit", children: [] },
  ],
};

describe("AstSchema", () => {
  it("accepts a valid nested Login Form payload", () => {
    const result = AstSchema.safeParse(loginForm);
    expect(result.success).toBe(true);
  });

  it("round-trips the payload through JSON", () => {
    const parsed = AstSchema.parse(JSON.parse(JSON.stringify(loginForm)));
    expect(parsed).toEqual(loginForm);
  });

  it("rejects an unknown node type", () => {
    const bad = { ...loginForm, children: [{ type: "Button", text: "", children: [] }] };
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a Row node with and without children and text", () => {
    expect(AstSchema.safeParse({ type: "Row", text: "", children: [] }).success).toBe(true);
    expect(AstSchema.safeParse({ type: "Row", text: "Label", children: [] }).success).toBe(true);
    const withChildren = {
      type: "Row",
      text: "Actions",
      children: [
        { type: "Box", text: "Cancel", children: [] },
        { type: "Box", text: "Submit", children: [] },
      ],
    };
    expect(AstSchema.safeParse(withChildren).success).toBe(true);
    expect(AstSchema.parse(withChildren)).toEqual(withChildren);
  });

  it("rejects a lowercase row type", () => {
    expect(AstSchema.safeParse({ type: "row", text: "", children: [] }).success).toBe(false);
  });

  it("rejects invalid nodes deep in the tree", () => {
    const bad = structuredClone(loginForm);
    bad.children[1]!.children[1]!.children = [{ type: "Box", text: 42, children: [] }];
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(AstSchema.safeParse({ type: "Box", text: "" }).success).toBe(false);
    expect(AstSchema.safeParse({ text: "", children: [] }).success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(AstSchema.safeParse({ ...loginForm, color: "red" }).success).toBe(false);
  });

  it("rejects an id property", () => {
    expect(AstSchema.safeParse({ ...loginForm, id: "root" }).success).toBe(false);
  });
});
