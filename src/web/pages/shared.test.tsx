import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { SharedWireframe } from "@/share/schema";
import SharedPage, { InvalidShareView, SharedFrame, SharedView } from "./shared";

const render = (element: React.ReactElement, path = "/share") =>
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

const data: SharedWireframe = {
  v: 1,
  name: "Customer search",
  wireframe: [
    'Page "Search" id=search',
    '  Greeting name="Ann"',
    "  Box @Customer.Name",
    '  Text "Go to details" link-to=details',
    'Page "Details" id=details',
    '  Text "Details text"',
    "",
  ].join("\n"),
  macros: 'Def Greeting $name\n  Text "Hello $name"\n',
  dataDictionary: [
    { entity: "Customer", field: "Name", dataType: "string", label: "Full name", mockValues: "Zed Zee" },
    { entity: "Customer", field: "Age", dataType: "int", label: "", mockValues: "" },
  ],
};

const links = (html: string) =>
  [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
    label: m[2]!,
    href: /href="([^"]*)"/.exec(m[1]!)![1],
  }));

describe("SharedView", () => {
  const html = render(<SharedView data={data} />);

  it("shows the name as the heading", () => {
    expect(html).toMatch(/<h1[^>]*>Customer search<\/h1>/);
  });

  it("shows a tab per page and renders the selected page with macros and pointers resolved", () => {
    expect(html).toContain('aria-label="Pages"');
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*>Search<\/button>/);
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*>Details<\/button>/);
    expect(html).toContain("Hello Ann");
    expect(html).toContain("Zed Zee");
    expect(html).toContain("Go to details");
    expect(html).not.toContain("Details text");
    expect(html).not.toContain('role="alert"');
  });

  it("shows the data dictionary as a read-only table pinned below the preview", () => {
    const section = html.slice(html.indexOf('<section aria-label="Data dictionary"'));
    expect(section).toMatch(/<h2[^>]*>Data dictionary<\/h2>/);
    expect([...section.matchAll(/<th [^>]*>(.*?)<\/th>/g)].map((m) => m[1])).toEqual([
      "Entity",
      "Field",
      "DataType",
      "Label",
      "MockValues",
    ]);
    expect([...section.matchAll(/<td [^>]*>(.*?)<\/td>/g)].map((m) => m[1])).toEqual([
      "Customer",
      "Name",
      "string",
      "Full name",
      "Zed Zee",
      "Customer",
      "Age",
      "int",
      "",
      "",
    ]);
    expect(html.indexOf('<section aria-label="Data dictionary"')).toBeGreaterThan(html.indexOf('aria-label="Pages"'));
    expect(html.indexOf('<section aria-label="Data dictionary"')).toBeLessThan(html.indexOf("<footer"));
  });

  it("never shows the source, the macros or an editable control", () => {
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("code-editor");
    expect(html).not.toContain("link-to=details");
    expect(html).not.toContain("Def Greeting");
    expect(html).not.toContain("$name");
    expect(html).not.toContain("Add field");
    expect(html).not.toMatch(/<button(?![^>]*role="tab")/);
  });

  it("shows a compile error in an alert in place of the preview", () => {
    const broken = render(<SharedView data={{ ...data, wireframe: "Bogus" }} />);
    expect(broken).toMatch(/<pre[^>]*role="alert"[^>]*>Line 1: root node must be Page/);
    expect(broken).not.toContain('aria-label="Pages"');
    expect(broken).toContain("Customer search");
  });
});

describe("the bar and the footer", () => {
  it("has a Trellis link to /features in the top bar and in the footer", () => {
    const html = render(<SharedView data={data} />);
    expect(html).toMatch(/<header[^>]*>.*<a [^>]*href="\/features"[^>]*>Trellis<\/a>.*<\/header>/);
    expect(html).toMatch(/<footer[^>]*>Shared by <a [^>]*href="\/features"[^>]*>Trellis<\/a><\/footer>/);
    expect(links(html)).toEqual([
      { label: "Trellis", href: "/features" },
      { label: "Trellis", href: "/features" },
    ]);
  });

  it("is also shown around the invalid-link view and while the link is being read", () => {
    for (const html of [render(<InvalidShareView />), render(<SharedFrame />), render(<SharedPage />)]) {
      expect(html).toMatch(/<header/);
      expect(html).toMatch(/<footer[^>]*>Shared by /);
    }
  });
});

describe("InvalidShareView", () => {
  const html = render(<InvalidShareView />);

  it("shows the message and the Trellis link and no wire frame or data dictionary", () => {
    expect(html).toContain("This link is not valid");
    expect(links(html)[0]).toEqual({ label: "Trellis", href: "/features" });
    expect(html).not.toContain('aria-label="Pages"');
    expect(html).not.toContain("Data dictionary");
    expect(html).not.toContain("<table");
  });
});

describe("SharedPage", () => {
  it("shows nothing but the bar and the footer before the link has been read", () => {
    const html = render(<SharedPage />, "/share#d=abc");
    expect(html).not.toContain("This link is not valid");
    expect(html).not.toContain("<main");
  });
});
