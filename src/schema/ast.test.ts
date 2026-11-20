import { describe, expect, it } from "vitest";
import { AstSchema } from "./ast";

/** Simple Login Form: Email input, Password input, Submit button. */
type RawNode = { id: string; type: string; text: unknown; children: RawNode[] };

const loginForm: RawNode = {
  id: "login-form",
  type: "Box",
  text: "",
  children: [
    { id: "title", type: "Text", text: "Log in", children: [] },
    {
      id: "email-field",
      type: "Box",
      text: "",
      children: [
        { id: "email-label", type: "Text", text: "Email", children: [] },
        { id: "email-input", type: "Box", text: "you@example.com", children: [] },
      ],
    },
    {
      id: "password-field",
      type: "Box",
      text: "",
      children: [
        { id: "password-label", type: "Text", text: "Password", children: [] },
        { id: "password-input", type: "Box", text: "********", children: [] },
      ],
    },
    { id: "submit-button", type: "Box", text: "Submit", children: [] },
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
    const bad = { ...loginForm, children: [{ id: "x", type: "Button", text: "", children: [] }] };
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects invalid nodes deep in the tree", () => {
    const bad = structuredClone(loginForm);
    bad.children[1]!.children[1]!.children = [{ id: "bad", type: "Box", text: 42, children: [] }];
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(AstSchema.safeParse({ id: "a", type: "Box", text: "" }).success).toBe(false);
    expect(AstSchema.safeParse({ type: "Box", text: "", children: [] }).success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(AstSchema.safeParse({ ...loginForm, color: "red" }).success).toBe(false);
  });

  it("rejects empty ids", () => {
    expect(AstSchema.safeParse({ id: "", type: "Box", text: "", children: [] }).success).toBe(false);
  });

  it("rejects duplicate ids across the tree", () => {
    const bad = {
      id: "root",
      type: "Box",
      text: "",
      children: [
        { id: "dup", type: "Text", text: "a", children: [] },
        { id: "dup", type: "Text", text: "b", children: [] },
      ],
    };
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });
});
