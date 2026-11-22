import { describe, expect, it } from "vitest";
import { featuresListSource } from "@/features/wireframes/features-list";
import { pageLinksSource } from "@/features/wireframes/page-links";
import { wireFrameEditorSource } from "@/features/wireframes/wire-frame-editor";
import { parseSyntax } from "@/syntax/parse";
import { joinSourcePages, locateParseError, PAGE_IN_PANE_MESSAGE, splitSourcePages } from "./source-pages";

const two = `Page "Log in" id=login
  Box
    Text "Hi"
Page "Forgot" id=forgot
  Text "Back" link-to=login
`;

describe("splitSourcePages", () => {
  it("gives one pane per Page line, in source order, with title, id and content from column 0", () => {
    expect(splitSourcePages(two)).toEqual([
      { title: "Log in", id: "login", content: 'Box\n  Text "Hi"' },
      { title: "Forgot", id: "forgot", content: 'Text "Back" link-to=login\n' },
    ]);
  });

  it("reads a page without an id as an empty id", () => {
    expect(splitSourcePages('Page "A"\n  Text "x"\nPage "B" id=b')).toEqual([
      { title: "A", id: "", content: 'Text "x"' },
      { title: "B", id: "b", content: "" },
    ]);
  });

  it("gives one empty page for the empty source", () => {
    expect(splitSourcePages("")).toEqual([{ title: "", id: "", content: "" }]);
  });

  it("allows an empty title", () => {
    expect(splitSourcePages('Page ""\n  Text "x"')).toEqual([{ title: "", id: "", content: 'Text "x"' }]);
  });

  it("puts text before the first Page line in the first page's content", () => {
    expect(splitSourcePages('Bogus\nPage "A"\n  Text "x"')).toEqual([
      { title: "A", id: "", content: 'Bogus\nText "x"' },
    ]);
    expect(splitSourcePages("Bogus")).toEqual([{ title: "", id: "", content: "Bogus" }]);
  });

  it("drops blank lines before the first page", () => {
    expect(splitSourcePages('\n\nPage "A"')).toEqual([{ title: "A", id: "", content: "" }]);
  });

  it("removes up to 2 leading spaces and never puts the Page line in the content", () => {
    const pages = splitSourcePages('Page "A"\n  Box\n    Text "x"\n Text "one space"\nPage "B"\n  Box');
    expect(pages.map((p) => p.content)).toEqual(['Box\n  Text "x"\nText "one space"', "Box"]);
    for (const page of pages) expect(page.content.split("\n").some((l) => /^Page(?: |$)/.test(l))).toBe(false);
  });

  it("keeps a Page line typed inside a pane (indented) in that pane", () => {
    const joined = joinSourcePages([
      { title: "A", id: "a", content: 'Box\nPage "Sneaky"' },
      { title: "B", id: "b", content: "" },
    ]);
    const pages = splitSourcePages(joined);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ title: "A", id: "a", content: 'Box\nPage "Sneaky"' });
  });

  it("reads a title that contains a straight quote", () => {
    expect(splitSourcePages('Page "a"b" id=x')).toEqual([{ title: 'a"b', id: "x", content: "" }]);
  });
});

describe("joinSourcePages", () => {
  it("builds the header with an id only when it is not empty", () => {
    expect(joinSourcePages([{ title: "A", id: "a", content: "" }])).toBe('Page "A" id=a');
    expect(joinSourcePages([{ title: "A", id: "", content: "" }])).toBe('Page "A"');
  });

  it("adds 2 spaces to every non-blank line and keeps blank lines empty", () => {
    expect(joinSourcePages([{ title: "A", id: "", content: 'Box\n  Text "x"\n\nText "y"' }])).toBe(
      'Page "A"\n  Box\n    Text "x"\n\n  Text "y"',
    );
  });

  it("joins pages by newlines", () => {
    expect(
      joinSourcePages([
        { title: "A", id: "a", content: "Box" },
        { title: "B", id: "", content: "" },
      ]),
    ).toBe('Page "A" id=a\n  Box\nPage "B"');
  });

  it("gives a source that parses for valid input", () => {
    const source = joinSourcePages([
      { title: "A", id: "a", content: 'Box\n  Text "x" link-to=b' },
      { title: "B", id: "b", content: "" },
    ]);
    expect(parseSyntax(source).ok).toBe(true);
  });

  it("keeps what is typed stable: typing a trailing newline or spaces survives a round trip", () => {
    for (const content of ["Box\n", "\n", " ", "Box\n  ", 'Box\n\n  Text "x"']) {
      const pages = splitSourcePages(joinSourcePages([{ title: "A", id: "a", content }]));
      expect(pages[0]!.content).toBe(content);
    }
  });
});

