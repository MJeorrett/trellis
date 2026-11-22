import { describe, expect, it } from "vitest";
import { parseSyntax } from "@/syntax/parse";
import type { AstNode } from "@/schema/ast";
import { featuresListSource } from "./features-list";

const flatten = (node: AstNode): AstNode[] => [node, ...node.children.flatMap(flatten)];

describe("featuresListSource", () => {
  const result = parseSyntax(featuresListSource);

  it("parses", () => {
    expect(result.ok).toBe(true);
  });

  const detail = result.ok ? result.ast.pages.find((page) => page.id === "detail")! : undefined;
  const nodes = detail ? detail.children.flatMap(flatten) : [];

  it("keeps its three pages and their links", () => {
    expect(result.ok && result.ast.pages.map((p) => p.id)).toEqual(["features", "create", "detail"]);
  });

  it("shows the + Add Page box centred between two spacers in a Row on the Feature detail page", () => {
    const row = nodes.find((node) => node.type === "Row" && node.children.some((c) => c.text === "+ Add Page"));
    expect(row?.children.map((c) => [c.type, c.text])).toEqual([
      ["Spacer", ""],
      ["Box", "+ Add Page"],
      ["Spacer", ""],
    ]);
  });

  it("shows one bordered pane per page, with the Page: and Id: row and the source lines", () => {
    const panes = nodes.filter((node) => node.type === "Box" && node.children[0]?.type === "BoxRow");
    expect(panes).toHaveLength(2);
    expect(panes.map((pane) => pane.children[0]!.children.map((c) => c.text))).toEqual([
      ["Page:", "Log in", "Id:", "login"],
      ["Page:", "Forgot password", "Id:", "forgot"],
    ]);
    const lines = (pane: AstNode) => pane.children.slice(1).map((c) => c.text);
    // The lines start at column 0 (no 2-space page indentation) and keep the indentation of the nodes below.
    expect(lines(panes[0]!)[0]).toBe("Box");
    expect(lines(panes[0]!)[1]).toBe("\u00a0\u00a0Text “Log in” font=bold font-size=lg");
    expect(lines(panes[1]!)[0]).toBe("Box");
    expect(lines(panes[1]!).at(-1)).toBe("\u00a0\u00a0Text “Back to log in” link-to=login");
    for (const pane of panes) {
      expect(lines(pane).some((line) => line.startsWith("Page"))).toBe(false);
    }
  });
});
