import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MacrosView } from "@/pages/macros";
import { seedMacrosSource } from "./api";
import { MacroEditor } from "./macro-editor";

const render = (source: string) =>
  renderToStaticMarkup(<MacroEditor source={source} onSourceChange={() => {}} />);

const textarea = (html: string) => /<textarea[^>]*aria-label="Macros source"[^>]*>([^<]*)<\/textarea>/.exec(html);

describe("MacroEditor", () => {
  it("shows one text area with the whole source and no page tabs or + button for it", () => {
    const html = render(seedMacrosSource);
    expect(html.match(/<textarea/g)).toHaveLength(1);
    expect(textarea(html)![1]).toBe(seedMacrosSource.replaceAll('"', "&quot;"));
    expect(html).not.toContain('aria-label="Source pages"');
    expect(html).not.toContain('aria-label="Add page"');
  });

  it("previews the pages that use the macros, to the right of the source", () => {
    const html = render(seedMacrosSource);
    expect(html).not.toContain('role="alert"');
    expect(html.indexOf('aria-label="Macros source"')).toBeLessThan(html.indexOf('aria-label="Pages"'));
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    expect(preview).toContain("Try it");
    expect(preview).toContain("Email");
    expect(preview).toContain("Password");
  });

  it("previews the two cards of the seed, one written in each argument form", () => {
    const html = render(seedMacrosSource);
    const preview = html.slice(html.indexOf('aria-label="Pages"'));
    for (const text of ["Welcome", "Say hello to the team", "Reports", "See how the team is doing"]) {
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

describe("MacrosView", () => {
  it("has a Macros heading and the editor", () => {
    const html = renderToStaticMarkup(<MacrosView source={seedMacrosSource} onSourceChange={() => {}} />);
    expect(html).toMatch(/<h1[^>]*>Macros<\/h1>/);
    expect(html).toContain('aria-label="Macros source"');
  });
});