describe("round trip", () => {
  const sources = {
    "Wire frame editor": wireFrameEditorSource,
    "Page links": pageLinksSource,
    "Features list": featuresListSource,
    empty: "",
  };

  for (const [name, source] of Object.entries(sources)) {
    it(`parses to the same AST for ${name}`, () => {
      const before = parseSyntax(source);
      const after = parseSyntax(joinSourcePages(splitSourcePages(source)));
      expect(before.ok).toBe(true);
      expect(after).toEqual(before);
    });
  }
});

describe("a Page line typed in a pane", () => {
  const pages = [
    { title: "A", id: "a", content: "Box" },
    { title: "B", id: "b", content: 'Text "x"\nPage "C"' },
  ];

  it("stays in its pane and gives the page-cannot-be-written-here message on that line", () => {
    const joined = joinSourcePages(pages);
    expect(splitSourcePages(joined)).toEqual(pages);
    const result = parseSyntax(joined);
    expect(result.ok).toBe(false);
    expect(locateParseError(pages, result.ok ? undefined : result.error)).toEqual({
      page: 1,
      message: `Line 2: ${PAGE_IN_PANE_MESSAGE}`,
    });
  });

  it("uses the exact message", () => {
    expect(PAGE_IN_PANE_MESSAGE).toBe("Page cannot be written here, it is created from the title and id");
  });
});

describe("locateParseError", () => {
  const errorOf = (pages: Parameters<typeof joinSourcePages>[0]) => {
    const result = parseSyntax(joinSourcePages(pages));
    return result.ok ? undefined : result.error;
  };

  it("gives no location without an error", () => {
    const pages = splitSourcePages(two);
    expect(locateParseError(pages, errorOf(pages))).toBeUndefined();
  });

  it("places a content error on its page with the line counted within that page's content", () => {
    const pages = [
      { title: "A", id: "a", content: "Box\nBox" },
      { title: "B", id: "b", content: 'Text "x"\n\nBogus' },
    ];
    expect(errorOf(pages)).toMatch(/^Line 7: /);
    expect(locateParseError(pages, errorOf(pages))).toEqual({
      page: 1,
      message: 'Line 3: Unknown type "Bogus" (expected Box or Text or Row or BoxRow or Spacer)',
    });
  });

  it("places a content error on the first page", () => {
    const pages = [{ title: "A", id: "a", content: "Bogus" }, { title: "B", id: "b", content: "" }];
    expect(locateParseError(pages, errorOf(pages))).toMatchObject({ page: 0, message: expect.stringMatching(/^Line 1: Unknown type/) });
  });

  it("places an error on a page's own line as the bare message", () => {
    const pages = [
      { title: "A", id: "same", content: "Box" },
      { title: "B", id: "same", content: "" },
    ];
    expect(locateParseError(pages, errorOf(pages))).toEqual({ page: 1, message: 'Duplicate page id "same"' });
  });

  it("places an unwritable title on its page header without a line number", () => {
    const pages = [{ title: "A", id: "", content: "" }, { title: 'a"b', id: "", content: "" }];
    // The title reads back the same, but the parser cannot read it.
    expect(splitSourcePages(joinSourcePages(pages))).toEqual(pages);
    const location = locateParseError(pages, errorOf(pages));
    expect(location?.page).toBe(1);
    expect(location?.message).not.toMatch(/^Line /);
  });
});
