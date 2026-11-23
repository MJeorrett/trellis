import { describe, expect, it } from "vitest";
import { isCommentLine } from "@/syntax/comments";

describe("isCommentLine", () => {
  it("is true for a line that starts with #", () => {
    expect(isCommentLine("# note")).toBe(true);
    expect(isCommentLine("#")).toBe(true);
    expect(isCommentLine("#note")).toBe(true);
  });

  it("is false for an indented #, a # inside text and an empty line", () => {
    expect(isCommentLine("  # note")).toBe(false);
    expect(isCommentLine(' # note')).toBe(false);
    expect(isCommentLine('Box "# x"')).toBe(false);
    expect(isCommentLine("")).toBe(false);
  });
});
