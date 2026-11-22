import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AstNode } from "@/schema/ast";
import { WireframeNode } from "./wireframe";

const children: AstNode[] = [
  { type: "Box", text: "Cancel", children: [] },
  { type: "Box", text: "Submit", children: [] },
];

/** Returns the class list of the outermost rendered node. */
function rootClasses(node: AstNode): string[] {
  const html = renderToStaticMarkup(<WireframeNode node={node} />);
  const match = /^<div[^>]*class="([^"]*)"/.exec(html);
  return match![1]!.split(/\s+/);
}

describe("WireframeNode layout", () => {
  it("renders a Row's children in a single, non-wrapping row", () => {
    const classes = rootClasses({ type: "Row", text: "", children });
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-row");
    expect(classes).toContain("flex-nowrap");
    expect(classes).not.toContain("flex-col");
    expect(classes).not.toContain("flex-wrap");
  });

  it("keeps the Row's border and data-node-type, and its children in order", () => {
    const html = renderToStaticMarkup(<WireframeNode node={{ type: "Row", text: "", children }} />);
    expect(html).toContain('data-node-type="Row"');
    expect(rootClasses({ type: "Row", text: "", children })).toContain("border");
    expect(html.indexOf("Cancel")).toBeGreaterThan(-1);
    expect(html.indexOf("Cancel")).toBeLessThan(html.indexOf("Submit"));
  });

  it("renders a Box's children in a column", () => {
    const classes = rootClasses({ type: "Box", text: "", children });
    expect(classes).toContain("flex-col");
    expect(classes).not.toContain("flex-row");
    expect(classes).toContain("border");
  });

  it("renders Text in a column without a border", () => {
    const classes = rootClasses({ type: "Text", text: "Hi", children: [] });
    expect(classes).toContain("flex-col");
    expect(classes).not.toContain("border");
  });
});

describe("WireframeNode sketch style", () => {
  const render = (node: AstNode, path?: number[]) => renderToStaticMarkup(<WireframeNode node={node} path={path} />);
  const box: AstNode = { type: "Box", text: "Hi", children: [] };

  it("gives Box and Row a border radius and a tilt", () => {
    for (const type of ["Box", "Row"] as const) {
      const html = render({ type, text: "Hi", children: [] });
      expect(html).toContain("border-radius:");
      expect(html).toContain("rotate(");
    }
  });

  it("gives Text a tilt but no border radius", () => {
    const html = render({ type: "Text", text: "Hi", children: [] });
    expect(html).toContain("rotate(");
    expect(html).not.toContain("border-radius");
  });

  it("applies the handwriting font to nodes", () => {
    expect(render(box)).toContain("Segoe Print");
  });

  it("renders the same node and path identically", () => {
    expect(render(box, [0, 1])).toBe(render(box, [0, 1]));
  });

  it("can render nodes with different paths differently", () => {
    const looks = new Set(Array.from({ length: 12 }, (_, index) => render(box, [index])));
    expect(looks.size).toBeGreaterThan(1);
  });

  it("keeps a node's style when its text changes", () => {
    const style = (html: string) => /style="([^"]*)"/.exec(html)![1];
    const before = render({ type: "Box", text: "Before", children: [] }, [2]);
    const after = render({ type: "Box", text: "After, and a lot longer", children: [] }, [2]);
    expect(style(before)).toBe(style(after));
  });

  it("styles nested children by their path in the tree", () => {
    const tree: AstNode = { type: "Box", text: "", children: [box, box, box] };
    expect(render(tree)).toBe(render(tree));
    expect(render(tree).match(/rotate\(/g)).toHaveLength(4);
  });
});

describe("WireframeNode links", () => {
  const render = (node: AstNode) => renderToStaticMarkup(<WireframeNode node={node} />);

  it("renders a linked Text with a pointer cursor, data-link-to and role=link", () => {
    const node: AstNode = { type: "Text", linkTo: "test-id", text: "My Link", children: [] };
    const html = render(node);
    expect(html).toContain('data-link-to="test-id"');
    expect(html).toContain('role="link"');
    expect(html).toContain('tabindex="0"');
    expect(rootClasses(node)).toContain("cursor-pointer");
    expect(rootClasses(node)).not.toContain("border");
  });

  it("renders a linked Box with a pointer cursor and keeps its border", () => {
    const node: AstNode = { type: "Box", linkTo: "x", text: "Go", children: [] };
    expect(rootClasses(node)).toContain("cursor-pointer");
    expect(rootClasses(node)).toContain("border");
    expect(render(node)).toContain('data-link-to="x"');
  });

  it("renders unlinked nodes without link attributes or a pointer cursor", () => {
    for (const type of ["Box", "Text", "Row"] as const) {
      const node: AstNode = { type, text: "Plain", children: [{ type: "Box", text: "child", children: [] }] };
      const html = render(node);
      expect(html).not.toContain("data-link-to");
      expect(html).not.toContain('role="link"');
      expect(html).not.toContain("tabindex");
      expect(html).not.toContain("cursor-pointer");
    }
  });

  it("makes only the linked nodes in a tree clickable", () => {
    const node: AstNode = {
      type: "Box",
      text: "",
      children: [
        { type: "Text", linkTo: "a", text: "A", children: [] },
        { type: "Text", text: "B", children: [] },
      ],
    };
    const html = render(node);
    expect(html.match(/data-link-to=/g)).toHaveLength(1);
    expect(html.match(/cursor-pointer/g)).toHaveLength(1);
  });
});
