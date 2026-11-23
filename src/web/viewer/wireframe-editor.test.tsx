import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { WireframeEditor } from "./wireframe-editor";

const render = (source: string) =>
  renderToStaticMarkup(<WireframeEditor source={source} onSourceChange={() => {}} />);

const two = `Page "Log in" id=login
  Box
    Text "Hi"
Page "Forgot" id=forgot
  Text "Back" link-to=login
`;

const textarea = (html: string, label: string) =>
  new RegExp(`<textarea[^>]*aria-label="${label}"[^>]*>([^<]*)</textarea>`).exec(html);

/** The tabs of the source card (the first tab list), in order. */
const sourceTabs = (html: string) => {
  const list = /<div[^>]*aria-label="Source pages"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!;
  return [...list.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map((m) => ({
    label: m[2],
    selected: /aria-selected="true"/.test(m[1]!),
  }));
};

describe("WireframeEditor source tabs", () => {
  it("shows one tab per page, labelled with the page's title, the first selected", () => {
    expect(sourceTabs(render(two))).toEqual([
      { label: "Log in", selected: true },
      { label: "Forgot", selected: false },
    ]);
  });

  it("shows a single tab for a single page", () => {
    expect(sourceTabs(render('Page "Only"\n  Text "x"'))).toEqual([{ label: "Only", selected: true }]);
  });

  it("labels a page with an empty title Page N, and the blank source one Page 1 tab", () => {
    expect(sourceTabs(render('Page ""\n  Box\nPage "B"'))).toEqual([
      { label: "Page 1", selected: true },
      { label: "B", selected: false },
    ]);
    expect(sourceTabs(render(""))).toEqual([{ label: "Page 1", selected: true }]);
  });

  it("shows the + button before the tabs", () => {
    const html = render(two);
    expect(html).toMatch(/<button[^>]*aria-label="Add page"[^>]*>\+<\/button>/);
    expect(html.indexOf('aria-label="Add page"')).toBeLessThan(html.indexOf('aria-label="Source pages"'));
  });

  it("shows only the selected page's text, starting with its own Page line", () => {
    const html = render(two);
    expect(textarea(html, "Page 1 source")![1]).toBe('Page &quot;Log in&quot; id=login\n  Box\n    Text &quot;Hi&quot;');
    expect(textarea(html, "Page 2 source")).toBeNull();
    expect(html.match(/<textarea/g)).toHaveLength(1);
  });

  it("has no title or id fields and no accordion toggles", () => {
    const html = render(two);
    expect(html).not.toContain("Page 1 title");
    expect(html).not.toContain("Page 1 id");
    expect(html).not.toContain("Page:");
    expect(html).not.toContain("Toggle");
    expect(html).not.toContain("+ Add Page");
  });

  it("shows one empty text with a Page placeholder for the empty source", () => {
    const html = render("");
    expect(textarea(html, "Page 1 source")![1]).toBe("");
    expect(html).toContain("placeholder=\"Page &quot;Page 1&quot; id=page-1\"");
  });

  it("shows no error and the preview when the source is valid", () => {
    const html = render(two);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source");
    expect(html).toContain('aria-label="Pages"');
  });

  it("shows an error in the selected page's text with its line counted within the page", () => {
    const html = render('Page "A" id=a\n  Bogus\nPage "B" id=b\n  Box');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toMatch(/role="alert"[^>]*>Line 2: Unknown type/);
    expect(html).toContain("Fix the source to see the wire frame.");
  });

  it("names the page when the error is on a page whose tab is not selected, so it is never hidden", () => {
    const html = render('Page "A" id=a\n  Box\nPage "B" id=b\n  Text "x"\n  Bogus');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toMatch(/role="alert"[^>]*>B: Line 3: Unknown type/);
  });

  it("shows an error on a page's own line as line 1 of that page", () => {
    const html = render('Page "A" id=same\n  Box\nPage "B" id=same');
    expect(html).toMatch(/role="alert"[^>]*>B: Line 1: Duplicate page id/);
  });

  it("shows the parser's message for a nested Page", () => {
    const html = render('Page "A" id=a\n  Box\n    Page "X"');
    expect(html).toMatch(/role="alert"[^>]*>Line 3: Page cannot be nested/);
  });

  it("keeps the preview's own tabs, one per page", () => {
    const html = render(two);
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    expect(preview).toContain("Log in");
    expect(preview).toContain("Forgot");
  });
});

describe("WireframeEditor macros", () => {
  const macroSource = `Def Field $label
  BoxRow
    Text "$label" font=bold
Page "Profile" id=profile
  Field label="First Name"
`;

  it("renders the expansion of a source with a Def and a macro use", () => {
    const html = render(macroSource);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source");
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    expect(preview).toContain("First Name");
    expect(sourceTabs(html)).toEqual([{ label: "Profile", selected: true }]);
  });

  it("shows an error with the line of the source as written, naming the macro", () => {
    const html = render(macroSource.replace("BoxRow", "Spacer"));
    expect(html).toMatch(/role="alert"[^>]*>Line 5: Spacer must be inside a Row or BoxRow \(in macro &quot;Field&quot;\)/);
  });

  it("shows a macro error under the right tab", () => {
    const html = render('Def A\n  Box\nPage "A" id=a\n  Box\nPage "B" id=b\n  A x=1');
    expect(html).toMatch(/role="alert"[^>]*>B: Line 2: Unknown argument &quot;x&quot; for macro &quot;A&quot;/);
  });
});

describe("WireframeEditor data references", () => {
  const rows: DataDictionaryRow[] = [
    { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValues: "Jane" },
  ];
  const renderWith = (source: string, dataDictionary?: DataDictionaryRow[], sharedMacros?: string) =>
    renderToStaticMarkup(
      <WireframeEditor
        source={source}
        onSourceChange={() => {}}
        sharedMacros={sharedMacros}
        dataDictionary={dataDictionary}
      />,
    );
  const source = 'Page "Profile"\n  Text @User.FirstName.label\n  Box @User.FirstName\n';
  const previewOf = (html: string) => html.slice(html.indexOf('aria-label="Pages"'));

  it("previews the label and the mock value of the data dictionary field", () => {
    const html = renderWith(source, rows);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source");
    const preview = previewOf(html);
    expect(preview).toContain("First Name");
    expect(preview).toContain("Jane");
    expect(preview).not.toContain("@User");
  });

  it("keeps the pointer as written in the source text", () => {
    const html = renderWith(source, rows);
    expect(textarea(html, "Page 1 source")![1]).toBe(
      'Page &quot;Profile&quot;\n  Text @User.FirstName.label\n  Box @User.FirstName\n',
    );
  });

  it("follows a change of the data dictionary", () => {
    const changed = [{ ...rows[0]!, label: "Given name", mockValues: "John" }];
    const preview = previewOf(renderWith(source, changed));
    expect(preview).toContain("Given name");
    expect(preview).toContain("John");
    expect(preview).not.toContain("Jane");
  });

  it("shows an unknown entity or field as an error with its line, and no preview", () => {
    const html = renderWith('Page "P"\n  Text "ok"\n  Box @User.Nope\n', rows);
    expect(html).toMatch(/role="alert"[^>]*>Line 3: Unknown field &quot;User.Nope&quot;/);
    expect(html).toContain("Fix the source to see the wire frame.");
    expect(renderWith(source, [])).toMatch(/role="alert"[^>]*>Line 2: Unknown entity &quot;User&quot;/);
    expect(renderWith(source)).toMatch(/role="alert"[^>]*>Line 2: Unknown entity &quot;User&quot;/);
  });

  it("resolves a pointer passed to a macro, in the source and in the global macros", () => {
    const shared = 'Def Field $field=label|mockValues\n  Text "$field.label"\n  Box "$field.mockValues"\n';
    const html = renderWith('Page "Profile"\n  Field field=@User.FirstName\n', rows, shared);
    expect(html).not.toContain('role="alert"');
    const preview = previewOf(html);
    expect(preview).toContain("First Name");
    expect(preview).toContain("Jane");
  });

  it("names the macro when the pointer of a macro use is unknown", () => {
    const shared = 'Def Field $field=label|mockValues\n  Text "$field.label"\n  Box "$field.mockValues"\n';
    const html = renderWith('Page "Profile"\n  Field field=@User.Nope\n', rows, shared);
    expect(html).toMatch(/role="alert"[^>]*>Line 2: Unknown field &quot;User.Nope&quot; \(in macro &quot;Field&quot;\)/);
  });

  it("shows a quoted pointer as plain text", () => {
    const preview = previewOf(renderWith('Page "P"\n  Text "@User.FirstName"\n', rows));
    expect(preview).toContain("@User.FirstName");
  });
});

describe("WireframeEditor tables", () => {
  const rows: DataDictionaryRow[] = [
    { entity: "User", field: "Name", dataType: "string", label: "Full name", mockValues: "Jane Doe" },
    { entity: "User", field: "Email", dataType: "string", label: "Email address", mockValues: "jane@example.com" },
  ];
  const renderWith = (source: string, dataDictionary?: DataDictionaryRow[]) =>
    renderToStaticMarkup(<WireframeEditor source={source} onSourceChange={() => {}} dataDictionary={dataDictionary} />);
  const previewOf = (html: string) => html.slice(html.indexOf('aria-label="Pages"'));
  const tableSource = `Page "Users"
  Table
    TableColumn @User.Name width=4
    TableColumn @User.Email width=5
    TableColumn "Manual Column"|"mock 1","mock 2","mock 3"
    TableColumn "Edit"|"Edit user" width=2 link-to=edit-user
`;

  it("previews the example table with the headers and values of the data dictionary", () => {
    const html = renderWith(tableSource, rows);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source");
    const preview = previewOf(html);
    expect(preview).toContain('data-node-type="Table"');
    for (const text of ["Full name", "Jane Doe", "Email address", "jane@example.com", "Manual Column", "mock 1", "mock 3", "Edit user"]) {
      expect(preview).toContain(text);
    }
    expect(preview).not.toContain("@User");
    expect(preview.match(/Edit user/g)).toHaveLength(10);
  });

  it("keeps the table as written in the source text", () => {
    const html = renderWith(tableSource, rows);
    expect(textarea(html, "Page 1 source")![1]).toContain("TableColumn @User.Name width=4");
  });

  it("previews a table without a data dictionary when it has only literal columns", () => {
    const html = render('Page "P"\n  Table\n    TableColumn "A"|"x"');
    expect(html).not.toContain('role="alert"');
    expect(previewOf(html)).toContain('data-node-type="Table"');
  });

  it("shows an error and no preview for a table error", () => {
    const html = render('Page "P"\n  Table');
    expect(html).toMatch(/role="alert"[^>]*>Line 2: Table must have at least one TableColumn/);
    expect(html).toContain("Fix the source to see the wire frame.");
    expect(html).not.toContain('data-node-type="Table"');
  });

  it("shows an unknown field of a pointer column as an error with its line", () => {
    const html = renderWith('Page "P"\n  Table\n    TableColumn @User.Nope', rows);
    expect(html).toMatch(/role="alert"[^>]*>Line 3: Unknown field &quot;User.Nope&quot;/);
    expect(html).toContain("Fix the source to see the wire frame.");
  });
});

describe("WireframeEditor comments", () => {
  const commented = '# the first page\nPage "A"\n# a box\n  Box "Hello"\n# about B\nPage "B"\n  Text "Bye"\n';

  it("previews a source with comments, with no error", () => {
    const html = render(commented);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix the source to see the wire frame.");
    expect(html).toContain("Hello");
  });

  it("keeps a comment above a Page line in the previous tab's text and the tab names", () => {
    const html = render(commented);
    expect(sourceTabs(html)).toEqual([
      { label: "A", selected: true },
      { label: "B", selected: false },
    ]);
    expect(textarea(html, "Page 1 source")![1]).toBe(
      '# the first page\nPage &quot;A&quot;\n# a box\n  Box &quot;Hello&quot;\n# about B',
    );
  });

  it("shows an error after a comment with its line number counted in the tab's text", () => {
    const html = render('Page "A"\n# note\n  Bogus');
    expect(html).toMatch(/role="alert"[^>]*>Line 3: Unknown type/);
  });
});

describe("WireframeEditor static layout", () => {
  it("takes the height of its wrapper and shares it between the cards, stacked or side by side", () => {
    const html = render(two);
    expect(html).toMatch(/^<div class="grid h-full min-h-0 grid-rows-2 [^"]*md:grid-cols-2 md:grid-rows-1/);
  });

  it("lets each card shrink, with its title and its tab list outside the scrolling part", () => {
    const html = render(two);
    expect(html.match(/<div data-slot="card" [^>]*class="[^"]*\bmin-h-0\b[^"]*\boverflow-hidden\b/g)).toHaveLength(2);
    const contents = [...html.matchAll(/data-slot="card-content" class="([^"]*)"/g)].map((m) => m[1]!);
    expect(contents).toHaveLength(2);
    for (const classes of contents) expect(classes).toMatch(/\bmin-h-0\b.*\bflex-1\b.*\boverflow-hidden\b/);
  });

  it("scrolls only the page's content under the tabs, in both cards", () => {
    const html = render(two);
    const panels = [...html.matchAll(/<div[^>]*data-slot="tabs-content"[^>]*>/g)].map((m) => m[0]);
    expect(panels).toHaveLength(2);
    for (const panel of panels) expect(panel).toMatch(/class="[^"]*\bmin-h-0\b[^"]*\boverflow-y-auto\b/);
    for (const list of [/aria-label="Source pages"/, /aria-label="Pages"/]) {
      const tag = new RegExp(`<div[^>]*${list.source}[^>]*>`).exec(html)![0];
      expect(tag).not.toContain("overflow");
    }
    // The tab lists come before their scrolling panels.
    expect(html.indexOf('aria-label="Source pages"')).toBeLessThan(html.indexOf('data-slot="tabs-content"'));
    expect(html.indexOf('aria-label="Pages"')).toBeLessThan(html.lastIndexOf('data-slot="tabs-content"'));
  });
});
