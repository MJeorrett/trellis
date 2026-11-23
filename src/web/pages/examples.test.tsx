import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { examples, exampleDataDictionary } from "@/examples/examples";
import ExamplesPage, { ExamplesView } from "./examples";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const html = renderToStaticMarkup(<ExamplesPage />);

describe("ExamplesPage", () => {
  it("renders the Examples heading and renders without waiting for any data", () => {
    expect(html).toMatch(/<h1[^>]*>Examples<\/h1>/);
  });

  it("renders one section per example, titled and in order", () => {
    const titles = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual([...examples.map((example) => escapeHtml(example.title)), "Data dictionary used by these examples"]);
  });

  it("shows each example's source as read-only text, with its comments", () => {
    for (const example of examples) {
      const label = escapeRegExp(`${escapeHtml(example.title)} source`);
      const source = new RegExp(
        `<div(?=[^>]*data-slot="code-editor")(?=[^>]*aria-label="${label}")[^>]*>[\\s\\S]*?<pre[^>]*>([\\s\\S]*?)</pre>`,
      ).exec(html);
      expect(source?.[1]).toBe(escapeHtml(example.source));
      expect(source?.[1]).toContain("# ");
    }
    expect(html).not.toContain("<textarea");
  });

  it("shows the compiled wire frame of each example with page tabs", () => {
    expect(html.match(/aria-label="Pages"/g)).toHaveLength(examples.length);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Edit user");
    expect(html).toContain("Ann");
  });

  it("puts the source and the wire frame side by side on a wide window and stacked on a narrow one", () => {
    expect(html.match(/<div class="grid gap-4 md:grid-cols-2">/g)).toHaveLength(examples.length);
  });

  it("fills the routed content area with the examples scrolling above a fixed data dictionary", () => {
    expect(html).toMatch(/^<main class="[^"]*\bh-full\b[^"]*\bmin-h-0\b[^"]*\boverflow-hidden\b/);
    expect(html).not.toContain("h-dvh");
    expect(html).toMatch(/<div class="min-h-0 flex-1 overflow-y-auto"><div class="[^"]*\bmax-w-6xl\b[^"]*"><h1 /);
    expect(html).toMatch(/<section aria-label="Data dictionary used by these examples" class="[^"]*\bflex-none\b/);
  });

  it("ends with the data dictionary used by the examples as a read-only table", () => {
    const section = html.slice(html.indexOf('<section aria-label="Data dictionary used by these examples"'));
    expect(section).toMatch(/<h2[^>]*>Data dictionary used by these examples<\/h2>/);
    const headers = [...section.matchAll(/<th [^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(headers).toEqual(["Entity", "Field", "DataType", "Label", "MockValues"]);
    for (const row of exampleDataDictionary) {
      for (const value of [row.entity, row.field, row.dataType, row.label, row.mockValues]) {
        expect(section).toContain(escapeHtml(value));
      }
    }
    expect(section).not.toContain("<input");
    expect(section).not.toContain("<button");
    expect(html.indexOf("Data dictionary used by these examples")).toBeGreaterThan(
      html.lastIndexOf(`<section aria-label="${examples.at(-1)!.title}"`),
    );
  });
});

describe("ExamplesView", () => {
  it("shows the message instead of the preview for an example with an error", () => {
    const view = renderToStaticMarkup(
      <ExamplesView
        examples={[
          { title: "Broken", source: "# a note\nBogus" },
          { title: "Fine", source: '# a note\nPage "Fine"\n  Text "ok"' },
        ]}
        dataDictionary={[]}
      />,
    );
    expect(view).toMatch(/role="alert"[^>]*>Line 2: root node must be Page/);
    expect(view.match(/aria-label="Pages"/g)).toHaveLength(1);
    expect(view.match(/role="alert"/g)).toHaveLength(1);
    expect(view).toContain("Bogus");
  });

  it("compiles the examples against the data dictionary it is given", () => {
    const source = 'Page "P"\n  Box @User.FirstName';
    const known = renderToStaticMarkup(
      <ExamplesView
        examples={[{ title: "Pointer", source }]}
        dataDictionary={[{ entity: "User", field: "FirstName", dataType: "string", label: "", mockValues: "Zed" }]}
      />,
    );
    expect(known).not.toContain('role="alert"');
    expect(known).toContain("Zed");
    const unknown = renderToStaticMarkup(<ExamplesView examples={[{ title: "Pointer", source }]} dataDictionary={[]} />);
    expect(unknown).toMatch(/role="alert"[^>]*>Line 2: Unknown entity &quot;User&quot;/);
  });
});
