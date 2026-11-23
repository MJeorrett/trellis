import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { MacrosView } from "@/pages/macros";
import { seedMacrosSource } from "./api";
import { MacroEditor } from "./macro-editor";

const render = (source: string) =>
  renderToStaticMarkup(<MacroEditor source={source} onSourceChange={() => {}} />);

const editor = (html: string) =>
  /<div(?=[^>]*data-slot="code-editor")(?=[^>]*aria-label="Macros source")[^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/.exec(
    html,
  );

describe("MacroEditor", () => {
  it("shows one text area with the whole source and no page tabs or + button for it", () => {
    const html = render(seedMacrosSource);
    expect(html.match(/data-slot="code-editor"/g)).toHaveLength(1);
    expect(html).not.toContain("<textarea");
    expect(editor(html)![1]).toBe(seedMacrosSource.replaceAll('"', "&quot;"));
    expect(html).not.toContain('aria-label="Source pages"');
    expect(html).not.toContain('aria-label="Add page"');
  });

  it("previews the pages that use the macros, to the right of the source", () => {
    const html = render(seedMacrosSource);
    expect(html).not.toContain('role="alert"');
    expect(html.indexOf('aria-label="Macros source"')).toBeLessThan(html.indexOf('aria-label="Pages"'));
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    expect(preview).toContain("Examples");
    expect(preview).toContain("Email");
    expect(preview).toContain("Password");
  });

  it("previews the page title, the two fields and the list items of the seed", () => {
    const html = render(seedMacrosSource);
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    for (const text of ["My Page", "Email", "you@example.com", "Password", "*********", "Reports", "Settings", "Help"]) {
      expect(preview).toContain(text);
    }
  });

  it("shows an error with the line of the text, and no preview", () => {
    const html = render('Def A\n  Box\nPage "P"\n  A x=1');
    expect(html).toMatch(/role="alert"[^>]*>Line 4: Unknown argument &quot;x&quot; for macro &quot;A&quot;/);
    expect(html).toContain("Fix the source to see the wire frame.");
    expect(html).not.toContain('aria-label="Pages"');
  });

  it("shows only Defs as a blank wire frame", () => {
    const html = render("Def A\n  Box\n");
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('aria-label="Pages"');
  });
});

describe("MacroEditor data references", () => {
  const rows: DataDictionaryRow[] = [
    { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValues: "Jane" },
  ];
  const renderWith = (source: string, dataDictionary?: DataDictionaryRow[]) =>
    renderToStaticMarkup(<MacroEditor source={source} onSourceChange={() => {}} dataDictionary={dataDictionary} />);
  const source = `Def Field $field=label|mockValues
  Text "$field.label"
  Box "$field.mockValues"
Page "Try it"
  Field field=@User.FirstName
  Text @User.FirstName.dataType
`;

  it("previews the values of the data dictionary field a pointer names, also through a macro", () => {
    const html = renderWith(source, rows);
    expect(html).not.toContain('role="alert"');
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    expect(preview).toContain("First Name");
    expect(preview).toContain("Jane");
    expect(preview).toContain("string");
  });

  it("follows a change of the data dictionary", () => {
    const preview = renderWith(source, [{ ...rows[0]!, label: "Given name" }]).split('aria-label="Pages"')[1]!;
    expect(preview).toContain("Given name");
    expect(preview).not.toContain("First Name");
  });

  it("shows an unknown pointer as an error with its line, and no preview", () => {
    const html = renderWith(source, []);
    expect(html).toMatch(/role="alert"[^>]*>Line 5: Unknown entity &quot;User&quot; \(in macro &quot;Field&quot;\)/);
    expect(html).toContain("Fix the source to see the wire frame.");
    expect(html).not.toContain('aria-label="Pages"');
  });

  it("behaves as before for a source without pointers and no data dictionary", () => {
    expect(renderWith(seedMacrosSource)).toBe(render(seedMacrosSource));
  });
});

describe("MacrosView", () => {
  it("has a Macros heading and the editor", () => {
    const html = renderToStaticMarkup(<MacrosView source={seedMacrosSource} onSourceChange={() => {}} />);
    expect(html).toMatch(/<h1[^>]*>Macros<\/h1>/);
    expect(html).toContain('aria-label="Macros source"');
  });

  it("passes the data dictionary to the editor", () => {
    const rows: DataDictionaryRow[] = [
      { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValues: "Jane" },
    ];
    const source = 'Page "Try it"\n  Text @User.FirstName.label\n';
    const html = renderToStaticMarkup(<MacrosView source={source} onSourceChange={() => {}} dataDictionary={rows} />);
    expect(html).not.toContain('role="alert"');
    expect(html.slice(html.indexOf('aria-label="Pages"'))).toContain("First Name");
  });
});
