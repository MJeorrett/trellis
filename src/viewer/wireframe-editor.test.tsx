import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { newSourcePage, WireframeEditor } from "./wireframe-editor";

const render = (source: string) =>
  renderToStaticMarkup(<WireframeEditor source={source} onSourceChange={() => {}} />);

const two = `Page "Log in" id=login
  Box
    Text "Hi"
Page "Forgot" id=forgot
  Text "Back" link-to=login
`;

/** The attributes of the element with the given aria-label, e.g. its value. */
const field = (html: string, label: string) =>
  new RegExp(`<(?:input|textarea)[^>]*aria-label="${label}"[^>]*>(?:([^<]*)</textarea>)?`).exec(html);

describe("WireframeEditor source panes", () => {
  it("shows one pane per page with its title, id and content", () => {
    const html = render(two);
    expect(field(html, "Page 1 title")![0]).toContain('value="Log in"');
    expect(field(html, "Page 1 id")![0]).toContain('value="login"');
    expect(field(html, "Page 1 source")![1]).toBe('Box\n  Text &quot;Hi&quot;');
    expect(field(html, "Page 2 title")![0]).toContain('value="Forgot"');
    expect(field(html, "Page 2 id")![0]).toContain('value="forgot"');
    expect(field(html, "Page 2 source")![1]).toContain("Text &quot;Back&quot; link-to=login");
    expect(field(html, "Page 3 title")).toBeNull();
    expect(html.match(/Page:/g)).toHaveLength(2);
    expect(html.match(/Id:/g)).toHaveLength(2);
  });

  it("never shows a Page line in a pane", () => {
    const html = render(two);
    expect(field(html, "Page 1 source")![1]).not.toContain("Page");
    expect(field(html, "Page 2 source")![1]).not.toContain("Page");
  });

  it("shows the + Add Page button after the panes", () => {
    const html = render(two);
    expect(html).toMatch(/<button[^>]*>\+ Add Page<\/button>/);
    expect(html.indexOf("Page 2 source")).toBeLessThan(html.indexOf("+ Add Page"));
  });

  it("shows one pane for a single page", () => {
    const html = render('Page "Only"\n  Text "x"');
    expect(field(html, "Page 1 title")![0]).toContain('value="Only"');
    expect(field(html, "Page 2 title")).toBeNull();
  });

  it("shows one empty pane for the empty source, and the preview labels it Page 1", () => {
    const html = render("");
    expect(field(html, "Page 1 title")![0]).toContain('value=""');
    expect(field(html, "Page 1 id")![0]).toContain('value=""');
    expect(field(html, "Page 1 source")![1]).toBe("");
    expect(field(html, "Page 2 title")).toBeNull();
    expect(html).toContain('aria-label="Pages"');
    expect(html).toContain("Page 1");
  });

  it("shows no error and the preview when the source is valid", () => {
    const html = render(two);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source");
    expect(html).toContain('aria-label="Pages"');
  });

  it("shows a content error under its pane only, counted within the pane", () => {
    const html = render('Page "A" id=a\n  Box\nPage "B" id=b\n  Text "x"\n  Bogus');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("Line 2: Unknown type");
    // The alert comes after pane 2's text area and nothing follows it but the add button.
    expect(html.indexOf('role="alert"')).toBeGreaterThan(html.indexOf("Page 2 source"));
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf("+ Add Page"));
    expect(html).toContain("Fix the source to see the wire frame.");
  });

  it("shows a header error under its pane without a line number", () => {
    const html = render('Page "A" id=same\n  Box\nPage "B" id=same');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("Duplicate page id");
    expect(html).not.toMatch(/Line \d+: Duplicate/);
    expect(html.indexOf('role="alert"')).toBeGreaterThan(html.indexOf("Page 2 id"));
    expect(html).toContain("Fix the source to see the wire frame.");
  });

  it("shows an error in the first pane above the second pane", () => {
    const html = render('Page "A" id=a\n  Bogus\nPage "B" id=b\n  Box');
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf("Page 2 title"));
  });

  it("shows the page-cannot-be-written-here message for a nested Page", () => {
    const html = render('Page "A" id=a\n  Box\n    Page "X"');
    expect(html).toContain("Line 2: Page cannot be written here, it is created from the title and id");
    expect(html).not.toContain("cannot be nested");
  });
});

describe("WireframeEditor accordion", () => {
  const triggers = (html: string) =>
    [...html.matchAll(/<button[^>]*aria-label="Toggle (Page \d+) source"[^>]*>/g)].map((m) => ({
      label: m[1],
      expanded: /aria-expanded="([^"]*)"/.exec(m[0])![1],
    }));

  it("has a toggle for each pane, only the first expanded initially", () => {
    expect(triggers(render(two))).toEqual([
      { label: "Page 1", expanded: "true" },
      { label: "Page 2", expanded: "false" },
    ]);
    expect(triggers(render(""))).toEqual([{ label: "Page 1", expanded: "true" }]);
  });

  it("keeps the collapsed source in the document, hidden, and the title and id visible", () => {
    const html = render(two);
    const panels = [...html.matchAll(/<div[^>]*data-slot="accordion-content"[^>]*>/g)].map((m) => m[0]);
    expect(panels).toHaveLength(2);
    expect(panels[0]).not.toMatch(/ hidden(=|>| )/);
    expect(panels[1]).toMatch(/ hidden(=|>| )/);
    expect(field(html, "Page 2 source")).not.toBeNull();
    expect(html.indexOf("Page 2 title")).toBeLessThan(html.lastIndexOf('data-slot="accordion-content"'));
  });

  it("still shows an error under a collapsed pane", () => {
    const html = render('Page "A" id=a\n  Box\nPage "B" id=b\n  Bogus');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(triggers(html)[1]!.expanded).toBe("false");
  });
});

describe("newSourcePage", () => {
  const page = (id: string) => ({ title: "", id, content: "" });

  it("is titled Page N with the id page-N for its 1-based position and has no content", () => {
    expect(newSourcePage([page("a"), page("b")])).toEqual({ title: "Page 3", id: "page-3", content: "" });
    expect(newSourcePage([page("")])).toEqual({ title: "Page 2", id: "page-2", content: "" });
  });

  it("uses the next free number when the id is taken", () => {
    expect(newSourcePage([page("a"), page("page-3")])).toEqual({ title: "Page 4", id: "page-4", content: "" });
  });
});
