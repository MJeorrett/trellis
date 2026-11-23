import { describe, expect, it } from "vitest";
import { parseSyntax } from "@/syntax/parse";
import type { AstNode } from "@/schema/ast";
import { featuresListSource } from "./features-list";

const flatten = (node: AstNode): AstNode[] => [node, ...node.children.flatMap(flatten)];
const texts = (node: AstNode) => node.children.map((c) => c.text);

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

  it("starts the Feature detail page with the heading, a spacer and the back link in one Row", () => {
    const row = detail!.children[0]!;
    expect(row.type).toBe("Row");
    expect(row.children.map((c) => [c.type, c.text, c.linkTo])).toEqual([
      ["Text", "Feature: Wire frame editor", undefined],
      ["Spacer", "", undefined],
      ["Text", "Back to features", "features"],
    ]);
    expect(row.children[0]).toMatchObject({ font: "bold", fontSize: "lg" });
  });

  it("titles the source and wire frame cards side by side, then sketches them in two half-width boxes", () => {
    const [, titles, cards] = detail!.children;
    expect(titles!.children.map((c) => [c.text, c.width])).toEqual([
      ["Wire frame source", 6],
      ["Wire frame", 6],
    ]);
    expect(cards!.children.map((c) => [c.type, c.width])).toEqual([
      ["Box", 6],
      ["Box", 6],
    ]);
  });

  it("sketches the source card as a tab row (+ and one tab per page) above a box with the selected page's text", () => {
    const source = detail!.children[2]!.children[0]!;
    expect(source.children[0]!.type).toBe("Row");
    expect(texts(source.children[0]!)).toEqual(["+", "Log in", "Forgot password"]);
    const lines = texts(source.children[1]!);
    expect(lines.slice(0, 3)).toEqual([
      "Page “Log in” id=login",
      "\u00a0\u00a0Box",
      "\u00a0\u00a0\u00a0\u00a0Text “Log in” font=bold font-size=lg",
    ]);
    expect(lines.filter((line) => line !== "")).toHaveLength(14);
    expect(lines.slice(-5)).toEqual(["", "", "", "", ""]);
  });

  it("sketches the wire frame card as the page tabs above an image", () => {
    const preview = detail!.children[2]!.children[1]!;
    expect(texts(preview.children[0]!)).toEqual(["Log in", "Forgot password"]);
    expect(preview.children[1]).toMatchObject({ type: "Image", aspectRatio: "1:2" });
  });

  it("ends the Feature detail page with the data dictionary", () => {
    const pane = detail!.children[3]!;
    expect(pane.type).toBe("Box");
    expect(texts(pane.children[0]!)).toEqual(["Data dictionary", "", "Add field"]);
    expect(pane.children[1]!.children.map((c) => [c.text, c.width])).toEqual([
      ["Entity", 5],
      ["Field", 5],
      ["DataType", 2],
    ]);
    expect(pane.children.slice(2).map(texts)).toEqual([
      ["Organisation", "CompanyName", "string"],
      ["Organisation", "AdminEmail", "string"],
      ["Organisation", "AdminFullName", "string"],
    ]);
  });
});
