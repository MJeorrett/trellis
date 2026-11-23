import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AstNode } from "@/schema/ast";
import { fontSizeClass } from "./font";
import { WireframeNode } from "./wireframe";

const children: AstNode[] = [
  { type: "Box", text: "Cancel", children: [] },
  { type: "Box", text: "Submit", children: [] },
];

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

  it("renders a Row without a border or border radius, with data-node-type and its children in order", () => {
    const html = renderToStaticMarkup(<WireframeNode node={{ type: "Row", text: "", children }} />);
    expect(html).toContain('data-node-type="Row"');
    expect(rootClasses({ type: "Row", text: "", children })).not.toContain("border");
    const rowTag = /^<div[^>]*>/.exec(html)![0];
    expect(rowTag).not.toContain("border-radius");
    expect(rowTag).toContain("Segoe Print");
    expect(rowTag).toContain("rotate(");
    expect(html.indexOf("Cancel")).toBeGreaterThan(-1);
    expect(html.indexOf("Cancel")).toBeLessThan(html.indexOf("Submit"));
  });

  it("renders a BoxRow's children in a single, non-wrapping row, with a border and border radius", () => {
    const node: AstNode = { type: "BoxRow", text: "", children };
    const html = renderToStaticMarkup(<WireframeNode node={node} />);
    const classes = rootClasses(node);
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-row");
    expect(classes).toContain("flex-nowrap");
    expect(classes).not.toContain("flex-col");
    expect(classes).not.toContain("flex-wrap");
    expect(classes).toContain("border");
    expect(/^<div[^>]*>/.exec(html)![0]).toContain("border-radius:");
    expect(html).toContain('data-node-type="BoxRow"');
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

  it("gives Box and BoxRow a border radius and a tilt", () => {
    for (const type of ["Box", "BoxRow"] as const) {
      const html = render({ type, text: "Hi", children: [] });
      expect(html).toContain("border-radius:");
      expect(html).toContain("rotate(");
    }
  });

  it("gives Text and Row a tilt but no border radius", () => {
    for (const type of ["Text", "Row"] as const) {
      const html = render({ type, text: "Hi", children: [] });
      expect(html).toContain("rotate(");
      expect(html).not.toContain("border-radius");
    }
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

describe("WireframeNode Spacer", () => {
  const row: AstNode = {
    type: "Row",
    text: "",
    children: [
      { type: "Text", text: "A", children: [] },
      { type: "Spacer", text: "", children: [] },
      { type: "Text", text: "B", children: [] },
    ],
  };
  const spacerHtml = renderToStaticMarkup(<WireframeNode node={row.children[1]!} />);

  it("renders the three children of a Row in order, with the Spacer in the middle", () => {
    const html = renderToStaticMarkup(<WireframeNode node={row} />);
    const spacerAt = html.indexOf('data-node-type="Spacer"');
    expect(html.indexOf(">A<")).toBeGreaterThan(-1);
    expect(html.indexOf(">A<")).toBeLessThan(spacerAt);
    expect(spacerAt).toBeLessThan(html.indexOf(">B<"));
  });

  it("renders the Spacer as an empty div with flex-1", () => {
    expect(spacerHtml).toMatch(/^<div[^>]*><\/div>$/);
    expect(spacerHtml).toContain('data-node-type="Spacer"');
    expect(rootClasses(row.children[1]!)).toContain("flex-1");
  });

  it("gives the Spacer no border class, inline sketch style or link attributes", () => {
    expect(rootClasses(row.children[1]!)).not.toContain("border");
    expect(spacerHtml).not.toContain("class=\"border");
    expect(spacerHtml).not.toContain("style=");
    expect(spacerHtml).not.toContain("Segoe Print");
    expect(spacerHtml).not.toContain("rotate(");
    expect(spacerHtml).not.toContain("border-radius");
    expect(spacerHtml).not.toContain("data-link-to");
    expect(spacerHtml).not.toContain("role=");
    expect(spacerHtml).not.toContain("cursor-pointer");
  });

  it("renders the siblings of a Spacer as before", () => {
    const html = renderToStaticMarkup(<WireframeNode node={row} />);
    expect(html.match(/data-node-type="Text"/g)).toHaveLength(2);
    expect(html).toContain('data-node-type="Row"');
  });

  it("fills the remaining space (flex-1) of a BoxRow like a Row", () => {
    const boxRow: AstNode = { ...row, type: "BoxRow" };
    const html = renderToStaticMarkup(<WireframeNode node={boxRow} />);
    const spacer = /<div[^>]*data-node-type="Spacer"[^>]*><\/div>/.exec(html)![0];
    expect(spacer).toContain("flex-1");
    expect(spacer).not.toContain("style=");
    expect(html.indexOf(">A<")).toBeLessThan(html.indexOf('data-node-type="Spacer"'));
    expect(html.indexOf('data-node-type="Spacer"')).toBeLessThan(html.indexOf(">B<"));
  });
});

describe("WireframeNode width", () => {
  const box = (text: string, width?: number): AstNode => ({
    type: "Box",
    text,
    children: [],
    ...(width === undefined ? {} : { width }),
  });
  const row = (...kids: AstNode[]): AstNode => ({ type: "Row", text: "", children: kids });
  const html = (node: AstNode) => renderToStaticMarkup(<WireframeNode node={node} />);
  const styleOf = (markup: string, text: string) => {
    const tag = markup.slice(0, markup.indexOf(`>${text}<`)).split("<div").pop()!;
    return /style="([^"]*)"/.exec(tag)![1]!;
  };

  it("gives width=3 and width=9 children fixed bases of 3/12 and 9/12 of the row minus its gap", () => {
    const markup = html(row(box("A", 3), box("B", 9)));
    expect(styleOf(markup, "A")).toContain("flex:0 0 calc((100% - 0.5rem) * 3 / 12)");
    expect(styleOf(markup, "B")).toContain("flex:0 0 calc((100% - 0.5rem) * 9 / 12)");
    expect(styleOf(markup, "A")).toContain("min-width:0");
    expect(styleOf(markup, "B")).toContain("min-width:0");
  });

  it("defaults a child without a width to 3 next to one with a width", () => {
    const markup = html(row(box("A"), box("B", 9)));
    expect(styleOf(markup, "A")).toContain("flex:0 0 calc((100% - 0.5rem) * 3 / 12)");
    expect(styleOf(markup, "B")).toContain("calc((100% - 0.5rem) * 9 / 12)");
  });

  it("renders a Spacer in a row with widths as a fixed-width empty div without flex-1", () => {
    const markup = html(row(box("A", 4), { type: "Spacer", text: "", children: [], width: 2 }, box("B", 6)));
    const spacer = /<div[^>]*data-node-type="Spacer"[^>]*><\/div>/.exec(markup)![0];
    expect(spacer).not.toContain("flex-1");
    expect(spacer).toContain("flex:0 0 calc((100% - 1rem) * 2 / 12)");
    expect(spacer).toContain("min-width:0");

  });

  it("makes a Spacer without a width fill the remaining space of a row with widths", () => {
    const markup = html(row(box("A", 4), { type: "Spacer", text: "", children: [] }, box("B", 3)));
    const spacer = /<div[^>]*data-node-type="Spacer"[^>]*><\/div>/.exec(markup)![0];
    expect(spacer).toContain("flex-1");
    expect(spacer).not.toContain("style=");
    expect(styleOf(markup, "A")).toContain("flex:0 0 calc((100% - 1rem) * 4 / 12)");
    expect(styleOf(markup, "B")).toContain("flex:0 0 calc((100% - 1rem) * 3 / 12)");
  });

  it("keeps flex-1 on a Spacer in a row without widths and adds no layout style to the row's children", () => {
    const markup = html(row(box("A"), { type: "Spacer", text: "", children: [] }, box("B")));
    const spacer = /<div[^>]*data-node-type="Spacer"[^>]*><\/div>/.exec(markup)![0];
    expect(spacer).toContain("flex-1");
    expect(spacer).not.toContain("style=");
    expect(markup).not.toContain("flex:0 0");
    expect(markup).not.toContain("min-width");
  });

  it("adds no layout style for a width on a Box directly in a Box or a Page's children", () => {
    const inBox = html({ type: "Box", text: "", children: [box("A", 5)] });
    expect(inBox).not.toContain("flex:0 0");
    expect(inBox).not.toContain("min-width");
    const alone = html(box("A", 5));
    expect(alone).not.toContain("flex:0 0");
    expect(alone).not.toContain("min-width");
  });

  it("uses a width on a Row inside a Row for the inner row's share only", () => {
    const markup = html(row({ ...row(box("x"), box("y")), width: 6 }, box("B")));
    expect(styleOf(markup, "x")).not.toContain("flex:0 0");
    expect(markup).toContain("flex:0 0 calc((100% - 0.5rem) * 6 / 12)");
  });

  it("lays out the children of a BoxRow in twelfths like a Row", () => {
    const boxRow = (...kids: AstNode[]): AstNode => ({ type: "BoxRow", text: "", children: kids });
    const markup = html(boxRow(box("A", 3), { type: "Spacer", text: "", children: [], width: 2 }, box("B", 7)));
    expect(styleOf(markup, "A")).toContain("flex:0 0 calc((100% - 1rem) * 3 / 12)");
    expect(styleOf(markup, "B")).toContain("flex:0 0 calc((100% - 1rem) * 7 / 12)");
    const spacer = /<div[^>]*data-node-type="Spacer"[^>]*><\/div>/.exec(markup)![0];
    expect(spacer).not.toContain("flex-1");
    expect(spacer).toContain("flex:0 0 calc((100% - 1rem) * 2 / 12)");
  });

  it("gives a BoxRow in a row its own share and a BoxRow's children no slot without widths", () => {
    const inner: AstNode = { type: "BoxRow", text: "", width: 6, children: [box("x"), box("y")] };
    const markup = html(row(inner, box("B")));
    expect(styleOf(markup, "x")).not.toContain("flex:0 0");
    expect(markup).toContain("flex:0 0 calc((100% - 0.5rem) * 6 / 12)");
  });
});

describe("WireframeNode font and font size", () => {
  const text = (extra: Partial<AstNode> = {}, children: AstNode[] = []): AstNode => ({
    type: "Text",
    text: "Hi",
    children,
    ...extra,
  });
  const classesOf = (node: AstNode, content: string) => {
    const markup = renderToStaticMarkup(<WireframeNode node={node} />);
    const tag = markup.slice(0, markup.indexOf(`>${content}<`)).split("<div").pop()!;
    return /class="([^"]*)"/.exec(tag)![1]!.split(/\s+/);
  };

  it("maps each font size to its class, with md and absent as text-base", () => {
    expect(fontSizeClass("sm")).toBe("text-xs");
    expect(fontSizeClass("md")).toBe("text-base");
    expect(fontSizeClass(undefined)).toBe("text-base");
    expect(fontSizeClass("lg")).toBe("text-3xl");
  });

  it("applies the size class of each font-size", () => {
    expect(rootClasses(text({ fontSize: "sm" }))).toContain("text-xs");
    expect(rootClasses(text({ fontSize: "md" }))).toContain("text-base");
    expect(rootClasses(text({ fontSize: "lg" }))).toContain("text-3xl");
    expect(rootClasses(text())).toContain("text-base");
  });

  it("applies the size class on every node type that takes it", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
      const classes = rootClasses({ type, text: "", fontSize: "lg", children: [] });
      expect(classes).toContain("text-3xl");
      expect(classes).not.toContain("text-base");
    }
  });

  it("renders font=bold with font-bold and no font-normal", () => {
    const classes = rootClasses(text({ font: "bold" }));
    expect(classes).toContain("font-bold");
    expect(classes).not.toContain("font-normal");
  });

  it("renders a node without font as font-normal, not bold", () => {
    const classes = rootClasses(text());
    expect(classes).toContain("font-normal");
    expect(classes).not.toContain("font-bold");
  });

  it("does not inherit bold: a non-bold child of a bold parent has font-normal and no font-bold", () => {
    const parent: AstNode = { type: "Box", text: "", font: "bold", children: [text({ text: "Child" })] };
    expect(rootClasses(parent)).toContain("font-bold");
    const child = classesOf(parent, "Child");
    expect(child).toContain("font-normal");
    expect(child).not.toContain("font-bold");
  });

  it("does not inherit size: a child without font-size of a lg parent has text-base", () => {
    const parent: AstNode = { type: "Box", text: "", fontSize: "lg", children: [text({ text: "Child" })] };
    expect(rootClasses(parent)).toContain("text-3xl");
    const child = classesOf(parent, "Child");
    expect(child).toContain("text-base");
    expect(child).not.toContain("text-3xl");
  });

  it("leaves a Spacer unchanged", () => {
    const spacer: AstNode = { type: "Spacer", text: "", children: [] };
    const markup = renderToStaticMarkup(<WireframeNode node={spacer} />);
    expect(markup).toBe('<div data-node-type="Spacer" class="flex-1"></div>');
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
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
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

describe("WireframeNode Image", () => {
  const image = (extra: Partial<AstNode> = {}): AstNode => ({ type: "Image", text: "", children: [], ...extra });
  const render = (node: AstNode) => renderToStaticMarkup(<WireframeNode node={node} />);

  it("renders a bordered Box-like div with data-node-type, the minimum width and a square aspect ratio", () => {
    const html = render(image());
    const classes = rootClasses(image());
    expect(html).toContain('data-node-type="Image"');
    expect(classes).toContain("border");
    expect(classes).toContain("border-foreground/60");
    expect(classes).toContain("min-w-24");
    expect(classes).not.toContain("min-h-24");
    expect(/^<div[^>]*>/.exec(html)![0]).toContain("aspect-ratio:1 / 1");
    expect(classes).toContain("flex-col");
    expect(/^<div[^>]*>/.exec(html)![0]).toContain("border-radius:");
  });

  it("draws an X: an svg with two corner-to-corner lines that does not capture pointer events", () => {
    const html = render(image());
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html.match(/<line /g)).toHaveLength(2);
    const svg = /<svg[^>]*>/.exec(html)![0];
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg).toContain("pointer-events-none");
    expect(html).toContain('x1="0" y1="0" x2="100" y2="100"');
    expect(html).toContain('x1="0" y1="100" x2="100" y2="0"');
  });

  it("renders no text or children", () => {
    const html = render(image());
    expect(html).not.toContain("<span");
    expect(html.match(/data-node-type=/g)).toHaveLength(1);
  });

  it("renders other types without the X or the minimum size", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
      const node: AstNode = { type, text: "Hi", children: [] };
      expect(render(node)).not.toContain("<svg");
      expect(rootClasses(node)).not.toContain("min-w-24");
      expect(rootClasses(node)).not.toContain("min-h-24");
    }
  });

  it("gives a linked Image the link attributes and a pointer cursor", () => {
    const node = image({ linkTo: "home" });
    const html = render(node);
    expect(html).toContain('data-link-to="home"');
    expect(html).toContain('role="link"');
    expect(html).toContain('tabindex="0"');
    expect(rootClasses(node)).toContain("cursor-pointer");
    expect(render(image())).not.toContain("data-link-to");
  });

  it("gives an Image in a Row with a width the slot style", () => {
    const row: AstNode = {
      type: "Row",
      text: "",
      children: [image({ width: 4 }), { type: "Box", text: "B", children: [] }],
    };
    const html = renderToStaticMarkup(<WireframeNode node={row} />);
    const imageTag = /<div[^>]*data-node-type="Image"[^>]*>/.exec(html)![0];
    expect(imageTag).toContain("flex:0 0 calc((100% - 0.5rem) * 4 / 12)");
    expect(imageTag).toContain("min-width:0");
  });

  describe("aspect ratio", () => {
    it("gives an Image with a written ratio the aspect-ratio style and no minimum height", () => {
      const node = image({ aspectRatio: "16:9" });
      const tag = /^<div[^>]*>/.exec(render(node))![0];
      expect(tag).toContain("aspect-ratio:16 / 9");
      const classes = rootClasses(node);
      expect(classes).toContain("min-w-24");
      expect(classes).not.toContain("min-h-24");
      expect(classes).toContain("border");
    });

    it("defaults to a 1:1 ratio when none is written, the same as writing 1:1", () => {
      expect(/^<div[^>]*>/.exec(render(image()))![0]).toContain("aspect-ratio:1 / 1");
      expect(render(image())).toBe(render(image({ aspectRatio: "1:1" })));
      expect(rootClasses(image())).toContain("min-w-24");
      expect(rootClasses(image())).not.toContain("min-h-24");
    });

    it("gives only Images an aspect-ratio style", () => {
      for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
        expect(render({ type, text: "Hi", children: [] })).not.toContain("aspect-ratio");
      }
    });

    it("still draws the X and applies links and the width slot with a ratio", () => {
      const row: AstNode = {
        type: "Row",
        text: "",
        children: [image({ aspectRatio: "1:1", width: 4, linkTo: "home" }), { type: "Box", text: "B", children: [] }],
      };
      const html = renderToStaticMarkup(<WireframeNode node={row} />);
      const tag = /<div[^>]*data-node-type="Image"[^>]*>/.exec(html)![0];
      expect(tag).toContain("aspect-ratio:1 / 1");
      expect(tag).toContain("flex:0 0 calc((100% - 0.5rem) * 4 / 12)");
      expect(tag).toContain('data-link-to="home"');
      expect(html.match(/<line /g)).toHaveLength(2);
    });

    it("adds self-start to an Image with a ratio in a Row or BoxRow, but not in a Box or a Page", () => {
      const img = image({ aspectRatio: "1:1" });
      const imageClasses = (parent: AstNode["type"]) => {
        const html = renderToStaticMarkup(<WireframeNode node={{ type: parent, text: "", children: [img] }} />);
        const tag = /<div[^>]*data-node-type="Image"[^>]*>/.exec(html)![0];
        return /class="([^"]*)"/.exec(tag)![1]!.split(/\s+/);
      };
      expect(imageClasses("Row")).toContain("self-start");
      expect(imageClasses("BoxRow")).toContain("self-start");
      expect(imageClasses("Box")).not.toContain("self-start");
      expect(imageClasses("Text")).not.toContain("self-start");
      expect(rootClasses(img)).not.toContain("self-start");
    });

    it("adds self-start to an Image without a written ratio in a row too (it defaults to 1:1)", () => {
      const html = renderToStaticMarkup(
        <WireframeNode node={{ type: "Row", text: "", children: [image()] }} />,
      );
      expect(html).toContain("self-start");
    });
  });
});
